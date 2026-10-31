import { Decimal } from 'decimal.js';
import { z } from 'zod';

export const uuid = z.uuid();
export const money = z.number().int().min(0).max(1_000_000_000_000);
export const quantity = z.number().positive().min(0.000001).max(1_000_000);
export const channel = z.enum(['retail', 'wholesale']);
export const offerSchema = z.object({
  id: uuid, product_id: uuid, variant_id: uuid, branch_id: uuid, seller_id: uuid,
  product_name: z.string(), brand: z.string(), grade: z.string(), base_unit: z.enum(['kg', 'L', 'unit']),
  variant_name: z.string(), pack_quantity: z.coerce.number().positive(), seller_name: z.string(),
  branch_name: z.string(), district: z.string(), channel,
  price_uzs: z.coerce.number().int().nonnegative(), min_packs: z.number().int().positive(),
  step_packs: z.number().int().positive(), available_packs: z.number().int().nonnegative().nullable(),
  availability: z.enum(['available', 'limited', 'unavailable']),
  quantity_tiers: z.array(z.object({ min_packs: z.number().int().positive(), price_uzs: money })),
  updated_at: z.iso.datetime({ offset: true }), valid_until: z.iso.datetime({ offset: true }),
  source_type: z.enum(['seller', 'admin_import', 'demo']), source_url: z.string().nullable(),
  conditions: z.string(), minimum_order_uzs: z.coerce.number().nonnegative(),
  delivery_fee_uzs: z.coerce.number().nonnegative().nullable(),
  is_demo: z.boolean(), status: z.enum(['published', 'withdrawn']), seller_approved: z.boolean(),
});
export type Offer = z.infer<typeof offerSchema>;
export const listItemSchema = z.object({ product_id: uuid, variant_id: uuid.optional(), quantity });
export const compareSchema = z.object({
  items: z.array(listItemSchema).min(1).max(30), channel,
  district: z.string().trim().min(1).max(80).optional(),
  max_age_hours: z.number().positive().max(168).default(24),
  delivery: z.enum(['pickup', 'delivery']).default('pickup'), baseline_branch_id: uuid.optional(),
}).superRefine((v, ctx) => {
  if (new Set(v.items.map(i => i.product_id)).size !== v.items.length)
    ctx.addIssue({ code: 'custom', message: 'Combine duplicate products into one list item.', path: ['items'] });
});
export type CompareInput = z.infer<typeof compareSchema>;

export function eligible(o: Offer, now: Date, hours: number, includeDemo: boolean): boolean {
  const updated = Date.parse(o.updated_at);
  return o.status === 'published' && o.seller_approved && o.availability !== 'unavailable'
    && (o.available_packs === null || o.available_packs >= Math.ceil(o.min_packs/o.step_packs)*o.step_packs)
    && (includeDemo || !o.is_demo) && updated <= now.getTime()
    && updated >= now.getTime() - hours * 3_600_000 && Date.parse(o.valid_until) > now.getTime();
}
function exactInteger(value: Decimal): number {
  if (!value.isInteger() || value.abs().greaterThan(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Calculated amount exceeds supported integer UZS range.');
  return value.toNumber();
}
export function priceLine(offer: Offer, item: CompareInput['items'][number]) {
  if (offer.product_id !== item.product_id || (item.variant_id && offer.variant_id !== item.variant_id)) return null;
  const pack = new Decimal(offer.pack_quantity);
  const required = Math.max(new Decimal(item.quantity).div(pack).ceil().toNumber(), offer.min_packs);
  const packs = Math.ceil(required / offer.step_packs) * offer.step_packs;
  if (offer.available_packs !== null && packs > offer.available_packs) return null;
  // A tier replaces the price only when the purchased pack count meets its threshold.
  const tiers = [...offer.quantity_tiers].sort((a, b) => b.min_packs - a.min_packs);
  const tier = tiers.find(t => packs >= t.min_packs);
  const unitPrice = tier?.price_uzs ?? offer.price_uzs;
  const supplied = pack.mul(packs);
  return {
    product_id: item.product_id, variant_id: offer.variant_id, offer_id: offer.id,
    product_name: offer.product_name, variant_name: offer.variant_name, base_unit: offer.base_unit,
    requested_quantity: item.quantity, purchased_quantity: supplied.toNumber(),
    excess_quantity: supplied.minus(item.quantity).toNumber(), packs,
    price_per_pack_uzs: unitPrice, subtotal_uzs: exactInteger(new Decimal(unitPrice).mul(packs)),
    normalized_unit_price_uzs: new Decimal(unitPrice).div(pack).toDecimalPlaces(6).toNumber(),
    source_type: offer.source_type, updated_at: offer.updated_at, valid_until: offer.valid_until,
    is_demo: offer.is_demo, conditions: offer.conditions,
    stock_quantity_known: offer.available_packs !== null,
  };
}
type Line = NonNullable<ReturnType<typeof priceLine>>;
function total(lines: Line[]): number { return exactInteger(lines.reduce((s, l) => s.add(l.subtotal_uzs), new Decimal(0))); }

export function compareBasket(raw: CompareInput, offers: Offer[], now = new Date(), includeDemo = false) {
  const input = compareSchema.parse(raw);
  const candidates = offers.filter(o => eligible(o, now, input.max_age_hours, includeDemo)
    && o.channel === input.channel && (!input.district || o.district === input.district));
  const branches = new Map<string, Offer[]>();
  for (const o of candidates) branches.set(o.branch_id, [...(branches.get(o.branch_id) ?? []), o]);
  const options = [...branches.entries()].map(([branch_id, rows]) => {
    const head = rows[0]!;
    const lines = input.items.map(item => rows.map(o => priceLine(o, item)).filter((v): v is Line => v !== null)
      .sort((a, b) => a.subtotal_uzs - b.subtotal_uzs || a.offer_id.localeCompare(b.offer_id))[0]);
    const priced = lines.filter((v): v is Line => !!v);
    const subtotal = total(priced);
    const missing = input.items.filter((_, i) => !lines[i]).map(i => i.product_id);
    const complete = !missing.length && subtotal >= head.minimum_order_uzs;
    const fee = input.delivery === 'delivery' ? head.delivery_fee_uzs : null;
    return { branch_id, seller_id: head.seller_id, seller_name: head.seller_name, branch_name: head.branch_name,
      district: head.district, complete, lines: priced, missing_product_ids: missing,
      minimum_order_uzs: head.minimum_order_uzs, minimum_order_met: subtotal >= head.minimum_order_uzs,
      goods_subtotal_uzs: subtotal, known_delivery_fee_uzs: fee,
      estimated_delivered_total_uzs: fee === null || !complete ? null : subtotal + fee,
      is_demo: priced.some(l => l.is_demo),
      unknowns: [fee === null ? (input.delivery === 'pickup' ? 'Pickup travel cost unknown' : 'Delivery fee unknown') : null,
        priced.some(l => !l.stock_quantity_known) ? 'Exact stock quantity requires seller confirmation' : null].filter(Boolean),
    };
  });
  const complete = options.filter(o => o.complete);
  const rankDelivered = input.delivery === 'delivery' && complete.length > 0
    && complete.every(o => o.estimated_delivered_total_uzs !== null);
  const cost = (o: typeof options[number]) => rankDelivered ? o.estimated_delivered_total_uzs! : o.goods_subtotal_uzs;
  complete.sort((a, b) => cost(a) - cost(b) || a.branch_id.localeCompare(b.branch_id));

  // Greedy split is an explainable estimate, NOT a global optimizer with branch minimums or transport costs.
  let allowed = new Map(branches);
  let splitLines: (Line & { branch_id: string; seller_id: string })[] = [];
  let splitValid = false;
  for (let attempt = 0; attempt <= branches.size; attempt++) {
    const picked = input.items.map(item => [...allowed.entries()].flatMap(([branch_id, rows]) => rows.map(o => {
      const line = priceLine(o, item); return line ? { ...line, branch_id, seller_id: o.seller_id } : null;
    })).filter((v): v is Line & { branch_id: string; seller_id: string } => v !== null)
      .sort((a, b) => a.subtotal_uzs - b.subtotal_uzs || a.offer_id.localeCompare(b.offer_id))[0]);
    if (picked.some(p => !p)) break;
    splitLines = picked as typeof splitLines;
    const used = [...new Set(splitLines.map(l => l.branch_id))];
    const failing = used.filter(id => total(splitLines.filter(l => l.branch_id === id)) < allowed.get(id)![0]!.minimum_order_uzs);
    if (!failing.length) { splitValid = true; break; }
    for (const id of failing) allowed.delete(id);
  }
  const visits = [...new Set(splitLines.map(l => l.branch_id))];
  const fees = visits.map(id => branches.get(id)![0]!.delivery_fee_uzs);
  const splitKnown = input.delivery === 'delivery' && fees.every(f => f !== null);
  const baseline = complete.find(o => o.branch_id === input.baseline_branch_id);
  const best = complete[0] ?? null;
  const difference = baseline && best ? cost(baseline) - cost(best) : null;
  return {
    is_demo: candidates.some(o=>o.is_demo),
    channel: input.channel, district: input.district ?? null, calculated_at: now.toISOString(),
    ranking_basis: rankDelivered ? 'known_delivered_cost' : 'goods_only_transport_not_comparable',
    complete_options: complete, incomplete_options: options.filter(o => !o.complete),
    best_complete: best,
    split_estimate: !splitValid ? null : {
      method: 'greedy_product_cost_with_branch_minimum_checks', globally_optimal: false,
      lines: splitLines, goods_subtotal_uzs: total(splitLines), branch_visits: visits.length,
      supplier_count: new Set(splitLines.map(l => l.seller_id)).size,
      known_delivery_fees_uzs: splitKnown ? fees.reduce<number>((s, f) => s + f!, 0) : null,
      estimated_delivered_total_uzs: splitKnown ? total(splitLines) + fees.reduce<number>((s, f) => s + f!, 0) : null,
      warning: 'Potential product-cost estimate. Separate visits, excess pack quantities and unknown transport can change the decision.',
      is_demo: splitLines.some(l => l.is_demo),
    },
    potential_savings: difference === null ? null : { baseline_branch_id: baseline!.branch_id,
      baseline_seller_name: baseline!.seller_name, difference_uzs: difference,
      percent: cost(baseline!) === 0 ? null : new Decimal(difference).div(cost(baseline!)).mul(100).toDecimalPlaces(2).toNumber(),
      basis: rankDelivered ? 'known_delivered_cost' : 'goods_only', actual_purchase_savings: false },
    notices: ['No purchase, checkout or delivery booking is created.',
      'Unknown stock, transport and conditions require direct seller confirmation.',
      'An incomplete basket is never ranked as a complete alternative.'],
  };
}

export function fairPrice(offers: Offer[], now = new Date(), includeDemo = false, maxHours = 24) {
  const current = offers.filter(o => eligible(o, now, maxHours, includeDemo));
  const productIds = new Set(current.map(o => o.product_id));
  const channels = new Set(current.map(o => o.channel));
  const districts = new Set(current.map(o => o.district));
  if (productIds.size > 1 || channels.size > 1 || districts.size > 1)
    throw new Error('Benchmark requires one exact product, district and channel.');
  const sellers = new Map<string, number>();
  for (const o of current) {
    const price = new Decimal(o.price_uzs).div(o.pack_quantity).toNumber();
    sellers.set(o.seller_id, Math.min(price, sellers.get(o.seller_id) ?? Infinity));
  }
  const values = [...sellers.values()].sort((a, b) => a - b);
  const n = values.length, middle = Math.floor(n / 2);
  return { status: n < 3 ? 'insufficient_data' : 'available', distinct_sellers: n,
    median_unit_price_uzs: n < 3 ? null : new Decimal(n % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2).toDecimalPlaces(6).toNumber(),
    base_unit: current[0]?.base_unit ?? null, is_demo: current.some(o => o.is_demo),
    methodology: 'One lowest base-package unit price per distinct seller. Exact product/district/channel; fresh offers only. Quantity tiers and purchase conditions must be checked separately.',
    seller_independence_verified: false, max_age_hours: maxHours, calculated_at: now.toISOString() };
}
