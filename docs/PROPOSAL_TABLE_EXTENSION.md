# Extending `public.proposals` for the Full Automation Payload

This document explains why and how to extend the `public.proposals` table so it
can carry the **complete proposal-generation payload** (everything the form,
preview, generator, and webhook produce) and so the same row can later seed a
`public.projects` insert without losing data.

The companion SQL file is at [`sql/extend_proposals_table.sql`](./sql/extend_proposals_table.sql).
**All new columns are NULL-able / optional** — the migration is non-breaking.

---

## 1. Inputs being analysed

- **Current schema:** `public.proposals` (snapshot at top of this PR).
- **Target downstream schema:** `public.projects` (with its enums and triggers).
- **Source payload:** the JSON body sent to `POST /api/generate-proposal`
  (`app/api/generate-proposal/route.ts`), assembled from `ProposalContext`
  state plus values added inside the route (offer number, file URLs, etc.).

The shape of that payload, end to end:

```jsonc
{
  "clientInfo": {
    "clientNumber": "string (or email or company name)",
    "companyName": "string",
    "street": "string",
    "postalCode": "string",
    "city": "string",
    "country": "string"
  },
  "projectInfo": {
    "projectNumber": "string|null",
    "projectName": "string|null",
    "projectType": "EFH|DHH|MFH-3-5|MFH-6-10|MFH-11-15|Custom|null",
    "customProjectType": "string|null",
    "deliveryTime": "string e.g. '14-21 Werktage'",
    "deliveryDaysMin": 0,
    "deliveryDaysMax": 0,
    "offerValidUntil": "YYYY-MM-DD",
    "date": "YYYY-MM-DD",
    "MM": "01..12",
    "DD": "01..31",
    "year": "YYYY"
  },
  "services": [/* ServiceData[] — id, name, sub_name, quantity, unitPrice,
                  totalPrice, customPrice?, buildingType?, apartmentSize?,
                  projectType?, areaSize?, customDescription[],
                  modifiedDefaults[], pricingTiers[], link? */],
  "images":   [/* { title, description, fileName, fileSize, fileType,
                  imageData (base64) } */],
  "pricing":  {
    "subtotalNet":      0,
    "discountAmount":   0,
    "totalNetPrice":    0,
    "totalVat":         0,
    "totalGrossPrice":  0,
    "discount":         { "type": "percentage|fixed", "value": 0, "amount": 0,
                          "description": "string" }
  },
  "signature": { "signatureName": "Christopher Helm" },
  "terms":     { "p_one": "...", "p_two": "...", "...": "p_eight" }
}
```

The route additionally generates: `offerNumber`, `filename`, `pdfFilename`,
`clientFolderName`, and `fileUrls = { docxUrl, pdfUrl, storagePath }`.

---

## 2. Gap analysis vs. current `proposals` table

### A. Proposal payload data **not** captured as discrete columns today

| Payload field                                | Today's proposals table                           |
| -------------------------------------------- | ------------------------------------------------- |
| `clientInfo.clientNumber` (raw input)        | only the resolved `client_id` FK is stored        |
| `projectInfo.date`                           | not stored (only `created_at`)                    |
| `projectInfo.offerValidUntil`                | not stored                                        |
| `projectInfo.deliveryTime` (formatted text)  | only min/max integers                             |
| `projectInfo.customProjectType`              | not stored                                        |
| `pricing.subtotalNet` / `totalNetPrice` / `totalVat` | only inside the `pricing` JSONB blob       |
| `pricing.discount.amount` / `description`    | only inside `pricing` JSONB                       |
| `signature.signatureName`                    | not stored                                        |
| `terms.p_one … p_eight` (italic footnotes)   | not stored                                        |
| `images[].title` / `description` (full list) | only partial (`image_urls` JSONB), no SharePoint/Storage links per image |
| `fileUrls.docxUrl` / `pdfUrl` / `storagePath`| only inside `document_url` JSONB                  |
| Generated `filename`, `pdfFilename`          | not stored                                        |
| `imagesIncluded` (count)                     | not stored                                        |

### B. Fields needed for `public.projects` population — **none exist today**

The projects automation will need these on the proposal so the projects row
can be seeded without re-asking the user:

| Projects column            | Source / note                                        |
| -------------------------- | ---------------------------------------------------- |
| `project_id`               | Either generated upfront or populated on acceptance  |
| `project_manager`          | Required on `projects`; collected at proposal time   |
| `pm_type`                  | `public.pm_type` enum                                |
| `sales_person`             | text                                                 |
| `email_id`                 | FK to `emails(email_id)` — drives several triggers   |
| `person_id`                | FK to `persons(person_id)` (trigger may auto-set)    |
| `company_email`            | denormalized for quick lookup                        |
| `client_contact_name`      | text                                                 |
| `construction_type`        | `public.construction_type_values` enum               |
| `property_type`            | `public.property_type_values` enum                   |
| `questionnaire_received`   | `public.yes_no_values` enum                          |
| `deposit`                  | `public.yes_no_values` enum                          |
| `path_to_files`            | text — derivable from `document_url` but useful flat |

> `project_type` already lives on both tables (good — text on `proposals`,
> enum on `projects`). Cast on insert.

### C. Proposal lifecycle / status

Currently nothing tracks whether the proposal was *sent*, *accepted*,
*rejected*, or *expired*. Without this, you cannot know which proposal rows
should trigger the projects insert. We add:

- `proposal_status` (text + CHECK: draft / sent / viewed / accepted / rejected / expired)
- `initial_project_status` (`public.project_status_values`) — the value to use
  when the proposal-acceptance handler creates the projects row.

---

## 3. Design choice: discrete columns **plus** a `raw_payload` JSONB

**Discrete columns** for everything that's queried or joined (status, dates,
emails, FK ids, file URLs, totals). These get indexes and play nicely with
SQL.

**`raw_payload jsonb`** stores the entire request body verbatim. Two reasons:

1. **Lossless audit trail.** The proposal generator is template-driven; if
   the form gains a new field tomorrow, it lands in `raw_payload` without a
   migration. You can reprocess any historical proposal.
2. **Versioned schema escape hatch.** Pair it with `payload_version` (text)
   so you can branch logic if the JSON shape changes.

A GIN index on `raw_payload` keeps ad-hoc queries fast.

> The existing `services`, `pricing`, `image_urls`, `document_url` JSONB
> columns are kept as-is. The new discrete columns sit *alongside* them — no
> data is moved or deprecated by this migration.

---

## 4. The SQL extension

The script is idempotent (`ADD COLUMN IF NOT EXISTS`, guarded `ADD CONSTRAINT`,
`CREATE INDEX IF NOT EXISTS`) so it is safe to re-run.

```sql
-- See sql/extend_proposals_table.sql for the full file.

BEGIN;

ALTER TABLE public.proposals
  -- proposal-level metadata
  ADD COLUMN IF NOT EXISTS proposal_date           date,
  ADD COLUMN IF NOT EXISTS offer_valid_until       date,
  ADD COLUMN IF NOT EXISTS delivery_time_text      text,
  ADD COLUMN IF NOT EXISTS custom_project_type     text,
  ADD COLUMN IF NOT EXISTS signature_name          text,
  ADD COLUMN IF NOT EXISTS client_input_identifier text,
  -- discrete pricing breakdown
  ADD COLUMN IF NOT EXISTS subtotal_net            numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_net_price         numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_vat               numeric(12,2),
  ADD COLUMN IF NOT EXISTS vat_rate                numeric(5,2) DEFAULT 19.00,
  ADD COLUMN IF NOT EXISTS discount_description    text,
  ADD COLUMN IF NOT EXISTS discount_amount         numeric(12,2),
  -- generated file artifacts (flattened from document_url JSONB)
  ADD COLUMN IF NOT EXISTS docx_url                text,
  ADD COLUMN IF NOT EXISTS pdf_url                 text,
  ADD COLUMN IF NOT EXISTS storage_folder_path     text,
  ADD COLUMN IF NOT EXISTS docx_filename           text,
  ADD COLUMN IF NOT EXISTS pdf_filename            text,
  ADD COLUMN IF NOT EXISTS images_count            integer,
  -- editable italics / footnotes
  ADD COLUMN IF NOT EXISTS terms                   jsonb,
  -- fields needed to seed public.projects
  ADD COLUMN IF NOT EXISTS project_id              text,
  ADD COLUMN IF NOT EXISTS project_manager         text,
  ADD COLUMN IF NOT EXISTS pm_type                 public.pm_type,
  ADD COLUMN IF NOT EXISTS sales_person            text,
  ADD COLUMN IF NOT EXISTS email_id                bigint,
  ADD COLUMN IF NOT EXISTS person_id               bigint,
  ADD COLUMN IF NOT EXISTS company_email           text,
  ADD COLUMN IF NOT EXISTS client_contact_name     text,
  ADD COLUMN IF NOT EXISTS construction_type       public.construction_type_values,
  ADD COLUMN IF NOT EXISTS property_type           public.property_type_values,
  ADD COLUMN IF NOT EXISTS questionnaire_received  public.yes_no_values,
  ADD COLUMN IF NOT EXISTS deposit                 public.yes_no_values,
  ADD COLUMN IF NOT EXISTS initial_project_status  public.project_status_values,
  ADD COLUMN IF NOT EXISTS path_to_files           text,
  -- proposal lifecycle
  ADD COLUMN IF NOT EXISTS proposal_status         text,
  -- lossless audit-trail snapshot
  ADD COLUMN IF NOT EXISTS raw_payload             jsonb,
  ADD COLUMN IF NOT EXISTS payload_version         text;

-- guarded constraints / FKs / indexes are in the .sql file
COMMIT;
```

The full script also adds:
- `proposals_proposal_status_check` CHECK constraint
- `proposals_email_id_fkey` and `proposals_person_id_fkey` (ON DELETE SET NULL)
- B-tree indexes on `email_id`, `project_id`, `proposal_status`, `proposal_date`, `company_email`
- GIN index on `raw_payload`

---

## 5. How the API route should write the new columns

In `app/api/generate-proposal/route.ts` the `proposalDbData` object should be
extended (no breaking change to existing keys):

```ts
const proposalDbData = {
  // ... existing keys unchanged ...

  // proposal-level
  proposal_date:        projectInfo.date || null,
  offer_valid_until:    projectInfo.offerValidUntil || null,
  delivery_time_text:   projectInfo.deliveryTime || null,
  custom_project_type:  projectInfo.customProjectType || null,
  signature_name:       signature?.signatureName || null,
  client_input_identifier: clientInfo.clientNumber || null,

  // discrete pricing
  subtotal_net:         pricing.subtotalNet ?? null,
  total_net_price:      pricing.totalNetPrice ?? null,
  total_vat:            pricing.totalVat ?? null,
  discount_description: pricing.discount?.description || null,
  discount_amount:      pricing.discount?.amount ?? null,

  // file artifacts
  docx_url:             fileUrls?.docxUrl || null,
  pdf_url:              fileUrls?.pdfUrl  || null,
  storage_folder_path:  fileUrls?.storagePath || null,
  docx_filename:        filename,
  pdf_filename:         pdfFilename,
  images_count:         images.length,

  // terms
  terms:                terms || null,

  // lifecycle
  proposal_status:      'sent',          // or 'draft' if you split create vs. send

  // audit trail
  raw_payload:          data,
  payload_version:      '2026-05-07',
};
```

The projects-creation columns (`project_manager`, `pm_type`, `email_id`,
`construction_type`, etc.) can either be added to the form now, or filled in
by the acceptance step / n8n flow that creates the `projects` row.

---

## 6. Rollback

Every change is additive. To undo:

```sql
BEGIN;
ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS proposal_date,
  DROP COLUMN IF EXISTS offer_valid_until,
  DROP COLUMN IF EXISTS delivery_time_text,
  DROP COLUMN IF EXISTS custom_project_type,
  DROP COLUMN IF EXISTS signature_name,
  DROP COLUMN IF EXISTS client_input_identifier,
  DROP COLUMN IF EXISTS subtotal_net,
  DROP COLUMN IF EXISTS total_net_price,
  DROP COLUMN IF EXISTS total_vat,
  DROP COLUMN IF EXISTS vat_rate,
  DROP COLUMN IF EXISTS discount_description,
  DROP COLUMN IF EXISTS discount_amount,
  DROP COLUMN IF EXISTS docx_url,
  DROP COLUMN IF EXISTS pdf_url,
  DROP COLUMN IF EXISTS storage_folder_path,
  DROP COLUMN IF EXISTS docx_filename,
  DROP COLUMN IF EXISTS pdf_filename,
  DROP COLUMN IF EXISTS images_count,
  DROP COLUMN IF EXISTS terms,
  DROP COLUMN IF EXISTS project_id,
  DROP COLUMN IF EXISTS project_manager,
  DROP COLUMN IF EXISTS pm_type,
  DROP COLUMN IF EXISTS sales_person,
  DROP COLUMN IF EXISTS email_id,
  DROP COLUMN IF EXISTS person_id,
  DROP COLUMN IF EXISTS company_email,
  DROP COLUMN IF EXISTS client_contact_name,
  DROP COLUMN IF EXISTS construction_type,
  DROP COLUMN IF EXISTS property_type,
  DROP COLUMN IF EXISTS questionnaire_received,
  DROP COLUMN IF EXISTS deposit,
  DROP COLUMN IF EXISTS initial_project_status,
  DROP COLUMN IF EXISTS path_to_files,
  DROP COLUMN IF EXISTS proposal_status,
  DROP COLUMN IF EXISTS raw_payload,
  DROP COLUMN IF EXISTS payload_version;
COMMIT;
```

> Constraints and indexes are dropped automatically with their columns.
