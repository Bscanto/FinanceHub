import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ChartNoAxesCombined,
  Database,
  KeyRound,
  ArrowRight,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { isConfigured } from '@/lib/supabase/config';
export default function Setup() {
  if (isConfigured()) redirect('/login');
  return (
    <main className="setup-page">
      <header>
        <div className="brand">
          <span className="brand-symbol">
            <ChartNoAxesCombined size={23} />
          </span>
          <span>
            finance<span className="brand-light">hub</span>
            <i />
          </span>
        </div>
        <span className="badge">Configuração inicial</span>
      </header>
      <div className="setup-layout">
        <section>
          <span className="eyebrow">SEU DINHEIRO. SEUS PLANOS.</span>
          <h1>
            Clareza para hoje.
            <br />
            <em>
              Tranquilidade
              <br />
              para amanhã.
            </em>
          </h1>
          <p>
            Toda a sua vida financeira em um só lugar.
            <br />
            Conecte seu banco de dados para começar.
          </p>
          <div className="setup-features">
            {[
              'Receitas, despesas e contas em equilíbrio',
              'Cartões e parcelas sem surpresas',
              'Projeções para transformar planos em conquistas',
            ].map((t) => (
              <div key={t}>
                <Check size={17} />
                {t}
              </div>
            ))}
          </div>
          <div className="setup-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <ChartNoAxesCombined size={50} />
          </div>
        </section>
        <section className="setup-card">
          <span className="setup-icon">
            <Database size={25} />
          </span>
          <h2>Vamos preparar seu espaço.</h2>
          <p>
            O Supabase ainda não foi configurado. Nenhuma conexão ou dado financeiro está sendo
            simulado.
          </p>
          <ol>
            <li>
              <span>1</span>
              <div>
                <h3>Crie seu projeto no Supabase</h3>
                <p>Ative autenticação por e-mail e copie a URL e a chave pública do projeto.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Configure o ambiente</h3>
                <p>
                  Copie <code>.env.example</code> para <code>.env.local</code> e preencha:
                </p>
                <pre>NEXT_PUBLIC_SUPABASE_URL{`\n`}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</pre>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Prepare o banco e reinicie</h3>
                <p>
                  Aplique a migração em <code>supabase/migrations</code>, configure a URL de retorno{' '}
                  <code>/auth/callback</code> e reinicie o servidor.
                </p>
              </div>
            </li>
          </ol>
          <Link href="/login" className="button primary">
            Verificar configuração <ArrowRight size={17} />
          </Link>
          <div className="setup-note">
            <ShieldCheck size={18} />
            <p>Use somente a chave pública. A chave administrativa não é necessária.</p>
          </div>
        </section>
      </div>
      <footer>FinanceHub · Seu próximo passo começa com organização.</footer>
    </main>
  );
}
