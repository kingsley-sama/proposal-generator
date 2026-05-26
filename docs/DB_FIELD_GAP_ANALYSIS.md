# DB Field Gap Analysis — `proposals` & `orders`

> Analysis of which DB columns the proposal generator currently fills, which it could fill from existing data with small wiring changes, and which require new inputs (form fields, lookups, or downstream automation).

Sources of truth inspected:
- `contexts/ProposalContext.tsx` — in-memory shape of the proposal
- `app/page.tsx` — form inputs
- `app/preview/page.tsx` — preview/edit and POST trigger
- `app/api/generate-proposal/route.ts` — server-side payload build + `save_proposal_detail`
- `lib/utils.js` — `save_proposal_detail`, `getClientDetails`, `uploadProposalFiles`

---

## 1. What the app currently collects (proposal payload)

| Group | Fields |
|---|---|
| `clientInfo` | `clientNumber`, `companyName`, `street`, `postalCode`, `city`, `country` |
| `projectInfo` | `projectNumber`, `projectName`, `projectType`, `customProjectType`, `deliveryTime` (text, e.g. "4–6 Werktage"), `deliveryDaysMin`, `deliveryDaysMax`, `offerValidUntil`, `date`, `MM`, `DD`, `year` |
| `services[]` | `id`, `name`, `quantity`, `unitPrice`, `totalPrice`, `customPrice?`, `buildingType?`, `apartmentSize?`, `projectType?`, `areaSize?`, `customDescription` |
| `pricing` | `subtotalNet`, `discountAmount`, `totalNetPrice`, `totalVat`, `totalGrossPrice`, `discount {type, value, amount, description}` |
| `signature` | `signatureName` |
| `images[]` | `title`, `description`, `fileName`, `fileSize`, `fileType`, `imageData` |
| `terms` | passed through to template but currently `{}` |
| Server-derived | `offerNumber` (generated), `storageFolderPath`, `docxUrl`, `pdfUrl`, `docxFilename`, `pdfFilename`, `imagesIncluded`, `dbClientData.client_id` (from Supabase lookup) |

---

## 2. `proposals` table — column-by-column status

Legend:
- **OK** — written today
- **WIRING** — data exists in the payload but isn't saved (or is buried inside `pricing`/`document_url` jsonb)
- **NEW FIELD** — needs a new form input, lookup, or external source
- **AUTO** — should be set automatically (defaults, triggers, or server logic)

| Column | Status | Notes / Source |
|---|---|---|
| `id` | OK | serial PK |
| `client_id` | OK | `dbClientData.client_id` from `getClientDetails` |
| `company_name` | OK | from form / DB fallback |
| `street_no` | OK | `clientInfo.street` |
| `city` | OK | form |
| `country` | OK | form, defaults to `'Deutschland'` |
| `postal_code` | OK | form |
| `project_number` | OK | form |
| `project_name` | OK | form |
| `project_type` | OK | form |
| `offer_number` | OK | server-generated |
| `delivery_time_min` | OK (buggy) | currently parsed from `projectInfo.deliveryDays` which **no longer exists** — context exposes `deliveryDaysMin`/`Max`. **Fix:** read `projectInfo.deliveryDaysMin` directly. |
| `delivery_time_max` | OK (buggy) | same bug as above |
| `services` | OK | jsonb |
| `pricing` | OK | jsonb |
| `discount_type` | OK | from `pricing.discount.type` |
| `discount_value` | OK (buggy) | currently reads `pricing.discount.amount` (a money string) instead of `pricing.discount.value` (the % or fixed amount). Two columns are conflated — see `discount_amount` row below. |
| `currency` | OK | hard-coded `'EUR'` |
| `total_price` | OK (buggy) | code does `pricing.totalGrossPrice?.replace(...)` but `totalGrossPrice` is a **number**, not a string — this will throw at runtime. **Fix:** assign the number directly. |
| `image_urls` | OK (partial) | currently saves `[{title, description}]` only; no actual URLs. Once images are uploaded to storage, add their URLs here. |
| `document_url` | OK | jsonb `{docx, pdf, folder}` |
| `created_at` | AUTO | DB default `now()` |
| `updated_at` | AUTO | DB default `now()` (consider a trigger to bump on UPDATE) |
| `proposal_date` | **WIRING** | `projectInfo.date` exists — map to `proposal_date` (cast to `date`). |
| `offer_valid_until` | **WIRING** | `projectInfo.offerValidUntil` exists in payload but isn't persisted. |
| `delivery_time_text` | **WIRING** | `projectInfo.deliveryTime` ("4–6 Werktage") is in the payload but not saved. |
| `custom_project_type` | **WIRING** | `projectInfo.customProjectType` already collected. |
| `signature_name` | **WIRING** | `signature.signatureName` collected, never saved. |
| `client_input_identifier` | **WIRING** | the raw value the user typed in the client lookup (`clientInfo.clientNumber` — may be a number, email, or company name per `getClientDetails`). Useful for audit/debug. |
| `subtotal_net` | **WIRING** | `pricing.subtotalNet` — promote to a top-level column for indexing/reporting. |
| `total_net_price` | **WIRING** | `pricing.totalNetPrice` |
| `total_vat` | **WIRING** | `pricing.totalVat` |
| `vat_rate` | **WIRING** | hard-coded `0.19` in `recalculatePricing`; persist as `19.00` (column default already 19.00 — fine to leave unless rate becomes configurable). |
| `discount_description` | **WIRING** | `pricing.discount.description` available; not saved. |
| `discount_amount` | **WIRING** | `pricing.discountAmount` (the **money** computed value) — distinct from `discount_value` (the **input** %/fixed amount). The current code stores the money string in `discount_value` and never writes `discount_amount`. Fix: `discount_value = discount.value` (raw 10 / 50 / etc.), `discount_amount = pricing.discountAmount`. |
| `docx_url` | **WIRING** | `fileUrls.docxUrl` exists — promote out of `document_url` jsonb to its own column. |
| `pdf_url` | **WIRING** | same; `fileUrls.pdfUrl`. |
| `storage_folder_path` | **WIRING** | `fileUrls.storagePath` exists. |
| `docx_filename` | **WIRING** | constructed locally (`filename`); not saved. |
| `pdf_filename` | **WIRING** | constructed locally (`pdfFilename`); not saved. |
| `images_count` | **WIRING** | `images.length` available. |
| `terms` | **WIRING** | passed through but currently `{}`; persist whatever the template renders so later edits aren't lost. |
| `raw_payload` | **WIRING** | save the whole request body for audit/replay. |
| `payload_version` | **WIRING** | introduce a constant like `'1.0.0'` in the generator and bump on schema changes. |
| `path_to_files` | **WIRING** | same as `storage_folder_path` or a local mirror — clarify intent. |
| `proposal_status` | AUTO | default to `'draft'`. Set `'sent'` when n8n webhook returns 200, `'viewed'` from a recipient tracking pixel, `'accepted'/'rejected'` from a customer reply flow. |
| `project_id` | **NEW FIELD** | text FK into `projects(project_id)`. The form has `projectNumber` (a free-text human reference) but not the canonical `project_id`. Either (a) generate it server-side and upsert a `projects` row, or (b) require the automation to look up / create the project first and pass the id in. |
| `project_manager` | **NEW FIELD** | not collected. Add a PM selector to the form, or assign from rules (round-robin, by region, by service type). |
| `pm_type` | **NEW FIELD** | enum `pm_type`. Same source as `project_manager` — likely a derived/joined value once PM is set. Trigger could fill it. |
| `sales_person` | **NEW FIELD** | not collected. Could default to the logged-in user once auth is wired (note: there's a `users` table in `lib/supabase.ts`). |
| `email_id` | **NEW FIELD** | FK to `emails(email_id)`. When the proposal is triggered from an inbound email automation, pass the originating email id. The lookup in `getClientDetails` already touches the `emails` table — surface that id. |
| `person_id` | **NEW FIELD** | FK to `persons(person_id)`. Need a person-level lookup (the current lookup only resolves to a **company**). Add `contact_email`/`contact_name` inputs and resolve to a `person_id`. |
| `company_email` | **WIRING-ish** | not on the form, but the lookup already queries by email. If the user types an email into the client lookup, save it here. Otherwise add a "primary contact email" form field. |
| `client_contact_name` | **NEW FIELD** | add a contact-name field to the client section (the salutation in the letter currently hard-codes nothing — also useful for `Sehr geehrte/r …`). |
| `construction_type` | **NEW FIELD** | enum `construction_type_values`. Add a dropdown (likely Neubau / Bestand / …). |
| `property_type` | **NEW FIELD** | enum `property_type_values`. Distinct from `project_type` ("EFH", "MFH-3-5", …) which is the **building** form factor — clarify which is which with the data team. |
| `questionnaire_received` | **NEW FIELD** | enum yes/no. Add a checkbox. |
| `deposit` | **NEW FIELD** | enum yes/no. Add a checkbox. |
| `initial_project_status` | **NEW FIELD** | enum `project_status_values`. Default at creation (e.g. `'lead'` / `'offer_sent'`). |

### Quick fixes (bugs in the current INSERT)

These don't require schema changes — just edits to `app/api/generate-proposal/route.ts`:

1. **`delivery_time_min/max`** — `projectInfo.deliveryDays` doesn't exist on the context; use `deliveryDaysMin` / `deliveryDaysMax`.
2. **`total_price`** — `totalGrossPrice` is a number; calling `.replace()` on it throws. Assign directly.
3. **`discount_value` vs `discount_amount`** — store `discount.value` (raw input) in `discount_value` and `pricing.discountAmount` (computed money) in `discount_amount`.
4. **`image_urls`** — currently stores `{title, description}` placeholders; either rename the column intent or upload images to storage and store real URLs.

---

## 3. `orders` table — gap to "auto-create from proposal"

The `orders` table represents a **single product/service line per row** (it has `product`, `quantity`, `unit_price`, `supplier`, individual delivery dates, etc.). The proposal carries an **array of services**. So "creating orders from a proposal" means **fanning out one order row per service** (or per service quantity, depending on business rules).

Several triggers already auto-fill fields from `project_id`:
- `trg_autofill_person_id`, `trg_orders_set_pm_from_project`, `trigger_set_pm_type`, `trg_orders_set_financial_fields`, `trg_orders_set_order_id`, `trg_orders_set_product_from_name`.

So if you provide `project_id` + `product_name` + `quantity` + `unit_price`, **a lot of the table fills itself**.

| Column | Status | Notes |
|---|---|---|
| `id` | AUTO | identity |
| `project_id` | **NEW FIELD (critical)** | FK to `projects(project_id)`. Blocker — see `proposals.project_id` above. |
| `order_id` | AUTO | filled by `trg_orders_set_order_id` |
| `order_number` | **NEW FIELD** | distinct from `order_id`? Confirm with data team — may be a customer-facing number. |
| `net_sum` | AUTO | from `trg_orders_set_financial_fields` (likely `quantity * unit_price`) |
| `gross_sum` | AUTO | same trigger |
| `db_1`, `profit_margin`, `roi` | AUTO/**NEW** | from financial fields trigger if it computes from `cost`; otherwise needs `cost` input |
| `ap_epcs_invoicing` | **NEW FIELD** | invoicing routing label — not in proposal scope |
| `comments` | optional | could carry the service's `customDescription` summary |
| `order_type` | **NEW FIELD** | enum `order_type`. Probably constant per proposal-origin (e.g. `'sale'`) |
| `product_type` | **NEW FIELD** | enum `product_type`. Derivable from the service id (e.g. `interior` → `'visualization'`) once a mapping table exists |
| `sale_type` | **NEW FIELD** | enum `sale_type`. Likely constant for proposal-origin orders |
| `quantity` | OK | `service.quantity` |
| `product` | OK-ish | free-text — `service.name` works; but **`product_name`** below is the FK |
| `unit_price` | OK | `service.unitPrice` (parse to numeric) |
| `supplier` | **NEW FIELD** | unknown at proposal time — assigned during fulfilment |
| `cost` | **NEW FIELD** | supplier cost — assigned during fulfilment |
| `date_information_complete` | **NEW FIELD** | post-proposal, when full project brief is in |
| `due_delivery_date` | **WIRING** | derivable: `proposal_date + delivery_time_max` business days. Worth computing on insert. |
| `delivery_1_date`…`delivery_4_date` | **NEW FIELD** | tranche delivery — fulfilment data |
| `delay_first_delivery`, `delay_first_revision`, `delay_second_revision` | AUTO | default `0` |
| `product_name` | **NEW MAPPING** | FK to `product_codes(name)`. Needs a **service-id → product_codes.name** mapping table. This is the linchpin that lets `trg_orders_set_product_from_name` populate `product`. Build this mapping in `lib/services.ts` (add a `productCode` field per service) or as a DB lookup. |
| `PM` | AUTO | from project trigger |
| `pm_type` | AUTO | from project trigger |
| `person_id` | AUTO | from project trigger |
| `company_name` | AUTO | from project trigger |
| `client_rating` | **NEW FIELD** | enum — out of scope for proposal generation |
| `questionnaire_received` | **NEW FIELD** | same source as the proposal copy |
| `deposit` | **NEW FIELD** | same source as the proposal copy |
| `supplier_payment` | **NEW FIELD** | fulfilment-time boolean |
| `project_completion_date` | **NEW FIELD** | fulfilment-time |
| `click_up_task_link` | **NEW FIELD** | fulfilment-time |
| `discount` | **WIRING** | derivable per line from the proposal-level discount, **only if** discounts are applied per-line. Today the discount is global. Decide: (a) split the global discount proportionally across orders, or (b) keep `orders.discount = null` and only show discount on the proposal. |
| `created_at`, `updated_at` | AUTO | defaults / `trg_set_updated_at` |

### What's needed to **automate orders from proposals**

In rough priority order:

1. **Resolve `project_id`** — either generate one in the generate-proposal route (insert into `projects` first, get back the id) or require the upstream automation to pass it in.
2. **Service → `product_codes.name` mapping** — without this the FK fails. Add `productCode: string` per entry in `lib/services.ts` (or a separate `lib/service_product_map.ts`), and confirm every code exists in `product_codes`.
3. **Decide order granularity** — one order per service line, or one order per (service, quantity)? Affects how you split `quantity` and `unit_price`.
4. **Decide who creates orders** — server-side at proposal generation (simplest, but means orders are "open" before the customer signs), or only after `proposal_status = 'accepted'` (recommended).
5. **Handle the global discount** — pick a strategy (proportional split / keep null / discount the largest line only).

---

## 4. Recommended minimum schema-aware payload (v1)

The cheapest thing to ship first: **change `app/api/generate-proposal/route.ts` so `proposalDbData` populates everything that's already in the payload**, and stash the rest in `raw_payload`.

```js
const proposalDbData = {
  // identity
  client_id: dbClientData ? parseInt(dbClientData.client_id) || null : null,
  client_input_identifier: clientInfo.clientNumber || null,
  company_name: clientInfo.companyName,
  // address
  street_no: clientInfo.street,
  city: clientInfo.city,
  country: clientInfo.country || 'Deutschland',
  postal_code: clientInfo.postalCode,
  // project
  project_number: projectInfo.projectNumber || null,
  project_name: projectInfo.projectName || null,
  project_type: projectInfo.projectType || null,
  custom_project_type: projectInfo.customProjectType || null,
  // offer
  offer_number: generatedOfferNumber,
  proposal_date: projectInfo.date || null,         // ensure ISO yyyy-mm-dd
  offer_valid_until: projectInfo.offerValidUntil || null,
  delivery_time_min: projectInfo.deliveryDaysMin ?? null,
  delivery_time_max: projectInfo.deliveryDaysMax ?? null,
  delivery_time_text: projectInfo.deliveryTime || null,
  // money (top-level numerics, no string parsing)
  currency: 'EUR',
  vat_rate: 19.00,
  subtotal_net: pricing.subtotalNet,
  total_net_price: pricing.totalNetPrice,
  total_vat: pricing.totalVat,
  total_price: pricing.totalGrossPrice,
  discount_type: pricing.discount?.type || null,
  discount_value: pricing.discount?.value ?? null,        // raw input (10, 50, …)
  discount_amount: pricing.discountAmount ?? null,        // computed money
  discount_description: pricing.discount?.description || null,
  // payload jsonb
  services,
  pricing,
  terms: terms || {},
  // files
  docx_url: fileUrls?.docxUrl || null,
  pdf_url: fileUrls?.pdfUrl || null,
  storage_folder_path: fileUrls?.storagePath || null,
  docx_filename: filename,
  pdf_filename: pdfFilename,
  images_count: images.length,
  image_urls: imageMetadata?.map((img) => ({ title: img.title, description: img.description })) || [],
  document_url: fileUrls ? { docx: fileUrls.docxUrl, pdf: fileUrls.pdfUrl, folder: fileUrls.storagePath } : null,
  // people / signature
  signature_name: signature?.signatureName || 'Christopher Helm',
  // status + audit
  proposal_status: 'draft',
  raw_payload: data,
  payload_version: '1.0.0',
};
```

Everything still null after this change (`project_id`, `project_manager`, `pm_type`, `sales_person`, `email_id`, `person_id`, `company_email`, `client_contact_name`, `construction_type`, `property_type`, `questionnaire_received`, `deposit`, `initial_project_status`, `path_to_files`) is the **real list of new inputs** needed before the table is fully driven by the generator.

---

## 5. Suggested new form additions (v2)

Grouped to minimise UX churn:

**Client section**
- `client_contact_name` — single line
- `company_email` — single line (and use it to drive the `getClientDetails` lookup so `client_input_identifier` and `company_email` are coherent)

**Project section**
- `construction_type` — dropdown (enum)
- `property_type` — dropdown (enum)  *(confirm with data team how this differs from existing `projectType`)*
- `project_manager` + (derived) `pm_type` — dropdown of users
- `sales_person` — dropdown of users (default to logged-in)
- `questionnaire_received` — yes/no toggle
- `deposit` — yes/no toggle
- `initial_project_status` — dropdown (enum), default sensible value

**Hidden / automation-only**
- `email_id` — passed in via query string when launched from an n8n email automation
- `person_id` — resolved server-side once `client_contact_name` + `company_email` are present
- `project_id` — generated server-side (`projects` insert first)

---

## 6. Open questions for the data team

1. Is `project_type` ("EFH", "MFH-3-5", …) the same dimension as `property_type` (`property_type_values` enum), or are these different things? The current form treats it like building form factor.
2. Should orders be created at proposal-time (`status='draft'`) or only on `proposal_status='accepted'`?
3. For a multi-service proposal, do we want **one order per service** or **one order with all services rolled up**? The schema's per-row product/quantity/price strongly implies the former.
4. Is `order_number` user-facing and distinct from the trigger-assigned `order_id`?
5. What is the canonical mapping from `services.ts` ids (e.g. `interior`, `exterior-bird`, `3d-floorplan`) to `product_codes.name`?
6. Is `path_to_files` meant to be the Supabase Storage path (`storage_folder_path`), a network drive path, or something else?
