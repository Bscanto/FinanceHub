'use client';
import { useState } from 'react';
import { Plus, ArrowLeftRight, CreditCard, Wallet, Ban } from 'lucide-react';
import { useFinance } from './finance-provider';
import {
  Panel,
  Empty,
  RowActions,
  RecordTable,
  DataTable,
  PaymentHistory,
  Progress,
} from './shared';
import { Button } from './ui/button';
import { accountBalance, cashEntries, sum, invoiceState } from '@/lib/finance/engine';
import { money } from '@/lib/finance/money';
import { dateLabel, monthOf, today } from '@/lib/finance/dates';
export function Accounts({ month }) {
  const { data, open } = useFinance(),
    entries = cashEntries(data);
  return (
    <>
      <div className="section-toolbar">
        <p>Os saldos são calculados a partir das movimentações efetivas.</p>
        <div>
          <Button variant="secondary" onClick={() => open('transfers')}>
            <ArrowLeftRight size={16} />
            Transferir
          </Button>
          <Button onClick={() => open('accounts')}>
            <Plus size={16} />
            Adicionar conta
          </Button>
        </div>
      </div>
      {data.accounts.length ? (
        <div className="entity-grid">
          {data.accounts.map((a) => {
            const flow = entries.filter((e) => e.account === a.id && monthOf(e.date) === month);
            return (
              <article className="panel account-card" key={a.id}>
                <div className="between">
                  <span className="account-icon">
                    <Wallet size={23} />
                  </span>
                  <RowActions entity="accounts" row={a} />
                </div>
                <h2>{a.name}</h2>
                <p>{a.institution || 'Carteira pessoal'}</p>
                <small>Saldo disponível atual</small>
                <strong className="large-money">{money(accountBalance(data, a))}</strong>
                <div className="account-flow">
                  <span>
                    Entradas no mês
                    <strong className="green">
                      {money(
                        sum(
                          flow.filter((e) => e.value > 0),
                          'value',
                        ),
                      )}
                    </strong>
                  </span>
                  <span>
                    Saídas no mês
                    <strong>
                      {money(
                        -sum(
                          flow.filter((e) => e.value < 0),
                          'value',
                        ),
                      )}
                    </strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel title="Contas e carteiras">
          <Empty
            title="Um lugar para cada parte do seu dinheiro"
            description="Cadastre uma conta corrente, poupança, carteira ou dinheiro em espécie."
            onAdd={() => open('accounts')}
          />
        </Panel>
      )}
      <Panel
        title="Transferências internas"
        subtitle="Movimentam saldos sem gerar receita ou despesa"
      >
        <RecordTable
          entity="transfers"
          rows={data.transfers.filter((t) => monthOf(t.transferred_on) === month)}
        />
      </Panel>
      <Panel title="Extrato de caixa do mês">
        <DataTable
          rows={entries
            .filter((e) => monthOf(e.date) === month)
            .sort((a, b) => b.date.localeCompare(a.date))}
          columns={[
            { key: 'date', label: 'Data', render: (e) => dateLabel(e.date) },
            {
              key: 'account',
              label: 'Conta',
              render: (e) => data.accounts.find((a) => a.id === e.account)?.name,
            },
            {
              key: 'value',
              label: 'Movimentação',
              render: (e) => (
                <strong className={e.value > 0 ? 'green' : 'red'}>{money(e.value)}</strong>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
export function Cards({ month }) {
  const { data, open, destructive } = useFinance(),
    [selected, setSelected] = useState('all'),
    [allMonths, setAllMonths] = useState(false);
  const invoices = data.invoices
    .filter(
      (i) =>
        (selected === 'all' || i.card_id === selected) &&
        (allMonths || monthOf(i.due_date) === month),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const invoiceIds = new Set(invoices.map((i) => i.id));
  return (
    <>
      <div className="section-toolbar">
        <p>Parcelas organizadas por fechamento e vencimento.</p>
        <div>
          <Button variant="secondary" onClick={() => open('cards')}>
            <Plus size={16} />
            Adicionar cartão
          </Button>
          <Button onClick={() => open('purchase')}>
            <CreditCard size={16} />
            Registrar compra
          </Button>
        </div>
      </div>
      <div className="entity-grid">
        {data.cards.map((c, index) => {
          const spent = sum(data.purchases.filter((p) => p.card_id === c.id && !p.canceled)),
            paid = sum(
              data.payments.filter(
                (p) => data.invoices.find((i) => i.id === p.invoice_id)?.card_id === c.id,
              ),
            );
          return (
            <article className={`credit-card card-color-${index % 3}`} key={c.id}>
              <div className="between">
                <span>{c.institution || 'Cartão pessoal'}</span>
                <CreditCard size={25} />
              </div>
              <h2>{c.name}</h2>
              <div className="card-chip" />
              <small>Limite disponível</small>
              <strong>{money(c.limit_cents - spent + paid)}</strong>
              <Progress value={((spent - paid) / c.limit_cents) * 100} />
              <div className="between">
                <small>
                  Fecha dia {c.closing_day} · vence dia {c.due_day}
                </small>
                <RowActions entity="cards" row={c} />
              </div>
            </article>
          );
        })}
      </div>
      {!data.cards.length && (
        <Panel title="Seus cartões">
          <Empty
            title="Controle as faturas sem surpresas"
            description="Cadastre seu cartão para distribuir compras e parcelas automaticamente."
            onAdd={() => open('cards')}
          />
        </Panel>
      )}
      <Panel
        title="Faturas"
        subtitle="Pagamentos parciais abatem o saldo; não criam uma segunda despesa"
      >
        <div className="filters">
          <select
            aria-label="Filtrar cartão"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">Todos os cartões</option>
            {data.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={allMonths}
              onChange={(e) => setAllMonths(e.target.checked)}
            />
            Todas as competências
          </label>
        </div>
        <DataTable
          rows={invoices}
          columns={[
            {
              key: 'card',
              label: 'Cartão',
              render: (i) => data.cards.find((c) => c.id === i.card_id)?.name,
            },
            {
              key: 'due',
              label: 'Vencimento',
              render: (i) => (
                <span
                  className={
                    i.due_date < today() && invoiceState(data, i).remaining > 0 ? 'red' : ''
                  }
                >
                  {dateLabel(i.due_date)}
                </span>
              ),
            },
            { key: 'total', label: 'Total', render: (i) => money(invoiceState(data, i).total) },
            { key: 'paid', label: 'Pago', render: (i) => money(invoiceState(data, i).paid) },
            {
              key: 'remaining',
              label: 'Pendente',
              render: (i) => money(invoiceState(data, i).remaining),
            },
            {
              key: 'action',
              label: 'Ações',
              render: (i) =>
                invoiceState(data, i).remaining > 0 ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      open('pay', null, {
                        invoice_id: i.id,
                        amount_cents: invoiceState(data, i).remaining,
                      })
                    }
                  >
                    Pagar fatura
                  </Button>
                ) : (
                  <span className="badge green-badge">Quitada</span>
                ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Compras e parcelamentos"
        subtitle="Cancele uma compra sem pagamento para removê-la dos cálculos"
      >
        <DataTable
          rows={data.purchases
            .filter((p) => selected === 'all' || p.card_id === selected)
            .toReversed()}
          columns={[
            { key: 'description', label: 'Compra' },
            { key: 'date', label: 'Data', render: (p) => dateLabel(p.purchased_on) },
            { key: 'value', label: 'Total', render: (p) => money(p.amount_cents) },
            { key: 'count', label: 'Parcelas' },
            {
              key: 'status',
              label: 'Situação',
              render: (p) => (p.canceled ? 'Cancelada' : 'Ativa'),
            },
            {
              key: 'action',
              label: 'Ações',
              render: (p) =>
                !p.canceled && (
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      destructive(
                        'cancel',
                        'purchases',
                        p.id,
                        'A compra será cancelada. Faturas já pagas exigem estorno prévio dos pagamentos.',
                      )
                    }
                  >
                    <Ban size={14} />
                    Cancelar
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      <Panel title="Detalhamento de parcelas" subtitle="Parcelas das faturas filtradas">
        <DataTable
          rows={data.installments.filter(
            (i) =>
              invoiceIds.has(i.invoice_id) &&
              !data.purchases.find((p) => p.id === i.purchase_id)?.canceled,
          )}
          columns={[
            {
              key: 'purchase',
              label: 'Compra',
              render: (i) => data.purchases.find((p) => p.id === i.purchase_id)?.description,
            },
            { key: 'number', label: 'Parcela' },
            {
              key: 'date',
              label: 'Vencimento',
              render: (i) => dateLabel(data.invoices.find((f) => f.id === i.invoice_id)?.due_date),
            },
            { key: 'amount', label: 'Valor', render: (i) => money(i.amount_cents) },
          ]}
        />
      </Panel>
      <Panel title="Histórico de pagamentos">
        <PaymentHistory rows={data.payments.filter((p) => invoiceIds.has(p.invoice_id))} />
      </Panel>
    </>
  );
}
