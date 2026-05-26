import { NextResponse } from 'next/server';
// @ts-ignore
import { listProposals } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;

    const { rows, total } = await listProposals({ search, status, limit, offset });
    return NextResponse.json({ success: true, rows, total, limit, offset });
  } catch (error: any) {
    console.error('❌ Error listing proposals:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
