# Frontend integration

Base URL: `http://127.0.0.1:4000` locally. Paths are not prefixed with `/api`. The existing frontend's port is 4173; include that origin in backend CORS. The OpenAPI document is generated from request schemas at `GET /openapi.json`.

Authenticated endpoints require `Authorization: Bearer SUPABASE_ACCESS_TOKEN`. The root frontend's local HttpOnly cookie is a separate demo auth system and cannot authenticate these endpoints. No service-role key belongs in the frontend.

Errors: `{ "error": { "code": "validation_error", "message": "Invalid request.", "issues": [] } }`. Common statuses: 400 invalid input, 401 session required/invalid, 403 permission denied, 404 inaccessible record, 409 duplicate identity, 422 calculation/result-size limits, 429 throttled, 503 database configuration/unavailability.

## Authentication

| Method and path | Body | Result |
|---|---|---|
| POST `/auth/register` | `email`, `password` (10+ chars), `display_name` | User, session when allowed, verification-required flag |
| POST `/auth/login` | `email`, `password` | User and Supabase session |
| POST `/auth/refresh` | `refresh_token` | Rotated session; replace both tokens |
| POST `/auth/verify` | `token_hash`, `type` = signup/recovery/email | Verified session |
| POST `/auth/reset-password` | `email` | Generic acknowledgement; does not reveal account existence |
| PUT `/auth/password` | `password`; valid current/recovery bearer session | Password updated |
| POST `/auth/logout` | Valid bearer token | Refresh session revoked; discard local tokens |
| GET `/me` | Bearer token | Profile plus `access.is_admin` and owned `seller_ids` |
| PATCH `/me` | Optional display_name/account_type/district/locale | Updated own profile |

Account type is customer/business_buyer. Seller ownership and administrator rights are separate database permissions. Authentication callbacks must use the configured trusted frontend URL. Either use token-hash email templates with `/auth/verify` or let the frontend Supabase SDK handle its normal callback/session flow.

## Public discovery and comparison

| Method and path | Query/body |
|---|---|
| GET `/categories` | Localized category labels |
| GET `/products` | `q`, `category_id`, `limit` (1-100), `offset` |
| GET `/products/:id` | Exact identity with pack variants |
| GET `/sellers` | Approved sellers and branches; limit/offset |
| GET `/offers` | product_id/category_id/seller_id, channel, district, max_age_hours; optional include_stale=true; limit/offset |
| GET `/offers/:id/history` | Immutable observations; limit/offset |
| GET `/products/:id/fair-price` | Required channel and district; optional max_age_hours |
| POST `/advisor/compare` | See `examples/compare.json` |

Offer package price and normalized base-unit price are different fields. Display pack name and base unit together. Every demo record is flagged. A benchmark with fewer than three distinct sellers returns `status: insufficient_data` and a null median.

The advisor returns:

- `complete_options` and `best_complete`: branches that cover every product and meet branch minimum spend.
- `incomplete_options`: explicitly missing products or minimum spend not met.
- `split_estimate`: explainable greedy candidate, supplier/branch counts, excess quantities and transport unknowns; can be null.
- `ranking_basis`: known delivered cost or goods only when transport is not comparable.
- `potential_savings`: only when an eligible named baseline branch was supplied. This is a quoted alternative, not a proven purchase saving.

The seed uses UUIDs. Existing frontend demo IDs map as follows; do not send strings like `sugar` directly to UUID endpoints:

| Frontend ID | Seed product ID | Base unit |
|---|---|---|
| sugar | 20000000-0000-4000-8000-000000000001 | kg |
| flour | 20000000-0000-4000-8000-000000000002 | kg |
| rice | 20000000-0000-4000-8000-000000000003 | kg |
| oil | 20000000-0000-4000-8000-000000000004 | L |
| pasta | 20000000-0000-4000-8000-000000000005 | kg |

The frontend's static model includes additional products and different synthetic supplier names/prices. Load canonical products from `/products` rather than assuming every static demo entry exists in the database.

## Seller and administration

| Method and path | Permissions |
|---|---|
| POST `/seller/apply` | Verified authenticated user; name, legal_name, tax_id, business_phone, website |
| GET `/seller/dashboard` | Own sellers, branches and current offers |
| POST `/seller/branches` | Approved seller owner or admin; seller_id/name/district/address/delivery_fee_uzs/minimum_order_uzs |
| POST `/seller/offers` | Approved seller owner or admin |
| PATCH `/seller/offers/:id` | Same ownership; valid_until required to explicitly reconfirm validity |
| GET `/admin/sellers` | Admin |
| PATCH `/admin/sellers/:id/verification` | Admin; verification_status approved/rejected/suspended |
| POST `/admin/categories` | Admin; slug, localized labels, sort order |
| POST `/admin/products` | Admin; category_id/name/brand/grade/origin/base_unit |
| POST `/admin/variants` | Admin; product_id/name/pack_quantity/barcode |
| GET `/admin/reports` | Admin; open reports |
| PATCH `/admin/reports/:id` | Admin; status reviewed/dismissed |
| GET `/admin/audit` | Admin; latest bounded audit records |
| POST `/admin/imports/preview` | Admin; rows array, max 200, returns per-row validation |
| POST `/admin/imports/publish` | Admin; reviewed=true plus valid rows; atomic publication |

Offer example (replace identifiers with approved seller-owned branch and canonical variant):

```json
{
  "branch_id": "50000000-0000-4000-8000-000000000001",
  "variant_id": "30000000-0000-4000-8000-000000000001",
  "channel": "wholesale",
  "price_uzs": 625000,
  "min_packs": 1,
  "step_packs": 1,
  "available_packs": 20,
  "availability": "available",
  "quantity_tiers": [{ "min_packs": 5, "price_uzs": 610000 }],
  "conditions": "Supplier-declared tax-inclusive pack price. Confirm delivery separately.",
  "source_url": null,
  "valid_until": "REPLACE_WITH_AN_ISO_TIMESTAMP_WITHIN_THE_NEXT_7_DAYS"
}
```

Actual seller credentials cannot edit demo branches unless separately granted membership. No public signup can approve a seller, add a membership or grant administrator rights. To withdraw an offer, PATCH status=withdrawn with a new valid_until. Product/pack identity changes require a new variant, preserving historical interpretation.

Imports accept JSON records already parsed from a spreadsheet. Binary XLSX/CSV upload parsing and OCR are not included in this backend version. Review source/identity matches and preview first; a single invalid database row rolls back the full publish transaction.

## Personal tools and interest

| Method and path | Purpose |
|---|---|
| GET `/favorites`; PUT/DELETE `/favorites/:productId` | Own saved products |
| GET `/lists`; POST `/lists`; DELETE `/lists/:id` | Own saved restock lists |
| GET `/alerts`; POST `/alerts`; DELETE `/alerts/:id` | Own target-price rules |
| POST `/alerts/evaluate` | Evaluate own rules, deduplicate notifications |
| GET `/notifications` | Refresh/read own alerts; limit/offset |
| PATCH `/notifications/:id/read` | Mark own notification read |
| POST `/reports` | offer_id + reason |
| POST `/interest` | product_id; interest, not a sale |
| GET `/market/signals` | Approved sellers/admins; seven-day interest, minimum five users |

Save list body: `name`, `channel`, optional `district`, `items` from the advisor request. Include `id` to replace an owned list transactionally. Alert body: `product_id`, `channel`, `district`, `target_unit_price_uzs`, optional `include_demo`.

User data is scoped by RLS even if a client bypasses this API and queries Supabase directly. Never reuse a mutable Supabase session client across different users; the backend creates a stateless client per request.
