import { redirect } from 'next/navigation';

// The preview page was promoted to the dedicated editor at /edit. Keep this
// route as a redirect so older links (and bookmarks) still resolve.
export default function PreviewRedirect() {
  redirect('/edit');
}
