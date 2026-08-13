import { NextResponse } from 'next/server';
// @ts-ignore
import { resolveEmailId, upsertProject } from '@/lib/utils';
import {
  CONSTRUCTION_TYPES,
  FIRST_NEXT_PROJECT,
  PM_TYPES,
  PROJECT_TYPES,
  PROPERTY_TYPES,
  YES_NO,
  type ProjectStatus,
} from '@/lib/project-enums';

export const runtime = 'nodejs';

// Validated here against the enum domains of public.projects so an unexpected
// value fails with a readable message instead of a raw Postgres
// "invalid input value" error.
const DEFAULT_PROJECT_STATUS: ProjectStatus = 'Offen';

const oneOf = (
  value: string | undefined,
  allowed: readonly string[],
  field: string
): string | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (!allowed.includes(trimmed)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')} (got "${trimmed}")`);
  }
  return trimmed;
};

/**
 * `projects.partial_invoice` holds the partial invoice's *number* once one is
 * issued (e.g. "RE-2026-05-1801"), or the literal 'no' when the project has no
 * partial invoice — it is not a free-text description of the arrangement.
 *
 * So a "Nein" answer writes 'no', and a "Ja" answer writes nothing: the number
 * is not known yet and is filled in later by the invoicing workflow. Returning
 * null also means upsertProject drops the key, so re-marking a proposal ready
 * can never overwrite a number that has since been issued.
 */
const toPartialInvoice = (partialInvoice: any): string | null => {
  if (!partialInvoice?.answered) return null;
  return partialInvoice.enabled ? null : 'no';
};

/** ISO date (YYYY-MM-DD) or null — anything else is rejected by Postgres. */
const toDate = (value: string | undefined, field: string): string | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${field} must be an ISO date (YYYY-MM-DD), got "${trimmed}"`);
  }
  return trimmed;
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
    // NOT NULL with a CURRENT_DATE default — required explicitly so a missing
    // value surfaces here instead of silently being recorded as today.
    if (!(projectInfo.orderConfirmationDate || '').trim()) {
      return NextResponse.json(
        { success: false, error: 'Auftragsbestätigungsdatum ist erforderlich' },
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
      property_type: oneOf(projectInfo.propertyType, PROPERTY_TYPES, 'property_type'),
      questionnaire_received: oneOf(projectInfo.questionnaireReceived, YES_NO, 'questionnaire_received'),
      first_or_next_project: oneOf(
        projectInfo.firstOrNextProject,
        FIRST_NEXT_PROJECT,
        'first_or_next_project'
      ),
      deposit: oneOf(offerMeta.deposit, YES_NO, 'deposit'),
      order_confirmation_date: toDate(projectInfo.orderConfirmationDate, 'order_confirmation_date'),
      delivery_completion_date: toDate(projectInfo.deliveryCompletionDate, 'delivery_completion_date'),
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
