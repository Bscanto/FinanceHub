'use client';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { money } from '@/lib/finance/money';
const colors = ['#10a77a', '#6979db', '#e9b456', '#d8799c', '#64b5bd', '#9b86ba'];
const format = (v) => money(v);
const tick = (v) =>
  v >= 100000 ? `${(v / 100000).toLocaleString('pt-BR')} mil` : (v / 100).toLocaleString('pt-BR');
export function FlowChart({ rows, balance = false, worth = false }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        balance
          ? 'Evolução do saldo'
          : worth
            ? 'Evolução patrimonial'
            : 'Receitas e despesas por mês'
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ left: 0, right: 10, top: 15, bottom: 0 }}>
          <defs>
            <linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10a77a" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10a77a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tickFormatter={(v) => v.split(' ')[0].slice(0, 3)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <YAxis
            tickFormatter={tick}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            width={58}
          />
          <Tooltip
            formatter={format}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}
          />
          <Legend iconType="circle" iconSize={7} />
          {balance || worth ? (
            <Area
              type="monotone"
              dataKey={worth ? 'worth' : 'balance'}
              name={worth ? 'Patrimônio' : 'Saldo'}
              stroke="#10a77a"
              fill="url(#greenFill)"
              strokeWidth={2.5}
            />
          ) : (
            <>
              <Area
                type="monotone"
                dataKey="income"
                name="Receitas"
                stroke="#10a77a"
                fill="url(#greenFill)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Despesas"
                stroke="#8995a9"
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ComparisonChart({ rows }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tickFormatter={(v) => v.split(' ')[0].slice(0, 3)}
            tick={{ fontSize: 11 }}
          />
          <YAxis tickFormatter={tick} tick={{ fontSize: 11 }} width={60} />
          <Tooltip formatter={format} contentStyle={{ background: 'var(--surface)' }} />
          <Legend />
          <Bar dataKey="income" name="Receitas" fill="#10a77a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Despesas" fill="#b5bdce" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({ rows }) {
  const filtered = rows.filter((r) => r.value > 0 && !r.parent_id);
  if (!filtered.length)
    return (
      <div className="chart-empty">
        <span className="empty-ring" />
        <p>Suas despesas ganharão forma aqui.</p>
        <small>Cadastre uma movimentação para começar.</small>
      </div>
    );
  return (
    <div className="category-chart">
      <div className="donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={85}
              paddingAngle={3}
              stroke="none"
            >
              {filtered.map((r, i) => (
                <Cell key={r.id} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={format}
              contentStyle={{ background: 'var(--surface)', borderRadius: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="legend-list">
        {filtered.slice(0, 5).map((r, i) => (
          <div key={r.id}>
            <span>
              <i style={{ background: colors[i % colors.length] }} />
              {r.name}
            </span>
            <strong>{money(r.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
