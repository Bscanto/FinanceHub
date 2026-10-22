import { z } from 'zod';
import { MAX_CENTS } from './money';
const text = z.string().trim().min(1, 'Campo obrigatório').max(200);
const note = z.string().max(2000).default('');
const id = z.string().uuid('Selecione um registro');
const nullableId = id.nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data')
  .refine(
    (v) =>
      v >= '1900-01-01' &&
      v <= '2100-12-31' &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    'Data inválida',
  );
const amount = z.number().int().min(1, 'Valor deve ser positivo').max(MAX_CENTS);
const zero = amount.min(0);
const signed = z.number().int().min(-MAX_CENTS).max(MAX_CENTS);
const kind = z.enum(['income', 'expense']);
const bps = z.number().int().min(0).max(30000);
export const schemas = {
  profiles: z.object({ name: text }),
  accounts: z.object({
    name: text,
    institution: note,
    kind: z.enum(['checking', 'savings', 'digital', 'cash', 'wallet', 'investment']),
    opening_cents: signed,
    opened_on: date,
  }),
  categories: z
    .object({
      name: text,
      kind,
      scope: z.enum(['home', 'personal', 'income']),
      parent_id: nullableId,
    })
    .refine((v) => (v.kind === 'income') === (v.scope === 'income'), 'Tipo e grupo incompatíveis'),
  transactions: z.object({
    description: text,
    kind,
    amount_cents: amount,
    category_id: id,
    account_id: id,
    due_date: date,
    competence: date,
    fixed: z.boolean(),
    method: z.enum(['pix', 'debit', 'cash', 'boleto', 'transfer']),
    notes: note,
  }),
  recurrences: z
    .object({
      description: text,
      kind,
      amount_cents: amount,
      category_id: id,
      account_id: id,
      start_date: date,
      end_date: date.nullable(),
      day: z.number().int().min(1).max(31),
      active: z.boolean(),
    })
    .refine((v) => !v.end_date || v.end_date >= v.start_date, 'Fim anterior ao início'),
  cards: z.object({
    name: text,
    institution: note,
    limit_cents: amount,
    closing_day: z.number().int().min(1).max(31),
    due_day: z.number().int().min(1).max(31),
  }),
  transfers: z
    .object({ source_id: id, destination_id: id, amount_cents: amount, transferred_on: date })
    .refine((v) => v.source_id !== v.destination_id, 'Selecione contas diferentes'),
  budgets: z.object({
    category_id: id,
    month: date.refine((v) => v.endsWith('-01'), 'Use o primeiro dia do mês'),
    limit_cents: amount,
  }),
  goals: z
    .object({ name: text, target_cents: amount, saved_cents: zero, deadline: date })
    .refine((v) => v.saved_cents <= v.target_cents, 'Acumulado maior que a meta'),
  debts: z.object({
    name: text,
    balance_on: date,
    original_cents: amount,
    balance_cents: zero,
    rate_bps: z.number().int().min(0).max(10000),
    payment_cents: amount,
    due_date: date,
    installments: z.number().int().min(1).max(600),
  }),
  investments: z.object({
    name: text,
    kind: text,
    opening_cents: zero,
    opened_on: date,
    emergency: z.boolean(),
  }),
  assets: z.object({ name: text, value_cents: zero, valued_on: date }),
  scenarios: z.object({
    name: text,
    income_bps: bps,
    expense_bps: bps,
    income_delta_cents: signed,
    expense_delta_cents: signed,
    purchase_cents: zero,
    installments: z.number().int().min(1).max(360),
  }),
  purchase: z
    .object({
      description: text,
      card_id: id,
      category_id: id,
      amount_cents: amount,
      purchased_on: date,
      count: z.number().int().min(1).max(360),
    })
    .refine((v) => v.amount_cents >= v.count, 'Parcelas menores que um centavo'),
  pay: z
    .object({
      transaction_id: nullableId,
      invoice_id: nullableId,
      account_id: id,
      amount_cents: amount,
      paid_on: date,
    })
    .refine(
      (v) => Boolean(v.transaction_id) !== Boolean(v.invoice_id),
      'Informe um lançamento ou fatura',
    ),
  amortize: z.object({
    debt_id: id,
    account_id: id,
    principal_cents: amount,
    interest_cents: zero,
    paid_on: date,
    next_due_date: date,
  }),
  invest: z
    .object({
      investment_id: id,
      account_id: nullableId,
      kind: z.enum(['deposit', 'withdrawal', 'yield']),
      amount_cents: amount,
      event_date: date,
    })
    .refine((v) => v.kind === 'yield' || v.account_id, 'Selecione a conta'),
  generate: z.object({ through: date }),
};
export const commandSchema = z.object({
  action: z.enum([
    'initialize',
    'create',
    'update',
    'delete',
    'generate',
    'purchase',
    'pay',
    'cancel',
    'reverse',
    'amortize',
    'invest',
  ]),
  entity: z.string().default(''),
  id: id.nullable().default(null),
  data: z.record(z.string(), z.unknown()).default({}),
});
export function validateCommand(input) {
  const command = commandSchema.parse(input);
  const key = ['create', 'update'].includes(command.action) ? command.entity : command.action;
  if (
    ['create', 'update', 'purchase', 'pay', 'amortize', 'invest', 'generate'].includes(
      command.action,
    )
  ) {
    if (!schemas[key]) throw new Error('Operação inválida');
    command.data = schemas[key].parse(command.data);
  }
  if (!['initialize', 'generate'].includes(command.action) && !command.id)
    throw new Error('Identificador obrigatório');
  return command;
}
