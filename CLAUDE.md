# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on http://localhost:3000
npm run build     # Production build
npm run start     # Start production server on port 3003
npm run lint      # Run ESLint
```

There are no tests configured in this project.

## Architecture Overview

This is a **Next.js 16** app for generating German-language property visualization proposals (Angebote) as `.docx` Word files.

### Core Flow

```
app/page.tsx (form)
  → ProposalContext (shared state + localStorage auto-save every 5s)
  → app/preview/page.tsx (editable preview)
  → POST /api/generate-proposal
  → lib/template-docx-generator.js
  → templates/proposal-template.docx (Word template with placeholders)
  → output/{client_folder}/ (generated .docx files)
```

### State Management

**`contexts/ProposalContext.tsx`** is the single source of truth for all form data. All components and pages consume it via `useProposal()`. It auto-saves to `localStorage` under the key `proposalFormData`. The preview page (`app/preview/page.tsx`) also reads from this context — both pages share the same data without prop drilling.

### Document Generation

**Use `lib/template-docx-generator.js`** (~200 lines) — it replaces the legacy `lib/pure-docx-generator.js` (1730 lines, deprecated, do not modify).

The generator uses `docxtemplater` to fill placeholders in `templates/proposal-template.docx`. Placeholder syntax and available data are documented in `templates/TEMPLATE_GUIDE.md`. To inspect what data is available during generation, run `node templates/show-data-structure.js`.

### Services

21 service types are defined in `lib/services.ts`. Pricing logic lives in `hooks/useServicePricing.ts` (quantity-based tiers, building type variants, custom price overrides). Service descriptions and pricing tiers are in `lib/service_description.js`.

### API Routes

All API routes use `runtime: 'nodejs'` (required for file system access):

- `POST /api/generate-proposal` — generates and saves the .docx file
- `GET /api/client-lookup` — looks up client from Supabase (works without Supabase using mock data)
- `GET /api/next-offer-number` — reads/increments `output/offer_counter.json`
- `GET /api/config` — returns configuration constants from `lib/proposal-config.js`

### Key Architectural Notes

- **Supabase** (`@supabase/supabase-js`) is optional. Client lookup falls back to mock data if credentials are absent. Tables used: `companies`, `contacts`, `emails`.
- **VAT** is hardcoded at 19% throughout the pricing calculations.
- **Delivery time** is auto-calculated from selected services via `utils/deliveryTime.ts`.
- The `next.config.ts` sets `serverExternalPackages: ['docx', 'image-size']` and `serverActions.bodySizeLimit: '50mb'` for large image uploads.
- Generated files go to `output/{client_id}_{company_name}/` or a timestamp-based folder if no client ID exists.

### Docs

- `docs/ARCHITECTURE.md` — system diagrams and data flow
- `docs/STATE_MANAGEMENT.md` — context usage patterns
- `templates/TEMPLATE_GUIDE.md` — full placeholder reference for the Word template
