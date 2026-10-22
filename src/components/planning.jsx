'use client';
import { useState } from 'react';
import { Plus, Sparkles, Target, CalendarDays } from 'lucide-react';
import { useFinance } from './finance-provider';
import {
  Panel,
  Stat,
  RecordTable,
  DataTable,
  Progress,
  RowActions,
  Empty,
  PaymentHistory,
} from './shared';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { FlowChart } from './charts';
import {
  project,
  SCENARIOS,
  categoryTotals,
  monthlyGoal,
  transactionState,
  invoiceState,
} from '@/lib/finance/engine';
import { money } from '@/lib/finance/money';
import { today, monthOf, monthLabel, dateLabel, addMonths } from '@/lib/finance/dates';
export function Planning() {
  const { data, open } = useFinance(),
    [scenario, setScenario] = useState('realistic'),
    [months, setMonths] = useState(6),
    [start, setStart] = useState(monthOf(today())),
    [variable, setVariable] = useState(true),
    [goals, setGoals] = useState(true);
  const selected =
    SCENARIOS[scenario] || data.scenarios.find((s) => s.id === scenario) || SCENARIOS.realistic;
  const rows = project(data, { months, start, scenario: selected, variable, goals });
  return (
    <>
      <div className="planning-intro">
        <Sparkles size={22} />
        <div>
          <h2>Dê espaço para os seus próximos passos.</h2>
          <p>Explore possibilidades com seus dados reais, sem alterar seus lançamentos.</p>
        </div>
      </div>
      <Panel
        title="Simulador financeiro"
        subtitle="Projeção de caixa · estimativas não são garantia de resultado"
        action={
          <Button size="small" onClick={() => open('scenarios')}>
            <Plus size={16} />
            Criar cenário
          </Button>
        }
      >
        <div className="filters">
          <label>
            Início
            <input
              aria-label="Início da projeção"
              type="month"
              min={monthOf(today())}
              max={monthOf(addMonths(today(), 60))}
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                if (v >= monthOf(today()) && v <= monthOf(addMonths(today(), 60))) setStart(v);
              }}
            />
          </label>
          <label>
            Horizonte
            <input
              type="number"
              min="1"
              max="60"
              value={months}
              aria-label="Horizonte em meses"
              onChange={(e) =>
                setMonths(Math.max(1, Math.min(60, Math.floor(Number(e.target.value) || 1))))
              }
            />
          </label>
          <label>
            Cenário
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {Object.entries(SCENARIOS).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.name}
                </option>
              ))}
              {data.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={variable}
              onChange={(e) => setVariable(e.target.checked)}
            />
            Estimar variáveis
          </label>
          <label className="inline-check">
            <input type="checkbox" checked={goals} onChange={(e) => setGoals(e.target.checked)} />
            Reservar para metas
          </label>
        </div>
        <FlowChart rows={rows} balance />
        <DataTable
          rows={rows}
          columns={[
            { key: 'month', label: 'Mês', render: (r) => monthLabel(r.month) },
            { key: 'income', label: 'Receitas', render: (r) => money(r.income) },
            { key: 'expense', label: 'Despesas', render: (r) => money(r.expense) },
            { key: 'result', label: 'Resultado', render: (r) => money(r.result) },
            { key: 'saving', label: 'Reserva para metas', render: (r) => money(r.saving) },
            {
              key: 'balance',
              label: 'Saldo livre projetado',
              render: (r) => (
                <strong className={r.balance < 0 ? 'red' : 'green'}>{money(r.balance)}</strong>
              ),
            },
          ]}
        />
        <div className="assumptions">
          <strong>Premissas deste cenário</strong>
          <p>
            Receitas: {(selected.income_bps / 100).toLocaleString('pt-BR')}% da base; despesas:{' '}
            {(selected.expense_bps / 100).toLocaleString('pt-BR')}% da base. Ajustes mensais:{' '}
            {money(selected.income_delta_cents || 0)} em receitas e{' '}
            {money(selected.expense_delta_cents || 0)} em despesas.
          </p>
          <p>
            Parte do saldo atual e inclui valores ainda pendentes, atrasados no primeiro mês,
            recorrências, faturas, dívidas e{' '}
            {goals ? 'reservas mensais para metas' : 'nenhuma reserva para metas'}. Estimativa
            variável: média dos três meses anteriores, aplicada somente quando a categoria não tem
            lançamento no mês. Contas e investimentos não são liquidados automaticamente.
          </p>
          <p>
            Compras simuladas são distribuídas desde o primeiro mês. O saldo exibido desconta as
            reservas de metas, mas essas reservas não são despesas nem movimentações reais.
          </p>
        </div>
      </Panel>
      <Panel
        title="Seus cenários"
        subtitle="Salve premissas de aumento salarial, redução de renda, compras ou novas despesas"
      >
        <RecordTable
          entity="scenarios"
          rows={data.scenarios}
          fields={[
            'name',
            'income_bps',
            'expense_bps',
            'income_delta_cents',
            'expense_delta_cents',
            'purchase_cents',
          ]}
        />
      </Panel>
    </>
  );
}
export function Budgets({ month }) {
  const { data, open } = useFinance(),
    totals = categoryTotals(data, month),
    rows = data.budgets.filter((b) => monthOf(b.month) === month);
  return (
    <>
      <div className="section-toolbar">
        <p>Pequenos limites ajudam a proteger grandes planos.</p>
        <Button onClick={() => open('budgets', null, { month: month + '-01' })}>
          <Plus size={16} />
          Novo orçamento
        </Button>
      </div>
      {rows.length ? (
        <div className="entity-grid">
          {rows.map((b) => {
            const category = totals.find((c) => c.id === b.category_id),
              value = category?.value || 0,
              pct = (value / b.limit_cents) * 100;
            return (
              <article key={b.id} className="panel budget-card">
                <div className="between">
                  <h2>{category?.name}</h2>
                  <RowActions entity="budgets" row={b} />
                </div>
                <strong className="large-money">{money(value)}</strong>
                <p>de {money(b.limit_cents)} previstos</p>
                <Progress value={pct} />
                <div className="between">
                  <span className={pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'green'}>
                    {Math.round(pct)}% utilizado
                  </span>
                  <small>{money(Math.max(0, b.limit_cents - value))} disponíveis</small>
                </div>
                {pct >= 80 && (
                  <div className="budget-alert">
                    {pct >= 100
                      ? 'Limite atingido'
                      : pct >= 90
                        ? 'Atenção: mais de 90% utilizados'
                        : 'Você atingiu 80% do limite'}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Panel title="Orçamentos do mês">
          <Empty
            title="Encontre o seu ponto de equilíbrio"
            description="Defina limites por categoria e receba avisos ao atingir 80%, 90% e 100%."
            onAdd={() => open('budgets', null, { month: month + '-01' })}
          />
        </Panel>
      )}
    </>
  );
}
export function Goals() {
  const { data, open } = useFinance(),
    available = project(data, { months: 1, goals: false })[0]?.result || 0;
  return (
    <>
      <div className="section-toolbar">
        <p>Transforme seus objetivos em contribuições possíveis.</p>
        <Button onClick={() => open('goals')}>
          <Plus size={16} />
          Nova meta
        </Button>
      </div>
      {data.goals.length ? (
        <div className="entity-grid">
          {data.goals.map((g) => {
            const contribution = monthlyGoal(g),
              viable = contribution <= Math.max(0, available),
              done = g.saved_cents >= g.target_cents;
            return (
              <article key={g.id} className="panel goal-card">
                <div className="between">
                  <span className="account-icon">
                    <Target size={24} />
                  </span>
                  <RowActions entity="goals" row={g} />
                </div>
                <h2>{g.name}</h2>
                <p>Até {dateLabel(g.deadline)}</p>
                <strong className="large-money">{money(g.saved_cents)}</strong>
                <p>de {money(g.target_cents)}</p>
                <Progress value={(g.saved_cents / g.target_cents) * 100} />
                <div className="between">
                  <span>Contribuição necessária</span>
                  <strong>{money(contribution)}/mês</strong>
                </div>
                <p className={`badge ${done || viable ? 'green-badge' : 'amber-badge'}`}>
                  {done
                    ? 'Meta alcançada'
                    : g.deadline < today()
                      ? 'Prazo encerrado'
                      : viable
                        ? 'Compatível com o resultado estimado'
                        : 'Requer ajuste no planejamento'}
                </p>
                <small className="table-detail">
                  Estimativa individual: compara o aporte com {money(available)} disponíveis no mês
                  atual. O planejamento considera todas as metas juntas.
                </small>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel title="Seus objetivos">
          <Empty
            title="O primeiro passo de uma conquista"
            description="Reserva de emergência, viagem, imóvel: escolha o que importa para você."
            onAdd={() => open('goals')}
          />
        </Panel>
      )}
    </>
  );
}
export function Calendar({ month }) {
  const [selection, setSelection] = useState(null);
  const { data, open } = useFinance(),
    days = Number(addMonths(month + '-01', 0, 31).slice(8)),
    offset = new Date(month + '-01T12:00:00Z').getUTCDay();
  const transactions = data.transactions.filter(
      (t) => monthOf(t.due_date) === month && !t.canceled,
    ),
    invoices = data.invoices.filter(
      (i) => monthOf(i.due_date) === month && invoiceState(data, i).total > 0,
    );
  return (
    <>
      <Panel
        title={monthLabel(month)}
        subtitle="Clique em um lançamento para editar ou em uma fatura para pagar"
      >
        <div className="calendar-legend">
          <span className="green">● Receita</span>
          <span>● Despesa</span>
          <span className="red">● Atrasada</span>
          <span className="purple">● Fatura</span>
        </div>
        <div className="calendar-grid">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <strong className="weekday" key={d}>
              {d}
            </strong>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div className="calendar-blank" key={'blank' + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = month + '-' + String(i + 1).padStart(2, '0');
            return (
              <div className={`calendar-day ${date === today() ? 'is-today' : ''}`} key={date}>
                <span>{i + 1}</span>
                {transactions
                  .filter((t) => t.due_date === date)
                  .map((t) => {
                    const s = transactionState(data, t);
                    return (
                      <button
                        key={t.id}
                        className={`calendar-event ${t.kind === 'income' ? 'income' : ''} ${s.remaining > 0 && date < today() ? 'overdue' : ''}`}
                        onClick={() =>
                          s.paid
                            ? setSelection({ type: 'transaction', row: t })
                            : open('transactions', t)
                        }
                        title={`${t.description} · ${s.status}`}
                      >
                        <strong>{t.description}</strong>
                        <small>
                          {money(t.amount_cents)} · {s.status}
                        </small>
                      </button>
                    );
                  })}
                {invoices
                  .filter((f) => f.due_date === date)
                  .map((f) => (
                    <button
                      className="calendar-event invoice"
                      key={f.id}
                      onClick={() =>
                        invoiceState(data, f).remaining > 0
                          ? open('pay', null, {
                              invoice_id: f.id,
                              amount_cents: invoiceState(data, f).remaining,
                            })
                          : setSelection({ type: 'invoice', row: f })
                      }
                    >
                      <strong>{data.cards.find((c) => c.id === f.card_id)?.name}</strong>
                      <small>Fatura · {money(invoiceState(data, f).remaining)}</small>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </Panel>
      {selection && (
        <Modal
          open
          onOpenChange={(v) => !v && setSelection(null)}
          title={selection.type === 'invoice' ? 'Pagamentos da fatura' : selection.row.description}
          description="Estorne os pagamentos antes de editar um lançamento realizado."
        >
          <PaymentHistory
            rows={data.payments.filter((p) =>
              selection.type === 'invoice'
                ? p.invoice_id === selection.row.id
                : p.transaction_id === selection.row.id,
            )}
          />
          {selection.type === 'transaction' && (
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={transactionState(data, selection.row).paid > 0}
                onClick={() => {
                  open('transactions', selection.row);
                  setSelection(null);
                }}
              >
                Editar lançamento
              </Button>
              {transactionState(data, selection.row).remaining > 0 && (
                <Button
                  onClick={() => {
                    open('pay', null, {
                      transaction_id: selection.row.id,
                      account_id: selection.row.account_id,
                      amount_cents: transactionState(data, selection.row).remaining,
                    });
                    setSelection(null);
                  }}
                >
                  Registrar restante
                </Button>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
