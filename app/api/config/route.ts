import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.supabase_url,
    supabaseKey: process.env.SUPABASE_ANON_KEY || process.env.supabase_key,
  });
}
