import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { offerSchema, type Offer } from './domain.js';
import type { Config } from './config.js';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function clientFor(config: Config, token?: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}
type Result<T> = { data: T | null; error: { code?: string; message: string } | null };
export function unwrap<T>(result: Result<T>): T {
  if (result.error) {
    const code = result.error.code ?? 'database_error';
    if (code === '42501') throw new ApiError(403, 'forbidden', 'This account cannot perform that action.');
    if (code === 'PGRST116' || code === 'P0002') throw new ApiError(404, 'not_found', 'Record not found or not accessible.');
    if (code === '23505') throw new ApiError(409, 'conflict', 'A record with this identity already exists.');
    if (['23503','23514','22P02','P0001','22023','22007'].includes(code))
      throw new ApiError(400, 'invalid_data', 'Invalid record or business-rule violation.');
    throw new ApiError(503, 'database_unavailable', 'The database request failed. Check service availability and migrations.');
  }
  return result.data as T;
}
export type OfferFilters = {
  productIds?: string[]; variantId?: string; categoryId?: string; sellerId?: string;
  channel?: string; district?: string; includeDemo: boolean;
};
export async function readOffers(db: SupabaseClient, f: OfferFilters): Promise<Offer[]> {
  const all: Offer[] = [];
  // Hard bound prevents silently comparing a truncated result set.
  for (let page=0; page<6; page++) {
    let q=db.from('offer_catalog').select('*').eq('status','published').eq('seller_approved',true).order('id');
    if (!f.includeDemo) q=q.eq('is_demo',false);
    if (f.productIds?.length) q=q.in('product_id',f.productIds);
    if (f.variantId) q=q.eq('variant_id',f.variantId);
    if (f.categoryId) q=q.eq('category_id',f.categoryId);
    if (f.sellerId) q=q.eq('seller_id',f.sellerId);
    if (f.channel) q=q.eq('channel',f.channel);
    if (f.district) q=q.eq('district',f.district);
    const rows=unwrap(await q.range(page*1000,page*1000+999));
    if (page===5 && rows.length) throw new ApiError(422,'comparison_too_broad','Narrow the category, location or products. More than 5,000 offers match.');
    all.push(...rows.map(r=>offerSchema.parse(r)));
    if (rows.length<1000) return all;
  }
  return all;
}
