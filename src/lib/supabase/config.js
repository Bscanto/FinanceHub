// Keep direct NEXT_PUBLIC references so Next.js includes these values in browser builds.
export function getSupabaseConfig() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    key: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim(),
  };
}
export const isConfigured = () => {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
};
