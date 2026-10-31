# Tarozi backend

Grocery price intelligence for customers, business buyers, sellers and administrators. This implements the updated shared plan: category dashboards and an explainable Restock Advisor. It does not create orders, accept payments or book deliveries.

## Included

- Fastify/TypeScript HTTP API and generated `/openapi.json`.
- Supabase email/password registration, verification, login, refresh, recovery, logout and profiles.
- Database-backed seller membership and manual administrator approval. Users cannot grant themselves seller approval or admin access.
- Eight grocery categories, exact products and pack variants, seller branches, retail/wholesale offers, availability, quantity tiers and freshness.
- Whole-pack restock calculations, complete/incomplete supplier coverage, branch minimums, split estimates, explicit unknown transport costs and named-baseline potential savings.
- Immutable, versioned price observations. Updating a price creates history; it cannot rewrite the original observation.
- Local fair-price medians with at least three distinct sellers. Seller independence is not assumed.
- Private favorites, saved lists and in-app price alerts. List writes and reviewed imports are atomic database transactions.
- Suspicious-price reports, seller moderation, audit records and aggregate interest signals with a five-user privacy threshold.
- Synthetic demo seed, database access-control tests and frontend integration notes.

## Current integration status

The existing frontend remains intact. Its `scripts/auth.mjs` uses local accounts and HttpOnly cookies; those cookies are **not** Supabase access tokens. No existing accounts or secrets are copied or migrated. This backend exposes a separate API on port 4000. Connect the frontend using the documented API, or replace its auth adapter with Supabase Auth. Do not silently mix the two account systems.

No cloud project or hosted API is provisioned by this commit. Live Supabase Auth/email and hosted deployment require project configuration. Tests run the actual PostgreSQL schema and RLS using embedded PGlite, without requiring a cloud account or Docker.

## Quick verification without credentials

Node.js 22 or newer:

```sh
cd backend
npm ci
npm run check
```

This runs TypeScript checks, HTTP validation/authentication-boundary tests, calculation tests, actual PostgreSQL migration/seed tests, RLS adversarial tests and a production build. It does not send real verification emails, sign in to a live Supabase project or start a hosted service.

## Run with local Supabase

Docker must be running. From `backend/`:

```sh
npm run db:start
npm run db:status
```

Copy `.env.example` to `.env`. Set `SUPABASE_URL` and the publishable key shown by the CLI. A legacy local anon key also works. Set `INCLUDE_DEMO_DATA=true` for the synthetic competition catalog and add `http://localhost:4173` to `CORS_ORIGINS` if serving the current frontend.

```sh
npm run dev
```

API: `http://127.0.0.1:4000`. Liveness: `/health`. Database readiness: `/ready`. OpenAPI: `/openapi.json`.

If you need a clean **disposable local database**, `npm run db:reset` reapplies migrations and seed. This deletes local database data and accounts. Do not use a reset against a cloud or production database. The demo offers expire six hours after seeding; refresh them through the approved admin workflow or reset only a disposable local instance.

Local verification/recovery messages appear in Supabase's local mail service, whose URL is printed by `supabase status`. Confirm the email before password login when email confirmation is enabled.

## Use an existing cloud project later

1. Authenticate the Supabase CLI yourself: `npx supabase login`.
2. Select the intended project and inspect existing schemas before applying anything: `npx supabase projects list`, then `npx supabase link --project-ref YOUR_PROJECT_REF`.
3. Review `supabase/migrations/` before `npx supabase db push`. This migration creates Tarozi tables, policies and functions; it must not be blindly applied to an unrelated database with conflicting table names.
4. Set `.env` to that project's URL and **publishable key**. No service-role key or database password is required by the runtime API.
5. Configure Supabase Auth email verification, recovery and permitted callback URLs. Set `AUTH_REDIRECT_URL` to a callback on your real frontend. Use HTTPS in production.
6. Run schema/security advisors and test real signup, verification, login, recovery and ownership before a pilot.
7. Keep `INCLUDE_DEMO_DATA=false` for live data. The normal cloud migration does not load `seed.sql`. Do not publish synthetic suppliers as real businesses.

Never put Supabase secret/service-role keys or passwords in frontend code, GitHub, request logs or the repository. The API uses the publishable key plus the caller's bearer token; RLS remains active for normal requests.

## Bootstrap one administrator

Register and verify the intended administrator. In the project's trusted SQL editor, use the actual user UUID from Auth:

```sql
insert into private.admin_users(user_id)
values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid)
on conflict do nothing;
```

Do not grant this through user-editable profile fields or `user_metadata`. Administrator access is stored only in the non-exposed `private` schema. Seller applications automatically create a membership, but publishing remains blocked until approval.

## Demo flow

`examples/compare.json` is an executable Restock Advisor request using the seed's exact product IDs. With `INCLUDE_DEMO_DATA=true` and fresh local seed:

```sh
curl -X POST http://127.0.0.1:4000/advisor/compare \
  -H 'Content-Type: application/json' \
  --data-binary @examples/compare.json
```

Expected complete delivered totals: DEMO A = UZS 3,400,000; DEMO B = UZS 3,200,000. Potential difference against the named A baseline = UZS 200,000. DEMO C has only one current line; its expired products cannot make it the cheapest complete supplier. A split estimate may save on product cost but can require more visits. These are synthetic calculations, not observed market savings.

## Price and quantity rules

- `price_uzs` means the final supplier-declared price for **one whole pack**, including applicable tax. Input prices must follow that convention; the API does not calculate tax rates. Delivery is separate.
- `pack_quantity` is kilograms, liters or units per pack. A 5 L bottle at UZS 85,000 normalizes to UZS 17,000/L.
- List quantities use the product base unit. The calculator rounds up to whole packs, pack minimums and order multiples, and shows excess quantity.
- A quantity tier replaces the pack price at its `min_packs` threshold. Available quantity is seller-reported, not reserved stock.
- Branch minimum spend is checked on the selected goods subtotal. A partial basket cannot win a complete-basket ranking.
- Expired, future-dated, stale, withdrawn, unavailable and unapproved seller offers are excluded from current calculations.
- Retail and wholesale are separate channels. Product brand, grade, origin and unit are canonical identities; callers can restrict the exact variant too.
- If all complete delivery options have known fees, rank by known delivered cost. Otherwise rank by goods only, with unknown transport explicitly stated. Pickup travel is always unknown in this version.
- Split estimates are greedy product-cost candidates with minimum-spend checks, not a globally optimal routing/transport solver. They can miss feasible combinations when branch minimums interact.
- Fair-price medians use one lowest base-pack unit price per distinct seller for one exact product, district and channel. Quantity tiers and MOQ are disclosed conditions, not silently folded into a universal market price.

## Alerts and demand signals

Alerts are in-app only. Creating an alert, requesting `/notifications`, or calling `/alerts/evaluate` evaluates that user's rules. Poll the notification endpoint while the dashboard is open. Each observation version creates at most one notification per alert. No always-running cloud worker or email-alert integration is deployed.

Target prices are UZS per base unit and refer to the base package price; check pack MOQ and seller conditions. Demo alerts require explicit opt-in. Notifications do not represent a reserved price.

Market signals aggregate unique users with searches, favorites or recent saved-list activity. Only approved sellers/admins can access them; groups smaller than five users are suppressed. These are platform interest indicators, not sales, external market demand or a forecast.

## Production deployment

`Dockerfile` builds the API. Configure the same environment variables on a Node/Docker hosting service and set `HOST=0.0.0.0`. Serve through HTTPS, restrict CORS to actual frontend origins and keep rate limiting at the reverse proxy too. The default in-process rate limiter is per instance and does not replace a shared production limiter.

Passwords/session tokens are not logged by the application. Bearer tokens are returned only to the caller. Logout revokes refresh-session access; an already-issued access JWT remains valid until its expiry, so the frontend must discard it. The API does not claim instant JWT revocation.

See [API integration](docs/API.md) and [schema/security design](docs/SCHEMA.md).
