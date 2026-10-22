'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react';
import { useFinance } from './finance-provider';
import { Overview } from './overview';
import { Transactions } from './transactions';
import { Accounts, Cards } from './accounts-cards';
import { Planning, Budgets, Goals, Calendar } from './planning';
import { Debts, Investments, Reports, Settings } from './advanced';
import { Button } from './ui/button';
import { today, addMonths, monthOf } from '@/lib/finance/dates';
const COPY = {
  overview: ['Visão geral', 'Sua vida financeira, em uma visão clara.'],
  income: ['Receitas', 'Tudo o que entra, organizado em um só lugar.'],
  expenses: ['Despesas', 'Mais consciência em cada escolha.'],
  cards: ['Cartões de crédito', 'Suas compras de hoje, sem surpresas amanhã.'],
  accounts: ['Contas e carteiras', 'Cada conta, cada saldo, tudo conectado.'],
  planning: ['Planejamento', 'Decisões de hoje. Possibilidades de amanhã.'],
  calendar: ['Calendário financeiro', 'Um olhar para tudo o que está por vir.'],
  budgets: ['Orçamentos', 'Seu dinheiro alinhado às suas prioridades.'],
  goals: ['Metas financeiras', 'Pequenos passos para grandes conquistas.'],
  debts: ['Dívidas e financiamentos', 'Um caminho mais claro para a tranquilidade.'],
  investments: ['Investimentos e patrimônio', 'Acompanhe a evolução do que é seu.'],
  reports: ['Relatórios e análises', 'Seus números, transformados em perspectiva.'],
  settings: ['Configurações', 'Um espaço que funciona do seu jeito.'],
};
export function Workspace({ section }) {
  const [month, setMonth] = useState(monthOf(today())),
    { loading, error, refresh } = useFinance(),
    [title, subtitle] = COPY[section];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-kicker">FINANCEHUB / PESSOAL</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {!['settings', 'planning', 'goals', 'debts'].includes(section) && (
          <div className="period-picker">
            <button
              className="icon-button"
              aria-label="Mês anterior"
              onClick={() => setMonth(monthOf(addMonths(month + '-01', -1)))}
            >
              <ChevronLeft size={17} />
            </button>
            <CalendarDays size={16} />
            <input
              aria-label="Período"
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
            <button
              className="icon-button"
              aria-label="Próximo mês"
              onClick={() => setMonth(monthOf(addMonths(month + '-01', 1)))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
      {error ? (
        <div className="error-panel" role="alert">
          <h2>Não foi possível carregar suas finanças.</h2>
          <p>{error}</p>
          <Button onClick={refresh}>
            <RefreshCw size={16} />
            Tentar novamente
          </Button>
        </div>
      ) : loading ? (
        <div className="loading-skeleton" role="status">
          <span>Organizando seus dados…</span>
          <div />
          <div />
          <div />
        </div>
      ) : (
        <>
          {section === 'overview' && <Overview month={month} />}{' '}
          {section === 'income' && <Transactions kind="income" month={month} />}{' '}
          {section === 'expenses' && <Transactions kind="expense" month={month} />}{' '}
          {section === 'accounts' && <Accounts month={month} />}{' '}
          {section === 'cards' && <Cards month={month} />} {section === 'planning' && <Planning />}{' '}
          {section === 'calendar' && <Calendar month={month} />}{' '}
          {section === 'budgets' && <Budgets month={month} />} {section === 'goals' && <Goals />}{' '}
          {section === 'debts' && <Debts />}{' '}
          {section === 'investments' && <Investments month={month} />}{' '}
          {section === 'reports' && <Reports month={month} />}{' '}
          {section === 'settings' && <Settings />}
        </>
      )}
    </>
  );
}
