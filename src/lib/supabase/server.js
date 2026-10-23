import { getSupabaseConfig } from './config';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createClient() {
  const { url, key } = getSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: { getAll: () => store.getAll(), setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Proxy refreshes cookies for server components. */ } } }
  });
}
