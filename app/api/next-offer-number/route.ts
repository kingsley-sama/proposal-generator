import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year  = searchParams.get('year')  || String(new Date().getFullYear());
    const month = searchParams.get('month') || String(new Date().getMonth() + 1).padStart(2, '0');
    const day   = searchParams.get('day')   || String(new Date().getDate()).padStart(2, '0');

    const dateKey = `${year}-${month}-${day}`;
    const counterFilePath = path.join(process.cwd(), 'output', 'offer_counter.json');

    let localMax = 7; // first increment → 8

    if (fs.existsSync(counterFilePath)) {
      try {
        const stored = JSON.parse(fs.readFileSync(counterFilePath, 'utf8'));
        if (stored.date === dateKey && typeof stored.counter === 'number') {
          localMax = stored.counter;
        }
      } catch {
        // ignore, use default
      }
    }

    const nextNumber = `${dateKey}-${localMax + 1}`;
    return NextResponse.json({ offerNumber: nextNumber });
  } catch (error: any) {
    return NextResponse.json({ offerNumber: null, error: error.message }, { status: 500 });
  }
}
