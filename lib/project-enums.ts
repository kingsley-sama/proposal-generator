/**
 * Enum domains of `public.projects`, mirrored from the live database schema.
 *
 * These values are written to Postgres verbatim — an unlisted value is rejected
 * by the column's enum type. Keep this file as the single source: the Setup form
 * builds its dropdowns from it and `app/api/projects/route.ts` validates against
 * it, so the two can never drift apart.
 *
 * To re-check against the database:
 *   node --env-file=.env -e "const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_KEY;\
 *   fetch(u+'/rest/v1/',{headers:{apikey:k,Authorization:'Bearer '+k}}).then(r=>r.json()).then(j=>\
 *   Object.entries(j.definitions.projects.properties).forEach(([n,p])=>p.enum&&console.log(n,p.format,p.enum)))"
 *
 * Last verified: 2026-08-05.
 */

/** projects.pm_type — public.pm_type */
export const PM_TYPES = ['general', 'dedicated'] as const;

/** projects.project_type — public.project_type_values */
export const PROJECT_TYPES = ['Digital Makler', 'Flat rate', 'Standard'] as const;

/** projects.construction_type — public.construction_type_values */
export const CONSTRUCTION_TYPES = ['Existing', 'New'] as const;

/** projects.property_type — public.property_type_values */
export const PROPERTY_TYPES = ['Commercial', 'Residential'] as const;

/** projects.questionnaire_received and projects.deposit — public.yes_no_values */
export const YES_NO = ['Yes', 'No'] as const;

/** projects.first_or_next_project — public.first_next_project */
export const FIRST_NEXT_PROJECT = ['First', 'Next'] as const;

/** projects.project_status — public.project_status_values */
export const PROJECT_STATUSES = [
  'Offen',
  'Rechnung versandt',
  'Rechnung bezahlt',
  'Storniert',
  'Abgeschlossen',
  'Gratis',
  'Gutschein',
  'offen - Rechnung versandt',
  'Teil fehlt - Rechnung versandt',
  'Projekt vor 2023',
] as const;

/**
 * projects.project_manager — a plain `text` column in Postgres, *not* an enum
 * type, so the database will not reject an unlisted name. This list mirrors the
 * project managers offered in the dashboard; keeping it here makes the Setup
 * form's dropdown the single place a new manager has to be added.
 *
 * Historical rows also contain 'unknown'/'Unknown' and combined names
 * ('Viktoria und Vivien'), which are intentionally not offered for new projects.
 */
export const PROJECT_MANAGERS = [
  'Viktoria',
  'Sonia',
  'Vivien',
  'Ani',
  'Nesrin',
  'Aliyu',
] as const;

export type PmType = (typeof PM_TYPES)[number];
export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ConstructionType = (typeof CONSTRUCTION_TYPES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type YesNo = (typeof YES_NO)[number];
export type FirstNextProject = (typeof FIRST_NEXT_PROJECT)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectManager = (typeof PROJECT_MANAGERS)[number];

/**
 * German labels for the enum values shown in the Setup form. Only the label is
 * localised — the value stored in the database stays the enum member itself.
 */
export const PM_TYPE_OPTIONS: { value: PmType; label: string }[] = [
  { value: 'general', label: 'Allgemein' },
  { value: 'dedicated', label: 'Dediziert' },
];

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Flat rate', label: 'Pauschale (Flat rate)' },
  { value: 'Digital Makler', label: 'Digital Makler' },
];

export const CONSTRUCTION_TYPE_OPTIONS: { value: ConstructionType; label: string }[] = [
  { value: 'New', label: 'Neubau' },
  { value: 'Existing', label: 'Bestand' },
];

export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'Residential', label: 'Wohnimmobilie' },
  { value: 'Commercial', label: 'Gewerbeimmobilie' },
];

export const FIRST_NEXT_PROJECT_OPTIONS: { value: FirstNextProject; label: string }[] = [
  { value: 'First', label: 'Erstprojekt' },
  { value: 'Next', label: 'Folgeprojekt' },
];

export const YES_NO_OPTIONS: { value: YesNo; label: string }[] = [
  { value: 'Yes', label: 'Ja' },
  { value: 'No', label: 'Nein' },
];
