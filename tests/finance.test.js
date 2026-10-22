import { describe, it, expect } from 'vitest';
import { cents, splitCents, percentage } from '../src/lib/finance/money';
import { invoiceDate, addMonths } from '../src/lib/finance/dates';
import {
  emptyData,
  accountBalance,
  monthly,
  netWorth,
  project,
  transactionState,
  debtSchedule,
  csv,
  investmentBalance,
} from '../src/lib/finance/engine';
import { schemas, validateCommand } from '../src/lib/finance/schemas';
const fixture = () => {
  const d = emptyData();
  d.accounts = [
    { id: 'a', name: 'Conta', opening_cents: 100000, opened_on: '2026-01-01' },
    { id: 'b', opening_cents: 0, opened_on: '2026-01-01' },
  ];
  d.categories = [
    { id: 'food', kind: 'expense', scope: 'personal', name: 'Alimentação' },
    { id: 'salary', kind: 'income', scope: 'income', name: 'Salário' },
  ];
  return d;
};
describe('Precisão e calendário', () => {
  it('converte valores brasileiros sem perder centavos', () => {
    expect(cents('1.234,56')).toBe(123456);
    expect(cents('0,29')).toBe(29);
    expect(cents('-10,05')).toBe(-1005);
    expect(() => cents('1.2')).toThrow();
    expect(() => cents('1,234')).toThrow();
    expect(() => cents('Infinity')).toThrow();
  });
  it('preserva o total exato de parcelas', () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitCents(120000, 6)).toEqual(Array(6).fill(20000));
    expect(() => splitCents(1, 2)).toThrow();
    for (let n = 1; n <= 360; n++)
      expect(splitCents(999999, n).reduce((a, b) => a + b, 0)).toBe(999999);
  });
  it('resolve fechamento, virada de ano e dias inexistentes', () => {
    expect(invoiceDate('2026-01-24', 25, 5)).toBe('2026-02-05');
    expect(invoiceDate('2026-01-25', 25, 5)).toBe('2026-03-05');
    expect(invoiceDate('2026-12-28', 25, 5)).toBe('2027-02-05');
    expect(invoiceDate('2026-02-28', 31, 5)).toBe('2026-04-05');
    expect(invoiceDate('2026-01-10', 20, 28)).toBe('2026-01-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
  });
  it('arredonda juros em centavos', () => {
    expect(percentage(10001, 100)).toBe(100);
    expect(percentage(50, 100)).toBe(1);
  });
});
describe('Separação entre competência e caixa', () => {
  it('receitas previstas não alteram caixa; pagamentos parciais alteram', () => {
    const d = fixture();
    const t = {
      id: 't',
      kind: 'income',
      amount_cents: 500000,
      account_id: 'a',
      due_date: '2026-02-05',
      competence: '2026-01-31',
    };
    d.transactions = [t];
    expect(accountBalance(d, d.accounts[0], '2026-02-10')).toBe(100000);
    expect(monthly(d, '2026-01').income).toBe(500000);
    d.payments = [
      {
        id: 'p',
        transaction_id: 't',
        account_id: 'a',
        amount_cents: 200000,
        paid_on: '2026-02-06',
      },
    ];
    expect(transactionState(d, t)).toMatchObject({ remaining: 300000, status: 'Parcial' });
    expect(accountBalance(d, d.accounts[0], '2026-02-10')).toBe(300000);
    expect(monthly(d, '2026-02').received).toBe(200000);
    expect(monthly(d, '2026-02').income).toBe(0);
  });
  it('transferências internas são neutras', () => {
    const d = fixture();
    d.transfers = [
      { source_id: 'a', destination_id: 'b', amount_cents: 30000, transferred_on: '2026-02-01' },
    ];
    expect(accountBalance(d, d.accounts[0], '2026-02-10')).toBe(70000);
    expect(accountBalance(d, d.accounts[1], '2026-02-10')).toBe(30000);
    expect(monthly(d, '2026-02').expense).toBe(0);
    expect(netWorth(d, '2026-02-10')).toBe(100000);
  });
  it('pagar fatura não duplica a despesa e mantém patrimônio', () => {
    const d = fixture();
    d.purchases = [
      {
        id: 'p',
        amount_cents: 12000,
        purchased_on: '2026-01-01',
        category_id: 'food',
        description: 'Compra',
        count: 1,
      },
    ];
    d.invoices = [{ id: 'i', due_date: '2026-02-05' }];
    d.installments = [{ invoice_id: 'i', purchase_id: 'p', amount_cents: 12000, number: 1 }];
    const before = netWorth(d, '2026-02-10');
    d.payments = [{ invoice_id: 'i', account_id: 'a', amount_cents: 5000, paid_on: '2026-02-05' }];
    expect(monthly(d, '2026-02').expense).toBe(12000);
    expect(accountBalance(d, d.accounts[0], '2026-02-10')).toBe(95000);
    expect(netWorth(d, '2026-02-10')).toBe(before);
  });
  it('estornos e cancelamentos recalculam as métricas', () => {
    const d = fixture();
    d.transactions = [
      {
        id: 't',
        kind: 'expense',
        amount_cents: 5000,
        competence: '2026-02-01',
        due_date: '2026-02-01',
        canceled: true,
      },
    ];
    expect(monthly(d, '2026-02').expense).toBe(0);
    expect(transactionState(d, d.transactions[0]).remaining).toBe(0);
  });
  it('aportes e resgates preservam patrimônio; rendimento aumenta posição', () => {
    const d = fixture();
    d.investments = [{ id: 'i', opening_cents: 0, opened_on: '2026-01-01' }];
    d.investment_events = [
      {
        investment_id: 'i',
        account_id: 'a',
        kind: 'deposit',
        amount_cents: 30000,
        event_date: '2026-02-01',
      },
      { investment_id: 'i', kind: 'yield', amount_cents: 300, event_date: '2026-02-02' },
    ];
    expect(investmentBalance(d, d.investments[0], '2026-02-10')).toBe(30300);
    expect(netWorth(d, '2026-02-10')).toBe(100300);
    expect(monthly(d, '2026-02').expense).toBe(0);
  });
});
describe('Planejamento', () => {
  it('não duplica recorrências materializadas', () => {
    const d = fixture();
    d.recurrences = [
      {
        id: 'r',
        kind: 'income',
        amount_cents: 50000,
        start_date: '2026-02-01',
        day: 5,
        active: true,
      },
    ];
    d.transactions = [
      {
        id: 't',
        recurrence_id: 'r',
        kind: 'income',
        amount_cents: 50000,
        due_date: '2026-02-05',
        competence: '2026-02-05',
      },
    ];
    const rows = project(d, { asOf: '2026-02-01', start: '2026-02', months: 2 });
    expect(rows.map((r) => r.income)).toEqual([50000, 50000]);
    expect(rows[1].balance).toBe(200000);
  });
  it('não ressuscita ocorrência cancelada e considera pagamento parcial', () => {
    const d = fixture();
    d.recurrences = [
      {
        id: 'r',
        kind: 'income',
        amount_cents: 50000,
        start_date: '2026-02-01',
        day: 5,
        active: true,
      },
    ];
    d.transactions = [
      {
        id: 't',
        recurrence_id: 'r',
        kind: 'income',
        amount_cents: 50000,
        due_date: '2026-02-05',
        competence: '2026-02-05',
        canceled: true,
      },
    ];
    expect(project(d, { asOf: '2026-02-01', start: '2026-02', months: 1 })[0].income).toBe(0);
  });
  it('cenários não modificam lançamentos', () => {
    const d = fixture(),
      before = JSON.stringify(d);
    const rows = project(d, {
      asOf: '2026-02-01',
      start: '2026-02',
      months: 3,
      scenario: { income_bps: 10000, expense_bps: 10000, purchase_cents: 10000, installments: 3 },
    });
    expect(rows.map((r) => r.expense)).toEqual([3334, 3333, 3333]);
    expect(JSON.stringify(d)).toBe(before);
  });
  it('estimativa variável não duplica categoria já programada', () => {
    const d = fixture();
    d.transactions = [
      {
        id: 'old',
        kind: 'expense',
        category_id: 'food',
        amount_cents: 30000,
        competence: '2026-01-10',
        due_date: '2026-01-10',
        fixed: false,
      },
      {
        id: 'next',
        kind: 'expense',
        category_id: 'food',
        amount_cents: 20000,
        competence: '2026-02-10',
        due_date: '2026-02-10',
        fixed: false,
      },
    ];
    d.payments = [
      { transaction_id: 'old', account_id: 'a', amount_cents: 30000, paid_on: '2026-01-10' },
    ];
    const rows = project(d, { asOf: '2026-02-01', start: '2026-02', months: 2 });
    expect(rows[0].expense).toBe(20000);
    expect(rows[1].estimated).toBe(10000);
  });
  it('antecipa quitação e detecta prestação insuficiente', () => {
    const debt = {
      balance_cents: 100000,
      rate_bps: 100,
      payment_cents: 10000,
      due_date: '2026-01-31',
    };
    expect(debtSchedule(debt, 50000).interestTotal).toBeLessThan(debtSchedule(debt).interestTotal);
    expect(debtSchedule({ ...debt, payment_cents: 100 }).unpayable).toBe(true);
  });
  it('protege CSV contra fórmulas', () =>
    expect(csv([['=HYPERLINK("bad")', 'texto']])).toContain("'=HYPERLINK"));
  it('rejeita datas impossíveis e IDs inválidos na API', () => {
    expect(
      schemas.accounts.safeParse({
        name: 'Banco',
        kind: 'checking',
        institution: '',
        opening_cents: 0,
        opened_on: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(() => validateCommand({ action: 'delete', entity: 'accounts', id: 'x' })).toThrow();
  });
});
