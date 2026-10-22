'use client';
import Link from 'next/link';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  ArrowRight,
  Sparkles,
  Plus,
  Target,
} from 'lucide-react';
import { useFinance } from './finance-provider';
import { Panel, Stat, Empty, Progress, DataTable } from './shared';
import { FlowChart, CategoryChart } from './charts';
import { Button } from './ui/button';
import {
  monthly,
  cashBalance,
  netWorth,
  history,
  categoryTotals,
  insights,
  transactionState,
  project,
  monthlyGoal,
  invoiceState,
} from '@/lib/finance/engine';
import { money } from '@/lib/finance/money';
import { dateLabel, today } from '@/lib/finance/dates';
export function Overview({ month }) {
  const { data, open } = useFinance(),
    stats = monthly(data, month),
    hasData = data.transactions.length + data.purchases.length > 0,
    analysis = insights(data, month).slice(0, 3);
  const upcoming = data.transactions
    .filter((t) => !t.canceled && transactionState(data, t).remaining > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);
  const name = data.profiles[0]?.name?.split(' ')[0];
  return (
    <>
      <div className="welcome-strip">
        <div>
          <span className="eyebrow">SEU DINHEIRO, COM MAIS CLAREZA</span>
          <h2>{name ? `${name}, cada escolha conta.` : 'Seu futuro começa com organização.'}</h2>
          <p>Acompanhe o presente. Planeje o que vem pela frente.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <ChartNoAxesCombined size={39} />
        </div>
      </div>
      {!data.accounts.length && (
        <div className="onboarding">
          <div>
            <strong>Vamos dar o primeiro passo?</strong>
            <p>Cadastre uma conta com seu saldo inicial e comece a organizar suas movimentações.</p>
          </div>
          <Button variant="secondary" size="small" onClick={() => open('accounts')}>
            <Plus size={16} />
            Adicionar conta
          </Button>
        </div>
      )}
      <div className="stats-grid">
        <Stat
          label="Saldo disponível"
          value={money(cashBalance(data))}
          hint="Saldo de caixa atual · todas as contas"
          icon={Wallet}
          featured
        />
        <Stat
          label="Receitas do mês"
          value={money(stats.income)}
          hint={`${money(stats.received)} efetivamente recebidos`}
          icon={ArrowDownLeft}
          tone="green"
        />
        <Stat
          label="Despesas do mês"
          value={money(stats.expense)}
          hint="Por competência · inclui parcelas"
          icon={ArrowUpRight}
        />
        <Stat
          label="Resultado do mês"
          value={money(stats.result)}
          hint="Receitas menos despesas por competência"
          icon={ChartNoAxesCombined}
          tone={stats.result < 0 ? 'red' : 'green'}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Seu fluxo financeiro"
          subtitle="Receitas e despesas por competência · últimos 6 meses"
          action={
            <Link className="text-link" href="/reports">
              Ver relatório <ArrowUpRight size={14} />
            </Link>
          }
        >
          {hasData ? (
            <FlowChart rows={history(data, month, 6)} />
          ) : (
            <Empty
              title="Sua história financeira começa agora"
              description="As receitas e despesas cadastradas aparecerão neste gráfico."
              onAdd={() => open('transactions')}
              label="Nova movimentação"
            />
          )}
        </Panel>
        <Panel title="Para onde vai seu dinheiro" subtitle="Distribuição das despesas do mês">
          <CategoryChart rows={categoryTotals(data, month)} />
        </Panel>
      </div>
      <div className="mini-stats">
        <div>
          <span>A receber no mês</span>
          <strong className="green">{money(stats.receivable)}</strong>
        </div>
        <div>
          <span>Contas pendentes no mês</span>
          <strong>{money(stats.payable)}</strong>
        </div>
        <div>
          <span>Faturas pendentes no mês</span>
          <strong>{money(stats.invoices)}</strong>
        </div>
        <div>
          <span>Renda comprometida</span>
          <strong>
            {stats.committed === null ? '—' : `${stats.committed.toFixed(1).replace('.', ',')}%`}
          </strong>
        </div>
        <div>
          <span>Disponível para economizar¹</span>
          <strong>
            {money(Math.max(0, project(data, { months: 1, goals: false })[0]?.result || 0))}
          </strong>
        </div>
        <div>
          <span>Patrimônio líquido</span>
          <strong>{money(netWorth(data))}</strong>
        </div>
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Próximos compromissos"
          subtitle="Pendências em aberto, incluindo atrasadas"
          action={
            <Link className="text-link" href="/calendar">
              Ver calendário <ArrowRight size={14} />
            </Link>
          }
        >
          <DataTable
            rows={upcoming}
            empty={
              <Empty
                title="Tudo em dia por aqui"
                description="Suas movimentações pendentes aparecerão aqui."
              />
            }
            columns={[
              {
                key: 'description',
                label: 'Movimentação',
                render: (r) => (
                  <div className="transaction-name">
                    <span className={`transaction-icon ${r.kind === 'income' ? 'green' : ''}`}>
                      {r.kind === 'income' ? (
                        <ArrowDownLeft size={17} />
                      ) : (
                        <ArrowUpRight size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{r.description}</strong>
                      <small>{data.categories.find((c) => c.id === r.category_id)?.name}</small>
                    </div>
                  </div>
                ),
              },
              {
                key: 'due_date',
                label: 'Vencimento',
                render: (r) => (
                  <span className={r.due_date < today() ? 'red' : ''}>{dateLabel(r.due_date)}</span>
                ),
              },
              {
                key: 'amount',
                label: 'Pendente',
                render: (r) => <strong>{money(transactionState(data, r).remaining)}</strong>,
              },
              {
                key: 'action',
                label: '',
                render: (r) => (
                  <button
                    className="icon-button"
                    aria-label={`Registrar ${r.description}`}
                    onClick={() =>
                      open('pay', null, {
                        transaction_id: r.id,
                        account_id: r.account_id,
                        amount_cents: transactionState(data, r).remaining,
                      })
                    }
                  >
                    <ArrowRight size={16} />
                  </button>
                ),
              },
            ]}
          />
        </Panel>
        <Panel
          title="Planos que ganham vida"
          subtitle="Um pouco hoje, mais perto amanhã"
          action={
            <Link className="text-link" href="/goals">
              Ver metas <ArrowRight size={14} />
            </Link>
          }
        >
          {data.goals.length ? (
            <div className="goal-list">
              {data.goals.slice(0, 3).map((g) => (
                <div key={g.id}>
                  <div className="between">
                    <span>
                      <Target size={17} />
                      {g.name}
                    </span>
                    <strong>{Math.round((g.saved_cents / g.target_cents) * 100)}%</strong>
                  </div>
                  <Progress value={(g.saved_cents / g.target_cents) * 100} />
                  <div className="between muted">
                    <small>
                      {money(g.saved_cents)} de {money(g.target_cents)}
                    </small>
                    <small>{money(monthlyGoal(g))}/mês</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="O que você quer conquistar?"
              description="Defina uma meta e descubra quanto reservar por mês."
              onAdd={() => open('goals')}
              label="Criar primeira meta"
            />
          )}
        </Panel>
      </div>
      <Panel
        title={
          <>
            <Sparkles size={18} /> Um olhar sobre suas finanças
          </>
        }
        subtitle="Análises matemáticas com base nos seus registros"
        className="insights-panel"
      >
        <div className="insights-grid">
          {analysis.length ? (
            analysis.map((a, i) => (
              <article key={i}>
                <span className="badge">{a.type}</span>
                <h3>{a.text}</h3>
                <p>{a.basis}</p>
              </article>
            ))
          ) : (
            <article>
              <span className="badge">Comece por aqui</span>
              <h3>Mais registros, melhores decisões.</h3>
              <p>
                Cadastre receitas, despesas e metas. As análises aparecerão quando houver dados
                suficientes.
              </p>
            </article>
          )}
        </div>
      </Panel>
      <p className="footnote">
        ¹ Estimativa do resultado de caixa restante deste mês, antes das metas. Valores projetados
        não são garantia de disponibilidade.
      </p>
    </>
  );
}
