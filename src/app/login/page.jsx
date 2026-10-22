import { redirect } from 'next/navigation';
import { isConfigured } from '@/lib/supabase/config';
import { AuthForm } from '@/components/auth-form';
export default async function Login({ searchParams }) {
  if (!isConfigured()) redirect('/setup');
  const query = await searchParams;
  return (
    <AuthForm
      initialMode={query.mode === 'update' ? 'update' : 'login'}
      linkError={query.error === 'link'}
    />
  );
}
