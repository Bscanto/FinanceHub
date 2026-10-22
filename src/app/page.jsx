import { redirect } from 'next/navigation';
import { isConfigured } from '@/lib/supabase/config';
export default function Home() {
  redirect(isConfigured() ? '/overview' : '/setup');
}
