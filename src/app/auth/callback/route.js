import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/supabase/config';
export async function GET(request) {
  const url = new URL(request.url),
    code = url.searchParams.get('code');
  if (isConfigured() && code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get('next') === '/login?mode=update'
            ? '/login?mode=update'
            : '/overview',
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
