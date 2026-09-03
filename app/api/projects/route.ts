import { NextResponse } from 'next/server';
// @ts-ignore
import {
  createProposalVersion,
  getProposalByOfferNumber,
  resolveEmailId,
  updateProposal,
  upsertProject,
} from '@/lib/utils';
import {
  CONSTRUCTION_TYPES,
  PM_TYPES,
  PROJECT_TYPES,
  PROPERTY_TYPES,
  type ProjectStatus,
  type YesNo,
} from '@/lib/project-enums';

export const runtime = 'nodejs';

// Validated here against the enum domains of public.projects so an unexpected
// value fails with a readable message instead of a raw Postgres
// "invalid input value" error.
const DEFAULT_PROJECT_STATUS: ProjectStatus = 'Offen';

/**
 * A project is created the moment Lidia marks the proposal ready, which is
 * before the PM has had the questionnaire conversation with the client, so the
 * Setup form does not ask about it at all. Creation seeds 'No' — "handed over,
 * questionnaire still pending" — rather than NULL, which reads as "nobody has
 * looked at this yet" in the dashboard.
 *
 * Creating the project does not start the intake automation. That runs when the
 * PM flips questionnaire_received to 'Yes' (trg_projects_questionnaire_received).
 */
const DEFAULT_QUESTIONNAIRE_RECEIVED: YesNo = 'No';

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
 * So a "Nein" answer writes 'no', and a "Ja" answer writes the number the Setup
 * form now requires. An unanswered toggle returns null, which makes
 * upsertProject drop the key rather than overwrite what is already stored.
 */
const toPartialInvoice = (partialInvoice: any): string | null => {
  if (!partialInvoice?.answered) return null;
  if (!partialInvoice.enabled) return 'no';
  return (partialInvoice.invoiceNumber || '').trim() || null;
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

    // The proposal this handover belongs to is resolved *before* anything is
    // written. Marking ready is only reachable from the editor of an already
    // saved proposal, so a missing or unknown offer number is a bug, not a
    // variant of the flow — and failing here leaves nothing half-done, whereas
    // discovering it after upsertProject would leave a live project row whose
    // proposal is still a draft.
    const offerNumber = (body?.offerNumber || '').toString().trim();
    if (!offerNumber) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Angebotsnummer fehlt — das Projekt kann keinem Angebot zugeordnet werden. ' +
            'Bitte das Angebot neu laden und erneut versuchen.',
        },
        { status: 400 }
      );
    }

    const existingProposal = await getProposalByOfferNumber(offerNumber);
    if (!existingProposal) {
      return NextResponse.json(
        { success: false, error: `Angebot ${offerNumber} wurde nicht gefunden.` },
        { status: 404 }
      );
    }

    const rawClientId = (clientInfo.clientNumber ?? '').toString().trim();
    const clientId = /^\d+$/.test(rawClientId) ? parseInt(rawClientId, 10) : null;
    const companyEmail = (clientInfo.contactPersonEmail || '').trim().toLowerCase() || null;

    // person_id is filled by trg_projects_set_person_from_email_fn once
    // email_id is set, so only the email needs resolving here.
    //
    // email_id is not optional: trg_projects_check_company_client rejects a
    // project whose email is NULL or owned by another company. Failing here
    // with the client's details is far more actionable than the raw Postgres
    // "refers to email_id <NULL> which is not linked to any company".
    const { emailId, exact, linkedEmail, companyFound } = await resolveEmailId(
      clientId,
      companyEmail
    );

    if (emailId === null) {
      const reason = !clientId
        ? 'Es wurde keine Kunden-ID angegeben, und die E-Mail-Adresse ist keiner Firma zugeordnet.'
        : companyFound
          ? `Zur Kunden-ID ${clientId} ist keine E-Mail-Adresse hinterlegt.`
          : `Zur Kunden-ID ${clientId} wurde keine Firma gefunden.`;
      return NextResponse.json(
        {
          success: false,
          error:
            `Das Projekt kann keiner Firma zugeordnet werden. ${reason} ` +
            'Bitte die Kunden-ID prüfen bzw. die Firma und ihre E-Mail-Adresse in der Datenbank anlegen.',
        },
        { status: 400 }
      );
    }

    const project = {
      project_id: projectId,
      project_name: (projectInfo.projectName || '').trim() || null,
      project_manager: projectManager,
      pm_type: oneOf(projectInfo.projectManagerType, PM_TYPES, 'pm_type'),
      project_type: oneOf(projectInfo.projectCategory, PROJECT_TYPES, 'project_type'),
      construction_type: oneOf(projectInfo.constructionType, CONSTRUCTION_TYPES, 'construction_type'),
      property_type: oneOf(projectInfo.propertyType, PROPERTY_TYPES, 'property_type'),
      order_confirmation_date: toDate(projectInfo.orderConfirmationDate, 'order_confirmation_date'),
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
      // Creation-only: the Setup form no longer asks about the questionnaire, so
      // every new project starts as 'No' ("handed over, questionnaire pending")
      // and the PM flips it to 'Yes' in the dashboard. Keeping it out of the
      // update payload means re-marking a proposal ready can never drag a
      // confirmed 'Yes' back and re-arm the intake trigger behind the PM's back.
      questionnaire_received: DEFAULT_QUESTIONNAIRE_RECEIVED,
    });

    // ── Mirror the transition onto the proposal ─────────────────────────────
    // Creating the project is what makes a proposal "ready", so the proposal row
    // has to record it — both the status the list reads and the project_id that
    // ties the two together. Without this the transition lived only in React
    // state and the list went on showing "draft" forever.
    let proposal: any = null;
    let version: any = null;
    let proposalWarning: string | null = null;

    try {
      // Null-valued keys are dropped for the same reason upsertProject drops
      // them: an optional field left blank on the Setup form must not blank out
      // what is already stored on the proposal.
      const patch: Record<string, any> = {
        proposal_status: 'ready',
        project_id: projectId,
        project_number: projectId,
        project_manager: projectManager,
        project_name: project.project_name,
        pm_type: project.pm_type,
        sales_person: project.sales_person,
        construction_type: project.construction_type,
        property_type: project.property_type,
        email_id: emailId,
        company_email: companyEmail,
        client_contact_name: project.client_contact_name,
      };
      Object.keys(patch).forEach((k) => {
        if (patch[k] === null || patch[k] === undefined || patch[k] === '') delete patch[k];
      });

      proposal = await updateProposal(offerNumber, patch);

      // The version carrying a project_id is the ready one — that is what
      // separates it from every draft snapshot cut before it.
      version = await createProposalVersion(proposal, {
        changeType: 'ready',
        actor: project.sales_person || null,
      });
    } catch (e: any) {
      // The project is saved at this point, so this cannot throw — that would
      // report total failure for a project that exists. It is surfaced instead,
      // and the client leaves the badge on "Entwurf" when it is set.
      console.error('⚠️  Project saved but proposal not marked ready:', e.message);
      proposalWarning =
        `Projekt gespeichert, aber das Angebot konnte nicht als bereit markiert werden: ${e.message}`;
    }

    return NextResponse.json({
      success: true,
      project: saved,
      created,
      emailMatched: exact,
      linkedEmail,
      proposal,
      version,
      proposalWarning,
    });
  } catch (error: any) {
    console.error('❌ Error creating project:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
