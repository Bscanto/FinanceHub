import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
let db;
const userA = randomUUID(),
  userB = randomUUID();
let account, other, category, incomeCategory, card, tx;
async function asUser(user) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
  await db.exec('set role authenticated');
}
async function command(action, entity = '', data = {}, id = randomUUID()) {
  return (
    await db.query('select public.finance_command($1,$2,$3::jsonb,$4::uuid) as value', [
      action,
      entity,
      JSON.stringify(data),
      id,
    ])
  ).rows[0].value;
}
async function snapshot() {
  return (await db.query('select public.finance_snapshot() as value')).rows[0].value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  await db.query('insert into auth.users values ($1),($2)', [userA, userB]);
  await db.exec(readFileSync('supabase/migrations/20261022222347_foundation.sql', 'utf8'));
  await asUser(userA);
  await command('initialize');
  let d = await snapshot();
  category = d.categories.find((c) => c.kind === 'expense').id;
  incomeCategory = d.categories.find((c) => c.kind === 'income').id;
  account = await command('create', 'accounts', {
    name: 'Principal',
    kind: 'checking',
    institution: '',
    opening_cents: 100000,
    opened_on: '2026-01-01',
  });
  card = await command('create', 'cards', {
    name: 'Cartão',
    institution: '',
    limit_cents: 1000000,
    closing_day: 25,
    due_day: 5,
  });
  await asUser(userB);
  other = await command('create', 'accounts', {
    name: 'Outra pessoa',
    kind: 'checking',
    institution: '',
    opening_cents: 0,
    opened_on: '2026-01-01',
  });
  await asUser(userA);
});
afterAll(async () => {
  await db?.close();
});
describe('PostgreSQL: segurança e regras transacionais', () => {
  it('isola leitura por usuário com RLS', async () => {
    const d = await snapshot();
    expect(d.accounts.map((a) => a.id)).toEqual([account.id]);
    expect(
      (await db.query('select * from public.accounts where id=$1', [other.id])).rows,
    ).toHaveLength(0);
  });
  it('bloqueia escrita direta, anônima e referência a outra pessoa', async () => {
    await expect(
      db.query(
        "insert into public.accounts(user_id,name,kind,opening_cents,opened_on) values ($1,'Hack','cash',0,'2026-01-01')",
        [userA],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      command('create', 'transfers', {
        source_id: account.id,
        destination_id: other.id,
        amount_cents: 100,
        transferred_on: '2026-01-02',
      }),
    ).rejects.toThrow(/Conta inválida/);
    await expect(
      command(
        'update',
        'accounts',
        { name: 'Hack', kind: 'cash', opening_cents: 0, opened_on: '2026-01-01' },
        other.id,
      ),
    ).rejects.toThrow(/não encontrado/);
    await asUser(null);
    await expect(command('initialize')).rejects.toThrow();
    await asUser(userA);
  });
  it('não permite alterar dono nem escrever tabelas fora da lista', async () => {
    await expect(command('create', 'accounts', { user_id: userB, name: 'Hack' })).rejects.toThrow(
      /reservados/,
    );
    await expect(command('create', 'payments', {})).rejects.toThrow(/inválida/);
  });
  it('suporta CRUD e rollback em referências inválidas', async () => {
    const transfer = await command('create', 'transfers', {
      source_id: account.id,
      destination_id: account.id,
      amount_cents: 100,
      transferred_on: '2026-01-02',
    }).catch((e) => e);
    expect(transfer).toBeInstanceOf(Error);
    const updated = await command(
      'update',
      'accounts',
      {
        name: 'Conta editada',
        kind: 'checking',
        institution: 'Banco',
        opening_cents: 100000,
        opened_on: '2026-01-01',
      },
      account.id,
    );
    expect(updated.name).toBe('Conta editada');
    expect((await snapshot()).transfers).toHaveLength(0);
  });
  it('pagamento parcial é idempotente e impede excesso', async () => {
    tx = await command('create', 'transactions', {
      description: 'Salário',
      kind: 'income',
      category_id: incomeCategory,
      account_id: account.id,
      amount_cents: 10000,
      due_date: '2026-01-02',
      competence: '2026-01-01',
      fixed: true,
      method: 'pix',
      notes: '',
    });
    const id = randomUUID(),
      input = {
        transaction_id: tx.id,
        invoice_id: null,
        account_id: account.id,
        amount_cents: 3000,
        paid_on: '2026-01-02',
      };
    const first = await command('pay', '', input, id);
    const retry = await command('pay', '', input, id);
    expect(first.id).toBe(retry.id);
    await expect(command('pay', '', { ...input, amount_cents: 8000 })).rejects.toThrow(/excede/);
    expect((await snapshot()).payments).toHaveLength(1);
    await expect(command('delete', 'transactions', {}, tx.id)).rejects.toThrow(/Estorne/);
    await command('reverse', 'payments', {}, first.id);
    await command('cancel', 'transactions', {}, tx.id);
    expect((await snapshot()).transactions.find((t) => t.id === tx.id).canceled).toBe(true);
  });
  it('gera parcelas exatas e respeita fechamento', async () => {
    const purchase = await command('purchase', '', {
      description: 'Compra',
      card_id: card.id,
      category_id: category,
      amount_cents: 10000,
      purchased_on: '2026-01-25',
      count: 3,
    });
    const d = await snapshot(),
      parts = d.installments.filter((i) => i.purchase_id === purchase.id);
    expect(parts.map((i) => i.amount_cents).sort()).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((s, i) => s + i.amount_cents, 0)).toBe(10000);
    expect(d.invoices.map((i) => i.due_date).sort()).toEqual([
      '2026-03-05',
      '2026-04-05',
      '2026-05-05',
    ]);
    const invoice = d.invoices[0];
    const payment = await command('pay', '', {
      transaction_id: null,
      invoice_id: invoice.id,
      account_id: account.id,
      amount_cents: 1000,
      paid_on: '2026-03-05',
    });
    await expect(command('cancel', 'purchases', {}, purchase.id)).rejects.toThrow(/Estorne/);
    await command('reverse', 'payments', {}, payment.id);
    await command('cancel', 'purchases', {}, purchase.id);
  });
  it('limite de cartão é validado atomicamente', async () => {
    await expect(
      command('purchase', '', {
        description: 'Acima do limite',
        card_id: card.id,
        category_id: category,
        amount_cents: 1000001,
        purchased_on: '2026-01-01',
        count: 1,
      }),
    ).rejects.toThrow(/limite/);
  });
  it('recorrências não duplicam e mantêm dia 31 após fevereiro', async () => {
    const r = await command('create', 'recurrences', {
      description: 'Recorrência',
      kind: 'income',
      amount_cents: 50000,
      account_id: account.id,
      category_id: incomeCategory,
      start_date: '2026-01-01',
      end_date: '2026-03-31',
      day: 31,
      active: true,
    });
    await command('generate', '', { through: '2026-03-31' });
    await command('generate', '', { through: '2026-03-31' });
    const rows = (await snapshot()).transactions.filter((t) => t.recurrence_id === r.id);
    expect(rows.map((t) => t.due_date).sort()).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('amortização e estorno atualizam saldo devedor', async () => {
    const debt = await command('create', 'debts', {
      name: 'Empréstimo',
      balance_on: '2026-01-01',
      original_cents: 100000,
      balance_cents: 100000,
      rate_bps: 100,
      payment_cents: 10000,
      due_date: '2026-03-01',
      installments: 12,
    });
    const paid = await command('amortize', '', {
      debt_id: debt.id,
      account_id: account.id,
      principal_cents: 10000,
      interest_cents: 1000,
      paid_on: '2026-03-01',
      next_due_date: '2026-04-01',
    });
    expect((await snapshot()).debts[0].balance_cents).toBe(90000);
    await command('reverse', 'debt_payments', {}, paid.id);
    expect((await snapshot()).debts[0].balance_cents).toBe(100000);
  });
  it('não permite resgate ou estorno que deixe investimento negativo', async () => {
    const inv = await command('create', 'investments', {
      name: 'Reserva',
      kind: 'CDB',
      opening_cents: 0,
      opened_on: '2026-01-01',
      emergency: true,
    });
    const deposit = await command('invest', '', {
      investment_id: inv.id,
      account_id: account.id,
      kind: 'deposit',
      amount_cents: 10000,
      event_date: '2026-01-01',
    });
    await expect(
      command('invest', '', {
        investment_id: inv.id,
        account_id: account.id,
        kind: 'withdrawal',
        amount_cents: 10001,
        event_date: '2026-01-02',
      }),
    ).rejects.toThrow(/excede/);
    await command('invest', '', {
      investment_id: inv.id,
      account_id: account.id,
      kind: 'withdrawal',
      amount_cents: 9000,
      event_date: '2026-01-02',
    });
    await expect(command('reverse', 'investment_events', {}, deposit.id)).rejects.toThrow(
      /negativo/,
    );
  });
});
