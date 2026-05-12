-- ─────────────────────────────────────────────────────────────────────────
-- Extend public.proposals to carry the full proposal-automation payload
-- and to hold the fields needed to seed public.projects later.
--
-- All new columns are NULL-able / optional. Script is idempotent and safe
-- to re-run (uses IF NOT EXISTS / guarded DO blocks).
--
-- Companion doc: ../PROPOSAL_TABLE_EXTENSION.md
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── New columns ──────────────────────────────────────────────────────────
ALTER TABLE public.proposals
  -- proposal-level metadata not currently captured discretely
  ADD COLUMN IF NOT EXISTS proposal_date           date,
  ADD COLUMN IF NOT EXISTS offer_valid_until       date,
  ADD COLUMN IF NOT EXISTS delivery_time_text      text,
  ADD COLUMN IF NOT EXISTS custom_project_type     text,
  ADD COLUMN IF NOT EXISTS signature_name          text,
  ADD COLUMN IF NOT EXISTS client_input_identifier text,

  -- discrete pricing breakdown (alongside the existing `pricing` jsonb)
  ADD COLUMN IF NOT EXISTS subtotal_net            numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_net_price         numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_vat               numeric(12,2),
  ADD COLUMN IF NOT EXISTS vat_rate                numeric(5,2) DEFAULT 19.00,
  ADD COLUMN IF NOT EXISTS discount_description    text,
  ADD COLUMN IF NOT EXISTS discount_amount         numeric(12,2),

  -- generated file artifacts (flattened from the existing `document_url` jsonb)
  ADD COLUMN IF NOT EXISTS docx_url                text,
  ADD COLUMN IF NOT EXISTS pdf_url                 text,
  ADD COLUMN IF NOT EXISTS storage_folder_path     text,
  ADD COLUMN IF NOT EXISTS docx_filename           text,
  ADD COLUMN IF NOT EXISTS pdf_filename            text,
  ADD COLUMN IF NOT EXISTS images_count            integer,

  -- editable italic footnotes / terms (terms.p_one … p_eight)
  ADD COLUMN IF NOT EXISTS terms                   jsonb,

  -- fields needed downstream to populate public.projects
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

  -- proposal lifecycle (separate from project_status)
  ADD COLUMN IF NOT EXISTS proposal_status         text,

  -- lossless audit-trail snapshot of the full request payload
  ADD COLUMN IF NOT EXISTS raw_payload             jsonb,
  ADD COLUMN IF NOT EXISTS payload_version         text;


-- ── CHECK constraint for proposal_status ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_proposal_status_check'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_proposal_status_check
      CHECK (
        proposal_status IS NULL OR proposal_status = ANY (
          ARRAY['draft','sent','viewed','accepted','rejected','expired']::text[]
        )
      );
  END IF;
END $$;


-- ── Foreign keys (ON DELETE SET NULL → keep proposal history intact) ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_email_id_fkey'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_email_id_fkey
      FOREIGN KEY (email_id) REFERENCES public.emails (email_id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_person_id_fkey'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.persons (person_id) ON DELETE SET NULL;
  END IF;
END $$;


-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proposals_email_id        ON public.proposals (email_id);
CREATE INDEX IF NOT EXISTS idx_proposals_project_id      ON public.proposals (project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_status ON public.proposals (proposal_status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_date   ON public.proposals (proposal_date);
CREATE INDEX IF NOT EXISTS idx_proposals_company_email   ON public.proposals (company_email);
CREATE INDEX IF NOT EXISTS idx_proposals_raw_payload_gin ON public.proposals USING GIN (raw_payload);

COMMIT;
