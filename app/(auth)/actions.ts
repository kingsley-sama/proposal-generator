'use server';

import { redirect } from 'next/navigation';
import { compare } from 'bcryptjs';
import { getUserByEmail } from '@/lib/auth/users';
import { setSession, clearSession } from '@/lib/auth/session';

export type ActionState = {
  error?: string;
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirect') ?? '') || '/generator';

  if (!EMAIL_RE.test(email) || password.length < 1) {
    return { error: 'Bitte gültige E-Mail und Passwort eingeben.', email };
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return { error: 'Ungültige E-Mail oder Passwort.', email };
  }

  let valid = false;
  try {
    valid = await compare(password, user.password_hash);
  } catch {
    valid = false;
  }

  if (!valid) {
    return { error: 'Ungültige E-Mail oder Passwort.', email };
  }

  await setSession(user.id);
  // Only allow internal redirect targets.
  redirect(redirectTo.startsWith('/') ? redirectTo : '/generator');
}

export async function signOut() {
  await clearSession();
  redirect('/sign-in');
}
