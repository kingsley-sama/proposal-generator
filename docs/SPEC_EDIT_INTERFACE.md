# Product Design Specification — Updated Proposal Generator Interface

**Status:** Draft for review
**Date:** 2026-07-23
**Author:** Product design (Claude)
**Scope:** Replaces the current multi-page authoring flow with a two-step interface: a **Proposal Setup** form (Step 1) and a **Live Edit view** built on the existing preview screen (Step 2). The legacy edit page at `app/proposals/[offerNumber]/edit/page.tsx` is removed.

---

## 1. Goals & Rationale

**Problem.** Today, proposal data is entered in a long form (`app/generator/page.tsx`), previewed on a separate page, and — for saved proposals — edited on a third, disconnected page (`app/proposals/[offerNumber]/edit/`) that keeps its own local state and does not use `ProposalContext`. Users edit in one place and verify in another, and the two edit surfaces can disagree.

**Solution.** Make the document itself the editor:

1. **Step 1 — Proposal Setup:** a short, dedicated form that captures only the required metadata a proposal must have before it can be marked ready.
2. **Step 2 — Live Edit:** the existing preview page, extended into the single dedicated editing surface. All content (services, quantities, prices, descriptions) is edited in place on the rendered proposal, with totals recalculating in real time.

There is exactly **one** editing surface. Creating a new proposal and editing a saved one both land on the same Live Edit view.

**Non-goals.** No changes to document generation (`lib/template-docx-generator.js`), the Word template, VAT logic, or the pricing tier engine.

---

## 2. Information Architecture

```
/                          → Landing / entry (unchanged)
/proposals                 → Proposal list (unchanged; "Edit" now deep-links to /edit)
/setup                     → Step 1: Proposal Setup form   (NEW)
/edit                      → Step 2: Live Edit view         (extends current /preview)
```

- `app/proposals/[offerNumber]/edit/page.tsx` — **deleted.** The "Edit" action on the proposals list loads the saved proposal into `ProposalContext` and routes to `/edit`.
- `app/preview/page.tsx` — becomes the Live Edit view (renamed/moved to `/edit`; `/preview` redirects to `/edit` so old links keep working).
- `app/generator/page.tsx` — retired as the primary entry. Everything it collected that is *not* in the Setup form (images, discount, signature) moves into the Live Edit view; see §4.5.

State continues to flow through `contexts/ProposalContext.tsx` (single source of truth, localStorage auto-save every 5 s). Both steps read and write the same context — no prop drilling, no duplicate state.

---

## 3. Step 1 — Proposal Setup (`/setup`)

### 3.1 Purpose

Collect the minimum required metadata before a proposal can be **marked as ready**. This page is deliberately short — one screen, no scrolling on a 1280×800 laptop.

### 3.2 Layout

Single centered card (max-width ≈ 720 px), three grouped sections with a sticky footer action bar.

```
┌──────────────────────────────────────────────────────┐
│  Proposal Setup                        Step 1 of 2   │
├──────────────────────────────────────────────────────┤
│  CLIENT                                              │
│  Client ID [______] 🔍   Contact person [__________] │
│  Contact email [_____________________]               │
│                                                      │
│  PROJECT                                             │
│  Project ID [______]     Project name [___________]  │
│  Project type [▾]        Property type [▾]           │
│  Project manager [__________]  PM type [▾]           │
│                                                      │
│  OFFER                                               │
│  Salesperson [Lidia    ]   Date [2026-07-23]         │
│  Partial invoice  (•) Yes  ( ) No                    │
│    └ if Yes: Split [▾ e.g. 50 % / 50 %]  Note [____] │
├──────────────────────────────────────────────────────┤
│            [ Save draft ]   [ Mark as Ready → ]      │
└──────────────────────────────────────────────────────┘
```

### 3.3 Fields

All fields below are **required** for "Mark as Ready". "Save draft" imposes no validation.

| # | Field | Control | Default / behavior |
|---|-------|---------|--------------------|
| 1 | Client ID | Text input + lookup button | On entry/blur, calls existing `GET /api/client-lookup/{clientNumber}`; on a hit, auto-fills company address (existing `clientInfo`) and suggests contact person/email from the `contacts`/`emails` tables. Mock-data fallback applies as today. |
| 2 | Project ID | Text input | Maps to `projectInfo.projectNumber`. |
| 3 | Project name | Text input | Maps to `projectInfo.projectName`. |
| 4 | Project type | Select | Existing project-type options (with "Custom" free-text, as in current form → `customProjectType`). |
| 5 | Property type | Select | New field. Options: Einfamilienhaus, Mehrfamilienhaus, Wohnanlage, Gewerbe, Sonstiges (final list to be confirmed with sales). Pre-selects building-type variants in pricing where applicable. |
| 6 | Project manager — name | Text input | New field. |
| 7 | Project manager — type | Select | New field. Options: Internal, External, Client-side (to be confirmed). |
| 8 | Contact person — name | Text input | Auto-suggested from client lookup; editable. |
| 9 | Contact person — email | Email input | Validated as syntactically correct email. Auto-suggested from lookup. |
| 10 | Salesperson | Text input (combobox with known salespeople) | **Defaults to "Lidia" when Lidia is the logged-in user** (matched against the authenticated session from `app/(auth)`); otherwise defaults to the logged-in user's own name, editable in both cases. |
| 11 | Date | Date picker | Defaults to today (`projectInfo.date` already does this). Editable. |
| 12 | Partial invoice | Yes/No toggle + conditional detail | If **Yes**: a split select (e.g. 50/50, 30/70, custom %) and an optional note. If **No**: detail fields hidden and not required. The toggle itself must be explicitly answered — it starts unset, so an untouched form does not silently pass as "No". |

### 3.4 "Mark as Ready" — validation behavior

Single primary action. On click:

1. All 12 required fields are validated at once (not stop-at-first).
2. **If any field is incomplete:**
   - The button does **not** navigate.
   - Every invalid field gets an inline error state: red border + short message under the field ("Client ID is required", "Enter a valid email address").
   - A summary banner appears above the footer: *"3 fields need attention before this proposal can be marked as ready"* — each item is a link that scrolls to and focuses the field.
   - The first invalid field receives keyboard focus.
   - Errors clear per-field as soon as the field becomes valid (validate-on-blur after first submit attempt).
3. **If all fields are valid:**
   - The setup data is written to `ProposalContext`, the proposal status becomes `ready` (persisted via the existing `PATCH /api/proposals/[offerNumber]/status` route once the proposal has an offer number), and the user is routed to `/edit`.

"Save draft" saves whatever is filled (status `draft`) and stays on the page with a saved confirmation (reuse `AutoSaveIndicator`).

A proposal that has not passed "Mark as Ready" can still be opened in `/edit` (banner: *"Draft — complete the setup form to mark this proposal as ready"*, linking back to `/setup`), but the **Generate document** action on the edit view is disabled until the proposal is ready. This keeps the hard gate on the deliverable without trapping users in the form.

---

## 4. Step 2 — Live Edit view (`/edit`)

### 4.1 Principle

This is the **current preview page, promoted to the dedicated edit page** — not a new build. It keeps everything the preview already does (in-place `contentEditable` editing of quantities, prices, and descriptions via `EditableSpan`; live totals via `recomputePricingLive`; bullet/bulk description editing) and adds the capabilities below. The legacy edit page is scrapped; its save/regenerate responsibilities move here.

All edits write to `ProposalContext` and are reflected **in real time**: totals, VAT (19 %), gross price, and delivery time (`utils/deliveryTime.ts`) update immediately on every change, with no "apply" or "refresh" step. The context's existing 5-second auto-save continues to persist to localStorage.

### 4.2 Header bar (sticky)

```
┌──────────────────────────────────────────────────────────────┐
│ ← Setup   Angebot AN-2026-0142 · Musterbau GmbH   ● Saved    │
│                       [ + Add product ]  [ Generate .docx ]  │
└──────────────────────────────────────────────────────────────┘
```

- **← Setup** returns to Step 1 with all values intact (same context).
- Auto-save status chip (existing `autoSaveStatus`: idle / saving / saved).
- **+ Add product** — see §4.3.
- **Generate .docx** — existing generate action; disabled with tooltip *"Complete the setup form first"* until the proposal is marked ready (§3.4).

### 4.3 Add product

Clicking **+ Add product** opens a panel (right-side drawer on desktop, full-screen sheet on mobile) listing **all 21 services** from `lib/services.ts`, in their defined `order`, each row showing:

- Service name (e.g. *3D-Außenvisualisierung Bodenperspektive*)
- Base price from `lib/service_description.js`
- An **Add** button — or a "Added ✓" state if the service is already on the proposal (services are unique per proposal today; `addService` ignores duplicates)

Behavior:

- A search field filters the list by name.
- **Add** calls the existing `addService(serviceId)`: the service appears in the document table immediately at its canonical position, with quantity 1, default price, and its default description parsed into editable bullets — exactly the current context behavior.
- The drawer stays open so multiple products can be added in one pass; closing it requires no confirmation (adds are already applied live).
- After adding, the newly inserted section briefly highlights and scrolls into view so the user sees where it landed.
- Services with variants (`hasBuildingType` / `hasApartmentSize` / `hasProjectType`) get their variant pre-selected from the Setup form's property/project type where possible, and remain changeable inline in the table row.

### 4.4 Delete a service

Every service section in the proposal table gets a **delete control**:

- A trash icon button at the right edge of the service's header row. Invisible-until-hover on desktop (to keep the document looking like the document), always visible on touch devices.
- Clicking it asks for a lightweight inline confirmation on the button itself ("Delete? **Yes** / No" — no modal), because the action discards any custom description/price edits on that service.
- Confirming calls the existing `removeService(serviceId)`; the section disappears and subtotal, discount amount, VAT, gross total, and delivery time all recalculate instantly.
- An **Undo** toast ("*3D-Grundriss* removed — Undo") is shown for 6 seconds and restores the service *with its previous edits* (snapshot the `ServiceData` before removal; plain `addService` would only restore defaults).

Deleting the last remaining service is allowed, but the empty state replaces the table: *"No products yet — add one to build the proposal"* with an inline **+ Add product** button, and validation (`getValidationErrors`) continues to require ≥ 1 service before generation.

### 4.5 Content absorbed from the old form/edit pages

So the generator form and legacy edit page can be fully retired, the Live Edit view also hosts, in-document where they appear in the output:

- **Discount** — already editable on the preview; unchanged.
- **Images** — the image section (`ImageUploadSection`) renders at its document position with add/remove controls.
- **Signature name** — inline editable field in the signature block (defaults as today).
- **Offer validity date & delivery time** — delivery time stays auto-calculated (read-only, updates live as services change); validity date is inline-editable.
- **Save to database / regenerate** — the legacy edit page's persistence actions (`PUT /api/proposals/[offerNumber]`, regenerate document) become part of the Generate flow here for saved proposals.

### 4.6 Real-time contract

| User action | Immediate effect (no reload, no apply step) |
|---|---|
| Edit quantity/price inline | Row total + all summary totals update while typing (existing `recomputePricingLive`); tier pricing from `useServicePricing` re-applies on blur |
| Add product | Section appears in document order; totals + delivery time update |
| Delete product | Section removed; totals + delivery time update; undo available |
| Edit description bullets | Document text updates in place |
| Change discount | Discount line + net/VAT/gross update |
| Any change | Auto-saved to localStorage within 5 s; status chip reflects it |

---

## 5. Data model changes

`ProposalContext` gains the new required setup fields (all persisted through the existing storage path and passed into the generator payload):

```ts
// ProjectInfo — add:
projectManagerName: string;
projectManagerType: string;      // 'internal' | 'external' | 'client'
propertyType: string;

// ClientInfo — add:
contactPersonName: string;
contactPersonEmail: string;

// New top-level slice:
offerMeta: {
  salespersonName: string;       // defaulted from auth session; 'Lidia' when she is logged in
  partialInvoice: {
    answered: boolean;           // toggle explicitly set
    enabled: boolean;
    split?: string;              // e.g. '50/50'
    note?: string;
  };
};
```

`getValidationErrors()` is extended to cover all §3.3 fields; `isValid()` remains the gate used by "Mark as Ready". The proposals table/status API gains no new statuses — `draft` → `ready` uses the existing status route.

---

## 6. Removal / migration checklist

| Item | Action |
|---|---|
| `app/proposals/[offerNumber]/edit/page.tsx` | **Delete.** Proposals-list "Edit" loads the row into `ProposalContext` and routes to `/edit`. |
| `app/preview/page.tsx` | Move/extend to `/edit`; `/preview` becomes a redirect. |
| `app/generator/page.tsx` | Retire as entry point once §4.5 items are absorbed; entry flow becomes `/setup` → `/edit`. |
| `lib/pure-docx-generator.js` | Untouched (already deprecated). |
| Docs | Update `docs/ARCHITECTURE.md` and `docs/STATE_MANAGEMENT.md` flow diagrams. |

---

## 7. Open questions

1. Final option lists for **Property type** and **Project manager type** (placeholder lists in §3.3 need sales confirmation).
2. Partial invoice: fixed split presets vs. free percentage input — spec assumes presets + custom.
3. Should "Mark as Ready" also require ≥ 1 service, or is service presence enforced only at generation time (current spec: generation time, since products are added in Step 2)?
4. Whether salesperson identity should come from the Supabase session user record or a hardcoded user→name map (depends on what `app/(auth)` stores today).
