import { addMonths, monthOf, today, monthLabel, addDays } from './dates';
import { percentage, splitCents, money } from './money';
export const TABLES = [
  'profiles',
  'accounts',
  'categories',
  'transactions',
  'recurrences',
  'cards',
  'purchases',
  'installments',
  'invoices',
  'payments',
  'transfers',
  'budgets',
  'goals',
  'debts',
  'debt_payments',
  'investments',
  'investment_events',
  'assets',
  'scenarios',
  'notifications',
];
export const emptyData = () => Object.fromEntries(TABLES.map((t) => [t, []]));
export const sum = (rows, key = 'amount_cents') =>
  rows.reduce((s, r) => s + Number(typeof key === 'function' ? key(r) : r[key] || 0), 0);
export function transactionState(data, tx) {
  const paid = sum(data.payments.filter((p) => p.transaction_id === tx.id));
  return {
    paid,
    remaining: tx.canceled ? 0 : tx.amount_cents - paid,
    status: tx.canceled
      ? 'Cancelado'
      : paid >= tx.amount_cents
        ? tx.kind === 'income'
          ? 'Recebido'
          : 'Pago'
        : paid
          ? 'Parcial'
          : 'Previsto',
  };
}
export function invoiceState(data, invoice) {
  const active = new Set(data.purchases.filter((p) => !p.canceled).map((p) => p.id));
  const total = sum(
    data.installments.filter((i) => i.invoice_id === invoice.id && active.has(i.purchase_id)),
  );
  const paid = sum(data.payments.filter((p) => p.invoice_id === invoice.id));
  return { total, paid, remaining: total - paid };
}
export function cashEntries(data) {
  const transactions = new Map(data.transactions.map((t) => [t.id, t]));
  return [
    ...data.payments.map((p) => ({
      account: p.account_id,
      date: p.paid_on,
      value: p.amount_cents * (transactions.get(p.transaction_id)?.kind === 'income' ? 1 : -1),
    })),
    ...data.transfers.flatMap((t) => [
      { account: t.source_id, date: t.transferred_on, value: -t.amount_cents },
      { account: t.destination_id, date: t.transferred_on, value: t.amount_cents },
    ]),
    ...data.debt_payments.map((p) => ({
      account: p.account_id,
      date: p.paid_on,
      value: -p.principal_cents - p.interest_cents,
    })),
    ...data.investment_events
      .filter((e) => e.kind !== 'yield')
      .map((e) => ({
        account: e.account_id,
        date: e.event_date,
        value: e.amount_cents * (e.kind === 'withdrawal' ? 1 : -1),
      })),
  ];
}
export function accountBalance(data, account, asOf = today()) {
  return (
    (account.opened_on <= asOf ? account.opening_cents : 0) +
    sum(
      cashEntries(data).filter((e) => e.account === account.id && e.date <= asOf),
      'value',
    )
  );
}
export const cashBalance = (data, date = today()) =>
  sum(data.accounts, (a) => accountBalance(data, a, date));
export function investmentBalance(data, investment, asOf = today()) {
  return (
    (investment.opened_on <= asOf ? investment.opening_cents : 0) +
    sum(
      data.investment_events.filter(
        (e) => e.investment_id === investment.id && e.event_date <= asOf,
      ),
      (e) => (e.kind === 'withdrawal' ? -e.amount_cents : e.amount_cents),
    )
  );
}
export function netWorth(data, date = today()) {
  const cardDebt =
    sum(data.purchases.filter((p) => !p.canceled && p.purchased_on <= date)) -
    sum(data.payments.filter((p) => p.invoice_id && p.paid_on <= date));
  const debt = sum(
    data.debts.filter((d) => !d.balance_on || d.balance_on <= date),
    (d) =>
      d.balance_cents +
      sum(
        data.debt_payments.filter((p) => p.debt_id === d.id && p.paid_on > date),
        'principal_cents',
      ),
  );
  return (
    cashBalance(data, date) +
    sum(data.investments, (i) => investmentBalance(data, i, date)) +
    sum(
      data.assets.filter((a) => a.valued_on <= date),
      'value_cents',
    ) -
    debt -
    cardDebt
  );
}
// Expense recognition occurs on installment due month; invoice payments only affect cash.
export function recognizedEntries(data) {
  const purchases = new Map(data.purchases.filter((p) => !p.canceled).map((p) => [p.id, p]));
  const invoices = new Map(data.invoices.map((i) => [i.id, i]));
  return [
    ...data.transactions
      .filter((t) => !t.canceled)
      .map((t) => ({ ...t, date: t.competence, source: 'transaction' })),
    ...data.installments
      .filter((i) => purchases.has(i.purchase_id))
      .map((i) => {
        const purchase = purchases.get(i.purchase_id);
        return {
          ...i,
          kind: 'expense',
          category_id: purchase.category_id,
          card_id: purchase.card_id,
          description: `${purchase.description} · ${i.number}/${purchase.count}`,
          date: invoices.get(i.invoice_id).due_date,
          fixed: false,
          source: 'card',
        };
      }),
    ...data.debt_payments
      .filter((p) => p.interest_cents > 0)
      .map((p) => ({
        ...p,
        kind: 'expense',
        amount_cents: p.interest_cents,
        description: 'Juros da dívida',
        date: p.paid_on,
        source: 'interest',
        fixed: false,
      })),
  ];
}
export function monthly(data, month) {
  const entries = recognizedEntries(data).filter((t) => monthOf(t.date) === month);
  const income = sum(entries.filter((t) => t.kind === 'income'));
  const expense = sum(entries.filter((t) => t.kind === 'expense'));
  const txById = new Map(data.transactions.map((t) => [t.id, t]));
  const received = sum(
    data.payments.filter(
      (p) => monthOf(p.paid_on) === month && txById.get(p.transaction_id)?.kind === 'income',
    ),
  );
  const paid = -sum(
    cashEntries(data).filter((e) => monthOf(e.date) === month && e.value < 0),
    'value',
  );
  const pending = data.transactions.filter((t) => monthOf(t.due_date) === month && !t.canceled);
  const financingPending = sum(data.debts, (debt) => {
    if (debt.balance_cents <= 0 || monthOf(debt.due_date) > month) return 0;
    const schedule = debtSchedule(debt);
    const installment = schedule.rows.find((row) => monthOf(row.date) === month);
    // Even a payment that does not cover interest remains a monthly commitment.
    return installment?.payment ?? (schedule.unpayable ? debt.payment_cents : 0);
  });
  const financingPrincipalPaid = sum(
    data.debt_payments.filter((p) => monthOf(p.paid_on) === month),
    'principal_cents',
  );
  return {
    income,
    expense,
    result: income - expense,
    financingPending,
    // Paid interest is already in expense. Add only paid principal and unpaid installments.
    resultAfterFinancing: income - expense - financingPrincipalPaid - financingPending,
    received,
    paid,
    receivable: sum(
      pending.filter((t) => t.kind === 'income'),
      (t) => transactionState(data, t).remaining,
    ),
    payable: sum(
      pending.filter((t) => t.kind === 'expense'),
      (t) => transactionState(data, t).remaining,
    ),
    invoices: sum(
      data.invoices.filter((i) => monthOf(i.due_date) === month),
      (i) => invoiceState(data, i).remaining,
    ),
    committed: income > 0 ? (expense / income) * 100 : null,
    entries,
  };
}
export function categoryTotals(data, month) {
  const entries = monthly(data, month).entries.filter((t) => t.kind === 'expense');
  return data.categories
    .filter((c) => c.kind === 'expense')
    .map((c) => ({
      ...c,
      value: sum(
        entries.filter(
          (t) =>
            t.category_id === c.id ||
            data.categories.find((sub) => sub.id === t.category_id)?.parent_id === c.id,
        ),
      ),
    }));
}
export function history(data, endMonth, count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const m = monthOf(addMonths(endMonth + '-01', i - count + 1));
    const stats = monthly(data, m),
      end = addMonths(m + '-01', 0, 31);
    return {
      month: m,
      name: monthLabel(m),
      ...stats,
      balance: cashBalance(data, end),
      worth: netWorth(data, end),
      debt: sum(
        data.debts.filter((d) => !d.balance_on || d.balance_on <= end),
        (d) =>
          d.balance_cents +
          sum(
            data.debt_payments.filter((p) => p.debt_id === d.id && p.paid_on > end),
            'principal_cents',
          ),
      ),
    };
  });
}
export function monthlyGoal(goal, date = today()) {
  const start = new Date(date + 'T12:00:00Z'),
    end = new Date(goal.deadline + 'T12:00:00Z');
  const months = Math.max(
    1,
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth() +
      (end.getUTCDate() >= start.getUTCDate() ? 1 : 0),
  );
  return Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / months);
}
export function debtSchedule(debt, extra = 0) {
  let balance = Math.max(0, debt.balance_cents - extra),
    interestTotal = 0;
  const rows = [];
  for (let i = 0; i < 600 && balance > 0; i++) {
    const interest = percentage(balance, debt.rate_bps),
      payment = Math.min(balance + interest, debt.payment_cents);
    if (payment <= interest) return { rows, interestTotal, unpayable: true, remaining: balance };
    const principal = payment - interest;
    balance -= principal;
    interestTotal += interest;
    rows.push({
      date: addMonths(debt.due_date, i, Number(debt.due_date.slice(8, 10))),
      payment,
      interest,
      principal,
      balance,
    });
  }
  return { rows, interestTotal, unpayable: balance > 0, remaining: balance };
}
export const SCENARIOS = {
  realistic: { name: 'Realista', income_bps: 10000, expense_bps: 10000 },
  conservative: { name: 'Conservador', income_bps: 9000, expense_bps: 11000 },
  optimistic: { name: 'Otimista', income_bps: 11000, expense_bps: 9000 },
};
export function project(
  data,
  {
    start = monthOf(today()),
    months = 6,
    scenario = SCENARIOS.realistic,
    asOf = today(),
    variable = true,
    goals = true,
  } = {},
) {
  if (!Number.isInteger(months) || months < 1 || months > 60)
    throw new Error('Escolha um horizonte entre 1 e 60 meses.');
  const current = monthOf(asOf),
    first = start < current ? current : start;
  if (first > monthOf(addMonths(current + '-01', 60)))
    throw new Error('Início fora do horizonte de cinco anos.');
  let balance = cashBalance(data, asOf);
  const previous = [1, 2, 3].map((n) => monthOf(addMonths(current + '-01', -n)));
  const all = recognizedEntries(data),
    txs = data.transactions.filter((t) => !t.canceled);
  const variableAverage = data.categories
    .filter((c) => c.kind === 'expense')
    .map((c) => ({
      id: c.id,
      amount: Math.round(
        sum(
          all.filter(
            (e) => e.category_id === c.id && !e.fixed && previous.includes(monthOf(e.date)),
          ),
        ) / 3,
      ),
    }));
  const cardPlan =
    scenario.purchase_cents > 0
      ? splitCents(
          scenario.purchase_cents,
          Math.min(scenario.installments || 1, scenario.purchase_cents),
        )
      : [];
  const debts = data.debts.flatMap((d) => debtSchedule(d).rows);
  const gap =
    (Number(first.slice(0, 4)) - Number(current.slice(0, 4))) * 12 +
    Number(first.slice(5)) -
    Number(current.slice(5));
  const rows = [];
  for (let i = 0; i < months + gap; i++) {
    const m = monthOf(addMonths(current + '-01', i));
    const relevant = txs.filter((t) => monthOf(t.due_date) === m || (i === 0 && t.due_date < asOf));
    let income = sum(
      relevant.filter((t) => t.kind === 'income'),
      (t) => transactionState(data, t).remaining,
    );
    let expense = sum(
      relevant.filter((t) => t.kind === 'expense'),
      (t) => transactionState(data, t).remaining,
    );
    // Virtual recurrence occurrences extend past the materialized horizon, without duplication.
    for (const r of data.recurrences.filter((r) => r.active)) {
      const date = addMonths(m + '-01', 0, r.day);
      if (
        date >= r.start_date &&
        date >= asOf &&
        (!r.end_date || date <= r.end_date) &&
        !data.transactions.some((t) => t.recurrence_id === r.id && t.due_date === date)
      ) {
        if (r.kind === 'income') income += r.amount_cents;
        else expense += r.amount_cents;
      }
    }
    expense += sum(
      data.invoices.filter((f) => monthOf(f.due_date) === m || (i === 0 && f.due_date < asOf)),
      (f) => invoiceState(data, f).remaining,
    );
    expense += sum(
      debts.filter((d) => monthOf(d.date) === m && d.date >= asOf),
      'payment',
    );
    const estimated = variable
      ? sum(
          variableAverage.filter(
            (c) => !all.some((e) => monthOf(e.date) === m && e.category_id === c.id),
          ),
          'amount',
        )
      : 0;
    expense += estimated;
    income = Math.max(
      0,
      percentage(income, scenario.income_bps ?? 10000) + (scenario.income_delta_cents || 0),
    );
    expense = Math.max(
      0,
      percentage(expense, scenario.expense_bps ?? 10000) +
        (scenario.expense_delta_cents || 0) +
        (cardPlan[i] || 0),
    );
    const saving = goals
      ? sum(
          data.goals.filter((g) => g.deadline >= m + '-01'),
          (g) => monthlyGoal(g, asOf),
        )
      : 0;
    balance += income - expense - saving;
    if (i >= gap)
      rows.push({
        month: m,
        name: monthLabel(m),
        income,
        expense,
        saving,
        result: income - expense,
        balance,
        estimated,
      });
  }
  return rows;
}
export function insights(data, month) {
  const stats = monthly(data, month),
    previous = monthly(data, monthOf(addMonths(month + '-01', -1))),
    out = [];
  if (previous.expense > 0 && stats.expense > previous.expense * 1.1)
    out.push({
      type: 'Fato',
      text: `Despesas ${Math.round((stats.expense / previous.expense - 1) * 100)}% maiores que no mês anterior.`,
      basis: `Competência: ${money(previous.expense)} → ${money(stats.expense)}.`,
    });
  for (const c of categoryTotals(data, month).filter(
    (c) => c.value > stats.expense * 0.3 && c.value > 0 && !c.parent_id,
  ))
    out.push({
      type: 'Fato',
      text: `${c.name} concentra ${Math.round((c.value / stats.expense) * 100)}% das despesas.`,
      basis: `${money(c.value)} de ${money(stats.expense)} na competência selecionada.`,
    });
  for (const f of data.invoices.filter(
    (f) => f.due_date <= addDays(today(), 7) && invoiceState(data, f).remaining > 0,
  ))
    out.push({
      type: 'Alerta',
      text: `Fatura ${data.cards.find((c) => c.id === f.card_id)?.name || ''}: ${f.due_date < today() ? 'vencida' : 'próxima do vencimento'}.`,
      basis: `Vencimento ${f.due_date.split('-').reverse().join('/')} · pendente ${money(invoiceState(data, f).remaining)}.`,
    });
  const negative = project(data).find((r) => r.balance < 0);
  if (negative)
    out.push({
      type: 'Estimativa',
      text: `Saldo livre pode ficar negativo em ${monthLabel(negative.month)}.`,
      basis:
        'Saldo atual, pendências, recorrências, parcelas, dívidas, metas e média variável de 3 meses.',
    });
  const variable = sum(stats.entries.filter((e) => e.kind === 'expense' && !e.fixed));
  if (variable > 0)
    out.push({
      type: 'Simulação',
      text: `Reduzir 10% dos gastos variáveis liberaria ${money(Math.round(variable * 0.1) * 12)} em um ano.`,
      basis: `Base mensal de ${money(variable)}; gastos mantidos por 12 meses.`,
    });
  for (const b of data.budgets.filter((b) => monthOf(b.month) === month)) {
    const c = categoryTotals(data, month).find((c) => c.id === b.category_id),
      pct = ((c?.value || 0) / b.limit_cents) * 100;
    if (pct >= 80)
      out.push({
        type: 'Alerta',
        text: `${c?.name}: ${Math.floor(pct)}% do orçamento utilizado.`,
        basis: `Faixa ${pct >= 100 ? '100%' : pct >= 90 ? '90%' : '80%'} · ${money(c?.value)} / ${money(b.limit_cents)}.`,
      });
  }
  const available = project(data, { goals: false })[0]?.result || 0;
  for (const g of data.goals.filter((g) => monthlyGoal(g) > Math.max(0, available)))
    out.push({
      type: 'Estimativa',
      text: `A meta ${g.name} precisa de revisão.`,
      basis: `Aporte necessário: ${money(monthlyGoal(g))}/mês; resultado projetado: ${money(available)}.`,
    });
  return out;
}
export function csv(rows) {
  const cell = (v) =>
    '"' +
    String(v ?? '')
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
