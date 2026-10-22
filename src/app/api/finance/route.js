import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/supabase/config';
import { validateCommand } from '@/lib/finance/schemas';
import { ZodError } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function authenticated() {
  if (!isConfigured())
    return { error: json({ error: 'Configure o Supabase para usar o FinanceHub.' }, 503) };
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    return { error: json({ error: 'Sua sessão expirou. Entre novamente.' }, 401) };
  return { db, user };
}
export async function GET() {
  const auth = await authenticated();
  if (auth.error) return auth.error;
  const { data, error } = await auth.db.rpc('finance_snapshot');
  if (error)
    return json(
      {
        error:
          'Não foi possível carregar os dados. Verifique a conexão e se a migração do banco foi aplicada.',
      },
      500,
    );
  return json(data);
}
export async function POST(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    return json({ error: 'Origem não autorizada.' }, 403);
  const auth = await authenticated();
  if (auth.error) return auth.error;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: 'Solicitação muito grande.' }, 413);
    const c = validateCommand(JSON.parse(raw));
    const { data, error } = await auth.db.rpc('finance_command', {
      p_action: c.action,
      p_entity: c.entity,
      p_data: c.data,
      p_id: c.id,
    });
    if (error) {
      const friendly =
        error.code === '23503'
          ? 'Este registro está em uso ou uma referência é inválida.'
          : error.code === '23505'
            ? 'Já existe um registro com esses dados.'
            : error.code === '23514'
              ? 'Revise os valores informados.'
              : error.code === 'P0001'
                ? error.message
                : 'Não foi possível concluir a operação.';
      return json({ error: friendly }, 400);
    }
    return json({ data });
  } catch (error) {
    return json(
      {
        error:
          error instanceof ZodError
            ? error.issues.map((e) => e.message).join(' ')
            : 'Dados inválidos. Revise o formulário.',
      },
      400,
    );
  }
}
