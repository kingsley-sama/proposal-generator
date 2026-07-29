import { redirect } from 'next/navigation';

// The extra-information form now lives inline at the top of the editor (/edit).
// Keep this route as a redirect so any older /setup links still resolve.
export default function SetupRedirect() {
  redirect('/edit');
}
