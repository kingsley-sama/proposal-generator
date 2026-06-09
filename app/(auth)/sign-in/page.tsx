import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { SignInForm } from './sign-in-form';

export const metadata = {
  title: 'Anmelden – ExposéProfi',
};

export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect('/generator');
  return <SignInForm />;
}
