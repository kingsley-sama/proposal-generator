import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/users';

export const runtime = 'nodejs';

// Returns the currently authenticated user so the Setup form can default the
// salesperson field (e.g. to "Lidia" when she is the one logged in).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error('Error resolving current user:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
