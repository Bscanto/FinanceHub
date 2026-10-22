'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CreditCard,
  ChartNoAxesCombined,
  CalendarDays,
  SlidersHorizontal,
  Target,
  Landmark,
  Sprout,
  FileChartColumn,
  Settings,
  Plus,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
} from 'lucide-react';
import { FinanceProvider, useFinance } from './finance-provider';
import { Button } from './ui/button';
import { createClient } from '@/lib/supabase/client';
export const NAV = [
  ['overview', 'Visão geral', Activity],
  ['income', 'Receitas', ArrowDownLeft],
  ['expenses', 'Despesas', ArrowUpRight],
  ['cards', 'Cartões', CreditCard],
  ['accounts', 'Contas e carteiras', Wallet],
  ['planning', 'Planejamento', ChartNoAxesCombined],
  ['calendar', 'Calendário', CalendarDays],
  ['budgets', 'Orçamentos', SlidersHorizontal],
  ['goals', 'Metas', Target],
  ['debts', 'Dívidas', Landmark],
  ['investments', 'Investimentos', Sprout],
  ['reports', 'Relatórios', FileChartColumn],
  ['settings', 'Configurações', Settings],
];
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <ChartNoAxesCombined size={23} />
      </span>
      <span>
        finance<span className="brand-light">hub</span>
        <i />
      </span>
    </div>
  );
}
function ShellContent({ children, email }) {
  const path = usePathname(),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(false),
    [signOutError, setSignOutError] = useState('');
  const { open, data } = useFinance();
  useEffect(() => {
    const next = localStorage.getItem('financehub-theme') === 'dark';
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('financehub-theme', next ? 'dark' : 'light');
  }
  const current = NAV.find((n) => path === '/' + n[0]);
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label="Fechar navegação"
        />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <Link href="/overview" aria-label="FinanceHub início">
          <Brand />
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
        <div className="workspace-name">
          <span className="workspace-avatar">P</span>
          <div>
            Finanças pessoais<small>Seu espaço de organização</small>
          </div>
        </div>
        <p className="nav-caption">SEU DIA A DIA</p>
        <nav aria-label="Navegação principal">
          {NAV.map(([id, label, Icon], i) => (
            <div key={id}>
              {i === 5 && <p className="nav-caption">SEU FUTURO</p>}
              {i === 11 && <p className="nav-caption">MAIS</p>}
              <Link
                onClick={() => setMobile(false)}
                href={'/' + id}
                className={`nav-link ${path === '/' + id ? 'active' : ''}`}
                aria-current={path === '/' + id ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
                {path === '/' + id && <span className="active-dot" />}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-dot" /> Um passo de cada vez.
          <small>Clareza hoje. Tranquilidade amanhã.</small>
        </div>
        <div className="profile">
          <span className="user-avatar">
            {(data.profiles[0]?.name || email || 'U').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{data.profiles[0]?.name || 'Minha conta'}</strong>
            <small>{email}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sair"
            onClick={async () => {
              const { error } = await createClient().auth.signOut();
              if (error) setSignOutError('Não foi possível sair. Tente novamente.');
              else window.location.assign('/login');
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
        {signOutError && <small role="alert">{signOutError}</small>}
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>
            <PanelLeftClose size={18} className="desktop-only" />
            <span className="breadcrumb-divider" />
            <span>Meu espaço</span>
            <span>/</span>
            <strong>{current?.[1]}</strong>
          </div>
          <div className="top-actions">
            <span className="privacy-label">
              <span className="tiny-dot" /> Espaço pessoal
            </span>
            <button
              className="icon-button"
              onClick={toggle}
              aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Button onClick={() => open('transactions')} size="small">
              <Plus size={17} />
              <span>Nova movimentação</span>
            </Button>
          </div>
        </header>
        <main className="content">{children}</main>
        <footer className="app-footer">
          <span>FinanceHub · Mais clareza para suas escolhas.</span>
          <span>Valores em BRL · Horário de Brasília</span>
        </footer>
      </div>
    </div>
  );
}
export function Shell(props) {
  return (
    <FinanceProvider>
      <ShellContent {...props} />
    </FinanceProvider>
  );
}
