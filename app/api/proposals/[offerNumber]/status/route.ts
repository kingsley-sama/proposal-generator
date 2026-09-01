import { NextResponse } from 'next/server';
// @ts-ignore
import { setProposalStatus, getProposalByOfferNumber } from '@/lib/utils';

export const runtime = 'nodejs';

// Kept in lockstep with proposals_proposal_status_check (see
// docs/sql/add_proposal_versions.sql). The two lists disagreed before: this
// one allowed 'ready' where the constraint did not, so the write the Setup
// form needed most would have failed at the database, and 'expired' was
// rejected here despite being legal there.
const ALLOWED_STATUSES = new Set([
  'draft',
  'ready',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
]);

type RouteCtx = { params: Promise<{ offerNumber: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const { offerNumber: rawOffer } = await ctx.params;
    const offerNumber = decodeURIComponent(rawOffer);

    const body = await request.json();
    const status = body?.status;

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await getProposalByOfferNumber(offerNumber);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });
    }

    const updated = await setProposalStatus(offerNumber, status);
    return NextResponse.json({ success: true, proposal: updated });
  } catch (error: any) {
    console.error('❌ Error updating proposal status:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
