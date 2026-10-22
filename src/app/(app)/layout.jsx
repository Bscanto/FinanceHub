import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/supabase/config';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function AppLayout({ children }) {
  if (!isConfigured()) redirect('/setup');
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  return <Shell email={user.email}>{children}</Shell>;
}
