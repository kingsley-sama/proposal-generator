import { NextResponse } from 'next/server';
// @ts-ignore
import { listProposalVersions } from '@/lib/utils';

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ offerNumber: string }> };

/** Version history for one proposal, newest first. */
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const { offerNumber: rawOffer } = await ctx.params;
    const offerNumber = decodeURIComponent(rawOffer);

    const versions = await listProposalVersions(offerNumber);
    return NextResponse.json({ success: true, versions });
  } catch (error: any) {
    console.error('❌ Error listing proposal versions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
