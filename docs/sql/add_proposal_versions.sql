-- ─────────────────────────────────────────────────────────────────────────
-- Proposal versioning + a persisted "ready" lifecycle state.
--
-- Two things are established here:
--
--   1. `ready` becomes a legal `proposals.proposal_status`. The API and the
--      list-page badge styles already spoke that word; only the CHECK
--      constraint did not, so writing it failed at the database.
--
--   2. `public.proposal_versions` — an append-only history of a proposal.
--      A version is cut when a document is generated and when the proposal is
--      marked ready. The ready version is the one that carries `project_id`,
--      because the project number is what Lidia supplies at that moment: a
--      version with a project_id is a proposal that has become a project.
--
-- Idempotent and safe to re-run (IF NOT EXISTS / guarded DO blocks).
--
-- Companion doc: ../PROPOSAL_TABLE_EXTENSION.md
-- Runs after:    extend_proposals_table.sql
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Allow 'ready' (and keep 'expired') on proposals.proposal_status ───
-- Dropped and re-added rather than altered: a CHECK constraint has no ALTER
-- form, and dropping IF EXISTS keeps the script re-runnable.
ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_proposal_status_check;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_proposal_status_check
  CHECK (
    proposal_status IS NULL OR proposal_status = ANY (
      ARRAY['draft','ready','sent','viewed','accepted','rejected','expired']::text[]
    )
  );


-- ── 2. Version pointer on the proposal itself ───────────────────────────
-- Holds the highest version_no cut so far, so the next one can be allocated
-- without scanning proposal_versions.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 0;


-- ── 3. The version history ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_versions (
  id             bigserial PRIMARY KEY,

  -- Hangs off the surrogate key, not offer_number: offer_number is the
  -- business key everything else looks up by, but it is not guaranteed
  -- unique at the schema level, so it would not support a foreign key.
  -- Denormalised alongside so the history can be read without a join.
  proposal_id    bigint NOT NULL
                 REFERENCES public.proposals (id) ON DELETE CASCADE,
  offer_number   text NOT NULL,

  version_no     integer NOT NULL,

  -- What caused this version to be cut.
  --   create    — the proposal was generated for the first time
  --   regenerate— an edited proposal had its documents rebuilt
  --   ready     — marked ready; the project was created
  -- ('trigger' is a reserved word in Postgres, hence change_type.)
  change_type    text NOT NULL
                 CHECK (change_type IN ('create','regenerate','ready')),

  -- The distinguisher. NULL on every draft version; set on the version that
  -- created the project, and carried forward by versions cut after it.
  project_id     text,

  proposal_status text,

  -- The priced content as it stood at this version.
  services       jsonb,
  pricing        jsonb,
  total_price    numeric(12,2),

  -- The documents belonging to *this* version. Files are written to
  -- {client}/{offer}/v{n}/ so an older version keeps pointing at the
  -- document that was actually produced for it.
  document_url   jsonb,

  -- Lossless copy of the whole proposals row at this moment, so a version can
  -- be inspected (or restored) without depending on which columns existed.
  snapshot       jsonb,

  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT proposal_versions_unique_no UNIQUE (proposal_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal_id
  ON public.proposal_versions (proposal_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_offer_number
  ON public.proposal_versions (offer_number);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_project_id
  ON public.proposal_versions (project_id)
  WHERE project_id IS NOT NULL;


-- ── 4. Backfill v1 for proposals that predate versioning ────────────────
-- Without this the history panel is empty for everything created before
-- today. The synthetic v1 records the documents at their existing flat
-- storage path — those files are not moved, so the row keeps pointing at
-- what is really there.
INSERT INTO public.proposal_versions (
  proposal_id, offer_number, version_no, change_type, project_id,
  proposal_status, services, pricing, total_price, document_url, snapshot,
  created_by, created_at
)
SELECT
  p.id,
  p.offer_number,
  1,
  'create',
  p.project_id,
  COALESCE(p.proposal_status, 'draft'),
  p.services,
  p.pricing,
  p.total_price,
  p.document_url,
  to_jsonb(p),
  'backfill',
  COALESCE(p.created_at, now())
FROM public.proposals p
WHERE p.offer_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.proposal_versions v WHERE v.proposal_id = p.id
  );

-- Bring the pointer in line with what was just backfilled.
UPDATE public.proposals p
SET current_version = v.max_no
FROM (
  SELECT proposal_id, MAX(version_no) AS max_no
  FROM public.proposal_versions
  GROUP BY proposal_id
) v
WHERE v.proposal_id = p.id
  AND p.current_version < v.max_no;

COMMIT;
