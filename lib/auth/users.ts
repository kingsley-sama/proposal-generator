import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { getSession } from '@/lib/auth/session';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer the service-role key on the server so RLS never blocks auth lookups.
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase credentials are not configured for authentication.');
}

const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type UserWithHash = AppUser & { password_hash: string };

export async function getUserByEmail(email: string): Promise<UserWithHash | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role, password_hash')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, id: String(data.id) };
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role')
    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, id: String(data.id) };
}

/** Resolve the currently authenticated user from the session cookie, or null. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return getUserById(session.user.id);
}
