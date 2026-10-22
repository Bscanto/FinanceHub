'use client';
import { useState } from 'react';
import { Plus, Check, Repeat2, Ban, Search } from 'lucide-react';
import { useFinance } from './finance-provider';
import { Panel, Stat, DataTable, RowActions, RecordTable, PaymentHistory } from './shared';
import { Button } from './ui/button';
import { money } from '@/lib/finance/money';
import { dateLabel, monthOf, today } from '@/lib/finance/dates';
import { transactionState, sum, recognizedEntries, history } from '@/lib/finance/engine';
import { ComparisonChart } from './charts';
export function Transactions({ kind, month }) {
  const { data, open, destructive } = useFinance(),
    [query, setQuery] = useState(''),
    [scope, setScope] = useState('all'),
    [status, setStatus] = useState('all'),
    [category, setCategory] = useState('all');
  const categories = data.categories.filter((c) => c.kind === kind),
    list = data.transactions.filter((t) => t.kind === kind && monthOf(t.competence) === month);
  const rows = list.filter(
    (t) =>
      t.description.toLowerCase().includes(query.toLowerCase()) &&
      (scope === 'all' || data.categories.find((c) => c.id === t.category_id)?.scope === scope) &&
      (status === 'all' || transactionState(data, t).status === status) &&
      (category === 'all' || t.category_id === category),
  );
  const ids = new Set(rows.map((t) => t.id));
  const variableHistory = history(data, month, 6).map((r) => ({
    ...r,
    income: 0,
    expense: sum(
      r.entries.filter(
        (e) =>
          e.kind === 'expense' && !e.fixed && (category === 'all' || e.category_id === category),
      ),
    ),
  }));
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label={
            kind === 'income' ? 'Receitas previstas + recebidas' : 'Despesas previstas + pagas'
          }
          value={money(sum(list.filter((t) => !t.canceled)))}
        />
        <Stat
          label={kind === 'income' ? 'Recebido destes lançamentos' : 'Pago destes lançamentos'}
          value={money(sum(list, (t) => transactionState(data, t).paid))}
        />
        <Stat
          label="Saldo pendente"
          value={money(sum(list, (t) => transactionState(data, t).remaining))}
        />
      </div>
      <Panel
        title={kind === 'income' ? 'Suas receitas' : 'Suas despesas'}
        subtitle="Filtro por competência · pagamentos podem ocorrer em outro mês"
        action={
          <Button size="small" onClick={() => open('transactions', null, { kind })}>
            <Plus size={16} />
            Adicionar
          </Button>
        }
      >
        <div className="filters">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Buscar movimentação"
              placeholder="Buscar movimentação…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {kind === 'expense' && (
            <select
              aria-label="Grupo de despesas"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">Pessoais e residenciais</option>
              <option value="home">Residenciais</option>
              <option value="personal">Pessoais</option>
            </select>
          )}
          <select
            aria-label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}>
            {[
              'all',
              'Previsto',
              'Parcial',
              kind === 'income' ? 'Recebido' : 'Pago',
              'Cancelado',
            ].map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Todas as situações' : s}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          rows={rows.sort((a, b) => b.due_date.localeCompare(a.due_date))}
          columns={[
            {
              key: 'description',
              label: 'Descrição',
              render: (r) => (
                <div>
                  <strong>{r.description}</strong>
                  <small className="table-detail">
                    {data.categories.find((c) => c.id === r.category_id)?.name} ·{' '}
                    {r.fixed ? 'Fixa' : 'Variável'}
                  </small>
                </div>
              ),
            },
            {
              key: 'date',
              label: 'Vencimento',
              render: (r) => (
                <span
                  className={
                    !r.canceled && transactionState(data, r).remaining > 0 && r.due_date < today()
                      ? 'red'
                      : ''
                  }
                >
                  {dateLabel(r.due_date)}
                </span>
              ),
            },
            { key: 'value', label: 'Valor', render: (r) => money(r.amount_cents) },
            {
              key: 'status',
              label: 'Situação',
              render: (r) => (
                <span
                  className={`badge ${transactionState(data, r).remaining === 0 && !r.canceled ? 'green-badge' : ''}`}
                >
                  {transactionState(data, r).status}
                </span>
              ),
            },
            {
              key: 'remaining',
              label: 'Pendente',
              render: (r) => money(transactionState(data, r).remaining),
            },
            {
              key: 'actions',
              label: 'Ações',
              render: (r) => (
                <RowActions
                  entity="transactions"
                  row={r}
                  canEdit={!transactionState(data, r).paid}
                  canDelete={!transactionState(data, r).paid}
                >
                  {!r.canceled && transactionState(data, r).remaining > 0 && (
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() =>
                        open('pay', null, {
                          transaction_id: r.id,
                          account_id: r.account_id,
                          amount_cents: transactionState(data, r).remaining,
                        })
                      }
                    >
                      <Check size={15} />
                      {kind === 'income' ? 'Receber' : 'Pagar'}
                    </Button>
                  )}
                  {!r.canceled && !transactionState(data, r).paid && (
                    <button
                      className="icon-button"
                      aria-label={`Cancelar ${r.description}`}
                      onClick={() =>
                        destructive(
                          'cancel',
                          'transactions',
                          r.id,
                          'Cancelar mantém o histórico e remove o lançamento dos cálculos.',
                        )
                      }
                    >
                      <Ban size={15} />
                    </button>
                  )}
                </RowActions>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Pagamentos e recebimentos"
        subtitle="Histórico dos lançamentos filtrados · estorne antes de editar um lançamento pago"
      >
        <PaymentHistory rows={data.payments.filter((p) => ids.has(p.transaction_id))} />
      </Panel>
      <Panel
        title="Recorrências mensais"
        subtitle="Próximos 12 meses gerados automaticamente, sem duplicação"
        action={
          <Button
            size="small"
            variant="secondary"
            onClick={() => open('recurrences', null, { kind })}
          >
            <Repeat2 size={16} />
            Nova recorrência
          </Button>
        }
      >
        <RecordTable
          entity="recurrences"
          rows={data.recurrences.filter((r) => r.kind === kind)}
          fields={['description', 'amount_cents', 'day', 'start_date', 'end_date', 'active']}
        />
        <p className="panel-footnote">
          Editar uma recorrência regenera apenas ocorrências futuras sem pagamento. Excluir preserva
          os lançamentos com pagamentos e remove os demais da série.
        </p>
      </Panel>
      {kind === 'expense' && (
        <Panel
          title="Histórico de despesas variáveis"
          subtitle="Valores por competência · categoria selecionada"
        >
          <ComparisonChart rows={variableHistory} />
          <p className="panel-footnote">
            As projeções usam a média dos três meses anteriores, incluindo meses sem gastos como
            zero. Uma categoria já programada no mês não recebe estimativa adicional.
          </p>
        </Panel>
      )}
    </>
  );
}
