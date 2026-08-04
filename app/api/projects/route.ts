import { NextResponse } from 'next/server';
// @ts-ignore
import { resolveEmailId, upsertProject } from '@/lib/utils';

export const runtime = 'nodejs';

// Enum domains of public.projects. Kept here so an unexpected value fails with
// a readable message instead of a raw Postgres "invalid input value" error.
const PROJECT_TYPES = ['Digital Makler', 'Flat rate', 'Standard'];
const CONSTRUCTION_TYPES = ['Existing', 'New'];
const PROPERTY_TYPES = ['Commercial', 'Residential'];
const YES_NO = ['Yes', 'No'];
const PM_TYPES = ['general', 'dedicated'];
const DEFAULT_PROJECT_STATUS = 'Offen';

/**
 * The Setup form collects a granular German property type; `projects`
 * only distinguishes commercial from residential.
 */
const PROPERTY_TYPE_MAP: Record<string, string> = {
  einfamilienhaus: 'Residential',
  'doppelhaushälfte': 'Residential',
  mehrfamilienhaus: 'Residential',
  wohnanlage: 'Residential',
  gewerbe: 'Commercial',
};

const toPropertyType = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (PROPERTY_TYPES.includes(trimmed)) return trimmed;
  // "Grundstück" and "Sonstiges" carry no commercial/residential signal, so
  // they are left empty rather than guessed.
  return PROPERTY_TYPE_MAP[trimmed.toLowerCase()] || null;
};

const oneOf = (value: string | undefined, allowed: string[], field: string): string | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (!allowed.includes(trimmed)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')} (got "${trimmed}")`);
  }
  return trimmed;
};

/** Flatten the partial-invoice answer into the single text column. */
const toPartialInvoice = (partialInvoice: any): string | null => {
  if (!partialInvoice?.answered) return null;
  if (!partialInvoice.enabled) return 'Nein';
  const split = (partialInvoice.split || '').trim();
  const note = (partialInvoice.note || '').trim();
  if (!split) return note ? `Ja — ${note}` : 'Ja';
  return note ? `${split} — ${note}` : split;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientInfo = body?.clientInfo || {};
    const projectInfo = body?.projectInfo || {};
    const offerMeta = body?.offerMeta || {};

    const projectId = (projectInfo.projectNumber || '').trim();
    const projectManager = (projectInfo.projectManagerName || '').trim();

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Projekt-ID ist erforderlich' },
        { status: 400 }
      );
    }
    if (!projectManager) {
      return NextResponse.json(
        { success: false, error: 'Projektleiter ist erforderlich' },
        { status: 400 }
      );
    }

    const rawClientId = (clientInfo.clientNumber ?? '').toString().trim();
    const clientId = /^\d+$/.test(rawClientId) ? parseInt(rawClientId, 10) : null;
    const companyEmail = (clientInfo.contactPersonEmail || '').trim().toLowerCase() || null;

    // person_id is filled by trg_projects_set_person_from_email_fn once
    // email_id is set, so only the email needs resolving here.
    const emailId = await resolveEmailId(clientId, companyEmail);

    const project = {
      project_id: projectId,
      project_name: (projectInfo.projectName || '').trim() || null,
      project_manager: projectManager,
      pm_type: oneOf(projectInfo.projectManagerType, PM_TYPES, 'pm_type'),
      project_type: oneOf(projectInfo.projectCategory, PROJECT_TYPES, 'project_type'),
      construction_type: oneOf(projectInfo.constructionType, CONSTRUCTION_TYPES, 'construction_type'),
      property_type: toPropertyType(projectInfo.propertyType),
      questionnaire_received: oneOf(projectInfo.questionnaireReceived, YES_NO, 'questionnaire_received'),
      deposit: oneOf(offerMeta.deposit, YES_NO, 'deposit'),
      sales_person: (offerMeta.salespersonName || '').trim() || null,
      client_id: clientId,
      email_id: emailId,
      company_email: companyEmail,
      client_contact_name: (clientInfo.contactPersonName || '').trim() || null,
      partial_invoice: toPartialInvoice(offerMeta.partialInvoice),
    };

    // Seeded on creation only: a project that has moved past "Offen" must not
    // be dragged back when its proposal is edited and re-marked ready.
    const { project: saved, created } = await upsertProject(project, {
      project_status: DEFAULT_PROJECT_STATUS,
    });

    return NextResponse.json({
      success: true,
      project: saved,
      created,
      emailMatched: emailId !== null,
    });
  } catch (error: any) {
    console.error('❌ Error creating project:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
