'use client';
import { useState } from 'react';
import { Pencil, Trash2, ArrowUpRight, Plus, Inbox, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { useFinance } from './finance-provider';
import { money } from '@/lib/finance/money';
import { dateLabel } from '@/lib/finance/dates';
import { DEFINITIONS } from '@/lib/finance/forms';
export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title = 'Seu próximo passo começa aqui',
  description = 'Adicione seu primeiro registro para acompanhar os resultados.',
  onAdd,
  label = 'Adicionar registro',
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onAdd && (
        <Button variant="secondary" size="small" onClick={onAdd}>
          <Plus size={15} />
          {label}
        </Button>
      )}
    </div>
  );
}
export function Stat({ label, value, hint, icon: Icon, featured = false, tone = '' }) {
  return (
    <div className={`stat ${featured ? 'featured' : ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon size={18} />
          </span>
        )}
      </div>
      <strong className={tone}>{value}</strong>
      <small>{hint || 'Com base nos seus registros'}</small>
    </div>
  );
}
export function Progress({ value }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(Math.min(100, value || 0))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value || 0))}%`,
          background: value >= 100 ? 'var(--red)' : value >= 80 ? 'var(--amber)' : undefined,
        }}
      />
    </div>
  );
}
export function DataTable({ columns, rows, empty, onRow }) {
  const [page, setPage] = useState(0),
    size = 15,
    last = Math.max(0, Math.ceil(rows.length / size) - 1),
    current = Math.min(page, last),
    slice = rows.slice(current * size, (current + 1) * size);
  if (!rows.length) return empty || <Empty />;
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="screen-rows">
            {slice.map((row, i) => (
              <tr key={row.id || row.month || i}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tbody className="print-all-rows">
            {rows.map((row, i) => (
              <tr key={row.id || row.month || i}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > size && (
        <div className="pagination">
          <small>
            {current * size + 1}–{Math.min((current + 1) * size, rows.length)} de {rows.length}
          </small>
          <Button
            size="small"
            variant="secondary"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={current === last}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </>
  );
}
export function RowActions({ entity, row, canEdit = true, canDelete = true, children }) {
  const { open, destructive } = useFinance();
  return (
    <div className="row-actions">
      {children}
      {canEdit && (
        <button
          className="icon-button"
          aria-label={`Editar ${row.name || row.description || 'registro'}`}
          onClick={() => open(entity, row)}
        >
          <Pencil size={15} />
        </button>
      )}
      {canDelete && (
        <button
          className="icon-button"
          aria-label={`Excluir ${row.name || row.description || 'registro'}`}
          onClick={() =>
            destructive(
              'delete',
              entity,
              row.id,
              'O registro será removido permanentemente. Registros em uso são protegidos.',
            )
          }
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
export function RecordTable({ entity, rows, fields, extra, editable = true }) {
  const { data } = useFinance(),
    def = DEFINITIONS[entity];
  const columns = (fields || def.fields.slice(0, 5).map((f) => f.key)).map((key) => {
    const f = def.fields.find((f) => f.key === key);
    return {
      key,
      label: f?.label || key,
      render: (r) => {
        if (!f) return r[key];
        const v = r[key];
        if (f.type === 'money') return money(v);
        if (f.type === 'percent') return `${(v / 100).toLocaleString('pt-BR')}%`;
        if (f.type.includes('date') || f.type === 'month') return dateLabel(v);
        if (f.type === 'checkbox') return v ? 'Sim' : 'Não';
        if (f.type.includes('select'))
          return Array.isArray(f.options)
            ? f.options.find((o) => o[0] === v)?.[1]
            : (data[f.options === 'parent_categories' ? 'categories' : f.options] || []).find(
                (o) => o.id === v,
              )?.name || '—';
        return v || '—';
      },
    };
  });
  if (extra) columns.push(...extra);
  if (editable)
    columns.push({
      key: 'actions',
      label: 'Ações',
      render: (r) => <RowActions entity={entity} row={r} />,
    });
  return <DataTable columns={columns} rows={rows} />;
}
export function PaymentHistory({ rows, type = 'payments' }) {
  const { data, destructive } = useFinance();
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: 'date', label: 'Data', render: (r) => dateLabel(r.paid_on || r.event_date) },
        {
          key: 'account',
          label: 'Conta',
          render: (r) => data.accounts.find((a) => a.id === r.account_id)?.name || 'Rendimento',
        },
        {
          key: 'value',
          label: 'Valor',
          render: (r) => money(r.amount_cents ?? r.principal_cents + r.interest_cents),
        },
        {
          key: 'kind',
          label: 'Operação',
          render: (r) =>
            r.kind === 'deposit'
              ? 'Aporte'
              : r.kind === 'withdrawal'
                ? 'Resgate'
                : r.kind === 'yield'
                  ? 'Rendimento'
                  : r.transaction_id
                    ? 'Lançamento'
                    : r.invoice_id
                      ? 'Fatura'
                      : 'Amortização',
        },
        {
          key: 'actions',
          label: 'Ações',
          render: (r) => (
            <Button
              variant="ghost"
              size="small"
              onClick={() =>
                destructive(
                  'reverse',
                  type,
                  r.id,
                  'O efeito desta operação será desfeito no saldo.',
                )
              }
            >
              <Undo2 size={14} />
              Estornar
            </Button>
          ),
        },
      ]}
    />
  );
}
