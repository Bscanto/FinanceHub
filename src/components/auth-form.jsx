'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail, LockKeyhole, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from './ui/button';
import { Brand } from './shell';
const schema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string() });
export function AuthForm({ initialMode = 'login', linkError = false }) {
  const [mode, setMode] = useState(initialMode),
    [message, setMessage] = useState(
      linkError ? 'Este link expirou ou já foi utilizado. Solicite um novo link.' : '',
    ),
    [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialMode === 'update' ? 'recovery@local.invalid' : '',
      password: '',
    },
  });
  async function submit(values) {
    setMessage('');
    setSuccess(false);
    if ((mode === 'register' || mode === 'update') && values.password.length < 10) {
      setError('password', { message: 'Use pelo menos 10 caracteres.' });
      return;
    }
    const db = createClient(),
      origin = window.location.origin;
    try {
      let result;
      if (mode === 'register')
        result = await db.auth.signUp({
          email: values.email,
          password: values.password,
          options: { emailRedirectTo: origin + '/auth/callback' },
        });
      else if (mode === 'recover')
        result = await db.auth.resetPasswordForEmail(values.email, {
          redirectTo: origin + '/auth/callback?next=' + encodeURIComponent('/login?mode=update'),
        });
      else if (mode === 'update') result = await db.auth.updateUser({ password: values.password });
      else result = await db.auth.signInWithPassword(values);
      if (result.error) {
        setMessage(
          result.error.status === 401
            ? 'A autenticação do aplicativo foi recusada. Verifique a chave pública do Supabase configurada na hospedagem.'
            : result.error.code === 'invalid_credentials'
            ? 'E-mail ou senha incorretos.'
            : result.error.code === 'email_not_confirmed'
              ? 'Confirme seu e-mail antes de entrar.'
              : result.error.code === 'over_email_send_rate_limit'
                ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
                : 'Não foi possível concluir. Confira os dados e tente novamente.',
        );
        return;
      }
      if (mode === 'login' || mode === 'update' || (mode === 'register' && result.data.session)) {
        window.location.assign('/overview');
        return;
      }
      setSuccess(true);
      setMessage(
        mode === 'recover'
          ? 'Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha.'
          : 'Confira seu e-mail para confirmar o cadastro e acessar suas finanças.',
      );
    } catch {
      setMessage('Falha de conexão. Tente novamente em instantes.');
    }
  }
  const titles = {
    login: ['Bem-vindo ao seu próximo passo.', 'Entre para cuidar do que importa.'],
    register: ['Seu futuro começa aqui.', 'Crie sua conta e organize suas finanças.'],
    recover: ['Vamos recuperar seu acesso.', 'Enviaremos um link para redefinir sua senha.'],
    update: ['Uma nova senha, um novo acesso.', 'Escolha uma senha com pelo menos 10 caracteres.'],
  };
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">MAIS CLAREZA. MAIS POSSIBILIDADES.</span>
          <h1>
            Cuide do presente.
            <br />
            <span>Planeje o seu futuro.</span>
          </h1>
          <p>
            Suas contas, seus planos e suas conquistas.
            <br />
            Tudo em um lugar que faz sentido.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="growth-bar b1" />
            <div className="growth-bar b2" />
            <div className="growth-bar b3" />
            <div className="growth-bar b4" />
            <span>um passo de cada vez ↗</span>
          </div>
        </div>
        <small>FinanceHub · Sua vida financeira, em equilíbrio.</small>
      </section>
      <section className="auth-main">
        <div className="auth-form-wrap">
          <span className="auth-label">SEU ESPAÇO PESSOAL</span>
          <h2>{titles[mode][0]}</h2>
          <p>{titles[mode][1]}</p>
          <form onSubmit={handleSubmit(submit)} noValidate>
            {mode !== 'update' && (
              <label className="field">
                <span>E-mail</span>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    {...register('email')}
                  />
                </div>
                {errors.email && <small className="error-text">{errors.email.message}</small>}
              </label>
            )}
            {mode !== 'recover' && (
              <label className="field">
                <span>Senha</span>
                <div className="input-with-icon">
                  <LockKeyhole size={18} />
                  <input
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Pelo menos 10 caracteres"
                    {...register('password')}
                  />
                </div>
                {errors.password && <small className="error-text">{errors.password.message}</small>}
              </label>
            )}
            {mode === 'login' && (
              <button
                type="button"
                className="text-link recover-link"
                onClick={() => {
                  setMode('recover');
                  setMessage('');
                }}
              >
                Esqueci minha senha
              </button>
            )}
            {message && (
              <p role="status" className={success ? 'success-message' : 'error-message'}>
                {message}
              </p>
            )}
            <Button className="auth-submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Aguarde…'
                : mode === 'login'
                  ? 'Entrar na minha conta'
                  : mode === 'register'
                    ? 'Criar minha conta'
                    : mode === 'recover'
                      ? 'Enviar link de recuperação'
                      : 'Salvar nova senha'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? 'Ainda não tem uma conta? ' : ''}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setMessage('');
              }}
            >
              {mode === 'login' ? 'Começar agora' : 'Voltar para entrar'}
            </button>
          </p>
          <div className="auth-security">
            <ShieldCheck size={17} />
            <span>Seus dados financeiros em um espaço só seu.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
