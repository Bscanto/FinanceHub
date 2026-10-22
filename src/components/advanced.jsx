'use client';
import { useState } from 'react';
import { Plus, Download, Printer, Sprout, Landmark } from 'lucide-react';
import { useFinance } from './finance-provider';
import { Panel, Stat, RecordTable, RowActions, DataTable, PaymentHistory, Empty } from './shared';
import { Button } from './ui/button';
import { FlowChart, ComparisonChart } from './charts';
import { money, cents } from '@/lib/finance/money';
import { dateLabel, monthOf, monthLabel, today, addMonths } from '@/lib/finance/dates';
import {
  debtSchedule,
  investmentBalance,
  netWorth,
  history,
  monthly,
  categoryTotals,
  sum,
  insights,
  csv,
  recognizedEntries,
  cashEntries,
} from '@/lib/finance/engine';
export function Debts() {
  const { data, open } = useFinance(),
    [selected, setSelected] = useState(''),
    [extra, setExtra] = useState('0,00');
  const debt = data.debts.find((d) => d.id === selected) || data.debts[0];
  let amount = 0,
    error = '';
  try {
    amount = cents(extra);
    if (amount < 0 || amount > (debt?.balance_cents || 0))
      error = 'Informe um valor entre zero e o saldo devedor.';
  } catch {
    error = 'Informe um valor como 1.000,00.';
  }
  const original = debt ? debtSchedule(debt) : null,
    simulation = debt && !error ? debtSchedule(debt, amount) : null;
  return (
    <>
      <div className="section-toolbar">
        <p>Entenda o custo das dívidas e planeje a quitação.</p>
        <Button onClick={() => open('debts')}>
          <Plus size={16} />
          Nova dívida
        </Button>
      </div>
      <div className="stats-grid three">
        <Stat label="Saldo devedor" value={money(sum(data.debts, 'balance_cents'))} />
        <Stat
          label="Principal amortizado"
          value={money(sum(data.debt_payments, 'principal_cents'))}
        />
        <Stat label="Juros registrados" value={money(sum(data.debt_payments, 'interest_cents'))} />
      </div>
      <Panel title="Dívidas e financiamentos">
        <RecordTable
          entity="debts"
          rows={data.debts}
          fields={[
            'name',
            'original_cents',
            'balance_cents',
            'rate_bps',
            'payment_cents',
            'due_date',
          ]}
          extra={[
            {
              key: 'pay',
              label: 'Amortizar',
              render: (d) => (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() =>
                    open('amortize', null, {
                      debt_id: d.id,
                      next_due_date: addMonths(d.due_date, 1, Number(d.due_date.slice(8))),
                      principal_cents: Math.min(d.balance_cents, d.payment_cents),
                    })
                  }
                  disabled={d.balance_cents <= 0}
                >
                  Registrar pagamento
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      {debt && (
        <Panel
          title="Simular antecipação"
          subtitle="Modelo de prestação fixa, juros mensais sobre o saldo · sem tarifas ou seguros"
        >
          <div className="filters">
            <label>
              Dívida
              <select value={debt.id} onChange={(e) => setSelected(e.target.value)}>
                {data.debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amortização extra (R$)
              <input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" />
            </label>
          </div>
          {error ? (
            <p className="error-text">{error}</p>
          ) : (
            <>
              <div className="stats-grid three">
                <Stat
                  label="Prazo estimado após antecipação"
                  value={simulation.unpayable ? 'Não amortiza' : `${simulation.rows.length} meses`}
                />
                <Stat
                  label="Economia estimada de juros"
                  value={money(Math.max(0, original.interestTotal - simulation.interestTotal))}
                />
                <Stat label="Saída de caixa imediata simulada" value={money(amount)} />
              </div>
              {simulation.unpayable && (
                <p className="error-text">
                  A prestação não cobre os juros ou a dívida excede o horizonte de 600 meses. Revise
                  os valores.
                </p>
              )}
              <DataTable
                rows={simulation.rows}
                columns={[
                  { key: 'date', label: 'Data', render: (r) => dateLabel(r.date) },
                  { key: 'payment', label: 'Prestação', render: (r) => money(r.payment) },
                  { key: 'interest', label: 'Juros', render: (r) => money(r.interest) },
                  { key: 'principal', label: 'Amortização', render: (r) => money(r.principal) },
                  { key: 'balance', label: 'Saldo restante', render: (r) => money(r.balance) },
                ]}
              />
            </>
          )}
          <p className="panel-footnote">
            Simulação não altera a dívida. Ao registrar uma amortização, informe também o próximo
            vencimento. Para antecipação extra, mantenha a data se a próxima prestação continuar
            devida.
          </p>
        </Panel>
      )}
      <Panel title="Histórico de amortizações">
        <PaymentHistory rows={data.debt_payments} type="debt_payments" />
      </Panel>
    </>
  );
}
export function Investments({ month }) {
  const { data, open } = useFinance();
  return (
    <>
      <div className="section-toolbar">
        <p>Registros manuais, sem conexão com corretoras ou cotações automáticas.</p>
        <div>
          <Button variant="secondary" onClick={() => open('assets')}>
            <Plus size={16} />
            Adicionar bem
          </Button>
          <Button onClick={() => open('investments')}>
            <Plus size={16} />
            Novo investimento
          </Button>
        </div>
      </div>
      <div className="stats-grid three">
        <Stat
          label="Saldo investido"
          value={money(sum(data.investments, (i) => investmentBalance(data, i)))}
        />
        <Stat
          label="Reserva de emergência"
          value={money(
            sum(
              data.investments.filter((i) => i.emergency),
              (i) => investmentBalance(data, i),
            ),
          )}
        />
        <Stat label="Patrimônio líquido" value={money(netWorth(data))} />
      </div>
      <div className="entity-grid">
        {data.investments.map((i) => (
          <article className="panel investment-card" key={i.id}>
            <div className="between">
              <span className="account-icon">
                <Sprout size={23} />
              </span>
              <RowActions entity="investments" row={i} />
            </div>
            <h2>{i.name}</h2>
            <p>
              {i.kind}
              {i.emergency ? ' · Reserva de emergência' : ''}
            </p>
            <strong className="large-money">{money(investmentBalance(data, i))}</strong>
            <Button
              variant="secondary"
              size="small"
              onClick={() => open('invest', null, { investment_id: i.id })}
            >
              Aporte, resgate ou rendimento
            </Button>
          </article>
        ))}
      </div>
      {!data.investments.length && (
        <Panel title="Sua carteira">
          <Empty
            title="Acompanhe o que você está construindo"
            description="Cadastre sua posição inicial e registre aportes, resgates e rendimentos."
            onAdd={() => open('investments')}
          />
        </Panel>
      )}
      <Panel
        title="Evolução patrimonial registrada"
        subtitle="Reconstrução com eventos cadastrados e avaliações manuais"
      >
        <FlowChart rows={history(data, month)} worth />
      </Panel>
      <Panel title="Movimentações de investimentos">
        <PaymentHistory type="investment_events" rows={data.investment_events.toReversed()} />
      </Panel>
      <Panel title="Bens patrimoniais">
        <RecordTable entity="assets" rows={data.assets} />
      </Panel>
      <p className="footnote">
        Aportes e resgates transferem patrimônio entre caixa e investimento. Rendimentos manuais
        alteram a posição investida, sem entrada de caixa. Não cadastre a mesma posição
        simultaneamente como conta bancária e investimento.
      </p>
    </>
  );
}
export function Reports({ month }) {
  const { data } = useFinance(),
    stats = monthly(data, month),
    rows = history(data, month),
    categories = categoryTotals(data, month).filter((c) => c.value > 0 && !c.parent_id),
    analysis = insights(data, month);
  function exportCSV() {
    const content = csv([
      ['FinanceHub', 'Demonstrativo por competência', month],
      ['Descrição', 'Tipo', 'Categoria', 'Data', 'Valor (BRL)', 'Origem'],
      ...stats.entries.map((e) => [
        e.description,
        e.kind === 'income' ? 'Receita' : 'Despesa',
        data.categories.find((c) => c.id === e.category_id)?.name || 'Juros',
        dateLabel(e.date),
        (e.amount_cents / 100).toFixed(2).replace('.', ','),
        e.source === 'card'
          ? 'Parcela de cartão'
          : e.source === 'interest'
            ? 'Juros'
            : 'Lançamento',
      ]),
      [],
      ['Receitas', money(stats.income)],
      ['Despesas', money(stats.expense)],
      ['Resultado', money(stats.result)],
      ['Recebido no mês (caixa)', money(stats.received)],
      ['Saídas de caixa (inclui transferências e aportes)', money(stats.paid)],
    ]);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `financehub-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="section-toolbar no-print">
        <p>Demonstrativo de {monthLabel(month)} · dados efetivamente cadastrados.</p>
        <div>
          <Button variant="secondary" onClick={exportCSV}>
            <Download size={16} />
            Exportar CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={16} />
            Salvar PDF
          </Button>
        </div>
      </div>
      <div className="print-heading">
        <h1>FinanceHub · Relatório financeiro</h1>
        <p>
          {monthLabel(month)} · Emitido em {dateLabel(today())}
        </p>
      </div>
      <div className="stats-grid">
        <Stat label="Receitas por competência" value={money(stats.income)} />
        <Stat label="Despesas por competência" value={money(stats.expense)} />
        <Stat label="Resultado / economia" value={money(stats.result)} />
        <Stat
          label="Renda comprometida"
          value={stats.committed === null ? '—' : stats.committed.toFixed(1) + '%'}
        />
      </div>
      <Panel title="Comparativo dos últimos 12 meses">
        <ComparisonChart rows={rows} />
        <DataTable
          rows={rows}
          columns={[
            { key: 'month', label: 'Mês', render: (r) => monthLabel(r.month) },
            { key: 'income', label: 'Receitas', render: (r) => money(r.income) },
            { key: 'expense', label: 'Despesas', render: (r) => money(r.expense) },
            { key: 'received', label: 'Recebido em caixa', render: (r) => money(r.received) },
            { key: 'result', label: 'Resultado', render: (r) => money(r.result) },
          ]}
        />
      </Panel>
      <div className="dashboard-grid">
        <Panel title="Evolução do saldo de caixa">
          <FlowChart rows={rows} balance />
        </Panel>
        <Panel title="Evolução do patrimônio">
          <FlowChart rows={rows} worth />
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Despesas por categoria">
          <DataTable
            rows={categories}
            columns={[
              { key: 'name', label: 'Categoria' },
              { key: 'value', label: 'Total', render: (r) => money(r.value) },
            ]}
          />
        </Panel>
        <Panel title="Despesas fixas e variáveis">
          <div className="summary-lines">
            <div>
              <span>Fixas</span>
              <strong>
                {money(sum(stats.entries.filter((e) => e.kind === 'expense' && e.fixed)))}
              </strong>
            </div>
            <div>
              <span>Variáveis e parcelas</span>
              <strong>
                {money(sum(stats.entries.filter((e) => e.kind === 'expense' && !e.fixed)))}
              </strong>
            </div>
            <div>
              <span>Residenciais</span>
              <strong>
                {money(
                  sum(
                    stats.entries.filter(
                      (e) => data.categories.find((c) => c.id === e.category_id)?.scope === 'home',
                    ),
                  ),
                )}
              </strong>
            </div>
            <div>
              <span>Pessoais</span>
              <strong>
                {money(
                  sum(
                    stats.entries.filter(
                      (e) =>
                        data.categories.find((c) => c.id === e.category_id)?.scope === 'personal',
                    ),
                  ),
                )}
              </strong>
            </div>
          </div>
        </Panel>
      </div>
      <Panel title="Gastos por cartão">
        <DataTable
          rows={data.cards}
          columns={[
            { key: 'name', label: 'Cartão' },
            {
              key: 'expense',
              label: 'Parcelas na competência',
              render: (c) => money(sum(stats.entries.filter((e) => e.card_id === c.id))),
            },
            {
              key: 'paid',
              label: 'Faturas pagas no mês',
              render: (c) =>
                money(
                  sum(
                    data.payments.filter(
                      (p) =>
                        monthOf(p.paid_on) === month &&
                        data.invoices.find((i) => i.id === p.invoice_id)?.card_id === c.id,
                    ),
                  ),
                ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Realizado versus planejado"
        subtitle="Receitas e despesas do período por competência; quitação dos mesmos lançamentos"
      >
        <DataTable
          rows={data.transactions.filter((t) => !t.canceled && monthOf(t.competence) === month)}
          columns={[
            { key: 'description', label: 'Lançamento' },
            { key: 'amount', label: 'Planejado', render: (t) => money(t.amount_cents) },
            {
              key: 'paid',
              label: 'Realizado',
              render: (t) => money(sum(data.payments.filter((p) => p.transaction_id === t.id))),
            },
            {
              key: 'difference',
              label: 'Pendente',
              render: (t) =>
                money(t.amount_cents - sum(data.payments.filter((p) => p.transaction_id === t.id))),
            },
          ]}
        />
      </Panel>
      <Panel title="Evolução das dívidas">
        <DataTable
          rows={rows}
          columns={[
            { key: 'month', label: 'Mês', render: (r) => monthLabel(r.month) },
            { key: 'debt', label: 'Saldo devedor reconstruído', render: (r) => money(r.debt) },
          ]}
        />
      </Panel>
      <Panel title="Análises e oportunidades">
        <div className="insights-grid">
          {analysis.map((a, i) => (
            <article key={i}>
              <span className="badge">{a.type}</span>
              <h3>{a.text}</h3>
              <p>{a.basis}</p>
            </article>
          ))}
          {!analysis.length && (
            <p className="muted">Ainda não há dados suficientes para identificar tendências.</p>
          )}
        </div>
      </Panel>
      <p className="footnote no-print">
        PDF: na janela de impressão, escolha “Salvar como PDF”. A impressão inclui todas as linhas
        das tabelas. Valores por competência incluem previsões; caixa inclui somente operações
        efetivas.
      </p>
    </>
  );
}
export function Settings() {
  const { data, open } = useFinance();
  return (
    <>
      <Panel
        title="Seu perfil"
        subtitle="Personalize como você aparece no FinanceHub"
        action={
          data.profiles[0] && (
            <Button variant="secondary" onClick={() => open('profiles', data.profiles[0])}>
              Editar perfil
            </Button>
          )
        }
      >
        <div className="settings-info">
          <strong>{data.profiles[0]?.name || 'Seu nome ainda não foi cadastrado'}</strong>
          <p>Moeda: real brasileiro (BRL) · Datas: DD/MM/AAAA · Fuso: America/Sao_Paulo</p>
        </div>
      </Panel>
      <Panel
        title="Categorias e subcategorias"
        subtitle="Personalize a organização das suas receitas e despesas"
        action={
          <Button size="small" onClick={() => open('categories')}>
            <Plus size={16} />
            Nova categoria
          </Button>
        }
      >
        <RecordTable
          entity="categories"
          rows={data.categories}
          fields={['name', 'kind', 'scope', 'parent_id']}
        />
      </Panel>
      <Panel title="Como seus números são calculados">
        <div className="settings-info">
          <p>
            <strong>Caixa:</strong> saldo inicial mais recebimentos e entradas, menos pagamentos e
            saídas. Transferências internas são neutras no consolidado.
          </p>
          <p>
            <strong>Competência:</strong> cada lançamento é reconhecido na data informada. Compras
            no cartão são reconhecidas por parcela no mês de vencimento; pagar a fatura não cria
            outra despesa.
          </p>
          <p>
            <strong>Recorrências:</strong> as próximas 12 competências são geradas ao abrir o
            aplicativo; projeções calculam ocorrências adicionais sem gravá-las.
          </p>
          <p>
            <strong>Patrimônio:</strong> contas + investimentos + bens − dívidas − saldo de cartões.
            Metas representam reservas, sem aumentar ativos.
          </p>
          <p>
            <strong>Privacidade:</strong> a sessão é validada no servidor, o banco restringe cada
            usuário aos seus dados e não há chave administrativa no navegador.
          </p>
        </div>
      </Panel>
    </>
  );
}
