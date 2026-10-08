/**
 * Every n8n webhook this app calls, in one place.
 *
 * These are kept in code rather than in environment variables: none of them
 * is a secret (the webhooks take no credentials — logins and target IDs live
 * inside the n8n workflows), so there is nothing to gain from configuring them
 * per environment, and a missing env var would silently disable a notification.
 *
 * Production (`/webhook/...`) URLs only respond while their workflow is
 * active in n8n.
 */
const N8N_BASE_URL = 'https://n8n.exposeprofi.de/webhook';

export const N8N_WEBHOOKS = {
  /**
   * "Project Creation Notification teams channel" (djgCWbctRdXkubgB) — posts
   * a new project's details to the PM Teams channel. Called by
   * POST /api/projects when a project row is first inserted.
   */
  projectCreated: `${N8N_BASE_URL}/teams-channel-structured-data`,

  /**
   * Proposal upload to SharePoint — downloads the generated
   * .docx/.pdf from their signed URLs and uploads them to SharePoint. Called
   * by POST /api/generate-proposal.
   */
  proposalUpload: `${N8N_BASE_URL}/556fd7ca-ef28-4d00-b98e-9271b07a7bad`,

  /** Project email summary (project brief). Not called by the app yet. */
  projectEmailSummary: `${N8N_BASE_URL}/project-email-summary`,
} as const;
