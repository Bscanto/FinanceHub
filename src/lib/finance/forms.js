import { today } from './dates';
const f = (key, label, type = 'text', options) => ({ key, label, type, options });
const account = (key = 'account_id', label = 'Conta') => f(key, label, 'select', 'accounts');
const category = f('category_id', 'Categoria', 'select', 'categories');
const description = f('description', 'Descrição');
const amount = f('amount_cents', 'Valor (R$)', 'money');
const name = f('name', 'Nome');
const kind = f('kind', 'Tipo', 'select', [
  ['income', 'Receita'],
  ['expense', 'Despesa'],
]);
export const DEFINITIONS = {
  accounts: {
    title: 'Conta ou carteira',
    fields: [
      name,
      f('institution', 'Instituição'),
      f('kind', 'Tipo de conta', 'select', [
        ['checking', 'Conta corrente'],
        ['savings', 'Poupança'],
        ['digital', 'Conta digital'],
        ['cash', 'Dinheiro'],
        ['wallet', 'Carteira digital'],
        ['investment', 'Conta de investimentos'],
      ]),
      f('opening_cents', 'Saldo inicial (R$)', 'money'),
      f('opened_on', 'Data do saldo inicial', 'date'),
    ],
    defaults: { kind: 'checking', opening_cents: 0 },
  },
  categories: {
    title: 'Categoria',
    fields: [
      name,
      kind,
      f('scope', 'Grupo', 'select', [
        ['personal', 'Pessoal'],
        ['home', 'Residencial'],
        ['income', 'Receitas'],
      ]),
      f('parent_id', 'Categoria principal (opcional)', 'optional-select', 'parent_categories'),
    ],
    defaults: { kind: 'expense', scope: 'personal', parent_id: null },
  },
  transactions: {
    title: 'Movimentação',
    fields: [
      kind,
      description,
      amount,
      category,
      account(),
      f('due_date', 'Data prevista', 'date'),
      f('competence', 'Data de competência', 'date'),
      f('method', 'Forma de pagamento', 'select', [
        ['pix', 'Pix'],
        ['debit', 'Débito'],
        ['cash', 'Dinheiro'],
        ['boleto', 'Boleto'],
        ['transfer', 'Transferência bancária'],
      ]),
      f('fixed', 'Despesa / receita fixa', 'checkbox'),
      f('notes', 'Observações', 'textarea'),
    ],
    defaults: { kind: 'expense', amount_cents: 0, fixed: false, method: 'pix', notes: '' },
  },
  recurrences: {
    title: 'Recorrência mensal',
    fields: [
      kind,
      description,
      amount,
      category,
      account(),
      f('start_date', 'Início', 'date'),
      f('end_date', 'Fim (opcional)', 'optional-date'),
      f('day', 'Dia do mês', 'number'),
      f('active', 'Recorrência ativa', 'checkbox'),
    ],
    defaults: { kind: 'income', day: 5, active: true, end_date: null },
  },
  cards: {
    title: 'Cartão de crédito',
    fields: [
      name,
      f('institution', 'Instituição'),
      f('limit_cents', 'Limite (R$)', 'money'),
      f('closing_day', 'Dia de fechamento', 'number'),
      f('due_day', 'Dia de vencimento', 'number'),
    ],
    defaults: { closing_day: 25, due_day: 5 },
  },
  transfers: {
    title: 'Transferência entre contas',
    fields: [
      account('source_id', 'Conta de origem'),
      account('destination_id', 'Conta de destino'),
      amount,
      f('transferred_on', 'Data da transferência', 'date'),
    ],
  },
  budgets: {
    title: 'Orçamento mensal',
    fields: [
      category,
      f('month', 'Competência', 'month'),
      f('limit_cents', 'Limite mensal (R$)', 'money'),
    ],
  },
  goals: {
    title: 'Meta financeira',
    fields: [
      name,
      f('target_cents', 'Valor desejado (R$)', 'money'),
      f('saved_cents', 'Valor já reservado (R$)', 'money'),
      f('deadline', 'Prazo', 'date'),
    ],
    defaults: { saved_cents: 0 },
  },
  debts: {
    title: 'Dívida ou financiamento',
    fields: [
      name,
      f('balance_on', 'Data do saldo devedor inicial', 'date'),
      f('original_cents', 'Valor original (R$)', 'money'),
      f('balance_cents', 'Saldo devedor atual (R$)', 'money'),
      f('rate_bps', 'Taxa mensal (%)', 'percent'),
      f('payment_cents', 'Parcela mensal (R$)', 'money'),
      f('due_date', 'Próximo vencimento', 'date'),
      f('installments', 'Parcelas contratadas restantes', 'number'),
    ],
    defaults: { rate_bps: 0, installments: 12 },
  },
  investments: {
    title: 'Investimento',
    fields: [
      name,
      f('kind', 'Tipo de investimento'),
      f('opening_cents', 'Posição inicial (R$)', 'money'),
      f('opened_on', 'Data da posição inicial', 'date'),
      f('emergency', 'Reserva de emergência', 'checkbox'),
    ],
    defaults: { kind: 'Renda fixa', opening_cents: 0, emergency: false },
  },
  assets: {
    title: 'Bem patrimonial',
    fields: [
      name,
      f('value_cents', 'Valor estimado (R$)', 'money'),
      f('valued_on', 'Data da avaliação', 'date'),
    ],
  },
  scenarios: {
    title: 'Cenário de simulação',
    fields: [
      name,
      f('income_bps', 'Receitas esperadas (% da base)', 'percent'),
      f('expense_bps', 'Despesas esperadas (% da base)', 'percent'),
      f('income_delta_cents', 'Ajuste mensal de receita (R$)', 'money'),
      f('expense_delta_cents', 'Ajuste mensal de despesa (R$)', 'money'),
      f('purchase_cents', 'Compra simulada (R$)', 'money'),
      f('installments', 'Parcelas da compra simulada', 'number'),
    ],
    defaults: {
      income_bps: 10000,
      expense_bps: 10000,
      income_delta_cents: 0,
      expense_delta_cents: 0,
      purchase_cents: 0,
      installments: 1,
    },
  },
  purchase: {
    title: 'Compra no cartão',
    action: 'purchase',
    fields: [
      description,
      f('card_id', 'Cartão', 'select', 'cards'),
      category,
      amount,
      f('purchased_on', 'Data da compra', 'date'),
      f('count', 'Número de parcelas', 'number'),
    ],
    defaults: { count: 1 },
  },
  pay: {
    title: 'Registrar pagamento / recebimento',
    action: 'pay',
    fields: [account(), amount, f('paid_on', 'Data efetiva', 'date')],
    hidden: ['transaction_id', 'invoice_id'],
    defaults: { transaction_id: null, invoice_id: null },
  },
  amortize: {
    title: 'Amortização de dívida',
    action: 'amortize',
    fields: [
      f('debt_id', 'Dívida', 'select', 'debts'),
      account(),
      f('principal_cents', 'Principal amortizado (R$)', 'money'),
      f('interest_cents', 'Juros pagos (R$)', 'money'),
      f('paid_on', 'Data do pagamento', 'date'),
      f('next_due_date', 'Próximo vencimento após o pagamento', 'date'),
    ],
    defaults: { interest_cents: 0 },
  },
  invest: {
    title: 'Movimentar investimento',
    action: 'invest',
    fields: [
      f('investment_id', 'Investimento', 'select', 'investments'),
      f('kind', 'Operação', 'select', [
        ['deposit', 'Aporte'],
        ['withdrawal', 'Resgate'],
        ['yield', 'Rendimento registrado'],
      ]),
      f('account_id', 'Conta de origem / destino', 'optional-select', 'accounts'),
      amount,
      f('event_date', 'Data efetiva', 'date'),
    ],
    defaults: { kind: 'deposit', account_id: null },
  },
  profiles: { title: 'Seu perfil', fields: [name] },
};
export function defaultsFor(entity) {
  const d = DEFINITIONS[entity];
  return Object.fromEntries(
    d.fields.map((f) => [
      f.key,
      d.defaults?.[f.key] ??
        (f.type === 'date'
          ? today()
          : f.type === 'month'
            ? today().slice(0, 7) + '-01'
            : f.type === 'checkbox'
              ? false
              : f.type.startsWith('optional')
                ? null
                : ['money', 'number', 'percent'].includes(f.type)
                  ? 0
                  : ''),
    ]),
  );
}
