import { afterEach, expect, it, vi } from 'vitest';
import { getSupabaseConfig, isConfigured } from '../src/lib/supabase/config';
afterEach(() => vi.unstubAllEnvs());
it('remove espaços e quebras de linha copiados nas variáveis públicas', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ' https://example.supabase.co\n');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test\r\n');
  expect(getSupabaseConfig()).toEqual({ url: 'https://example.supabase.co', key: 'sb_publishable_test' });
  expect(isConfigured()).toBe(true);
});
it('não trata variáveis contendo somente espaços como conexão configurada', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ' \n');
  expect(isConfigured()).toBe(false);
});
