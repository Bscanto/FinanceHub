# Configuração e execução

## Executar

Requer Node.js 22 ou superior.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. Sem configuração do Supabase, o aplicativo mostra a tela de preparação e **não simula conexão, autenticação ou dados financeiros**.

## Configurar Supabase

1. Crie ou selecione um projeto Supabase.
2. Preencha `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

3. Aplique `supabase/migrations/20261022222347_foundation.sql` no SQL Editor do projeto. Alternativamente, use a CLI, consultando `npx supabase link --help` e `npx supabase db push --help`, vincule o projeto correto e aplique a migração. A migração pressupõe um schema novo para o FinanceHub.
4. Mantenha somente `public` exposto na Data API; **não exponha o schema `private`**. A migração já configura grants e RLS.
5. Em Authentication, habilite Email, confirmação de e-mail e recuperação de senha. Configure Site URL e Redirect URLs, incluindo:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback?next=/login?mode=update` (ou padrão autorizado `http://localhost:3000/auth/callback**` para desenvolvimento)
   - equivalentes HTTPS do domínio de produção.
6. Reinicie o servidor, crie a conta e confirme o e-mail. Cadastre uma conta financeira com o saldo inicial e a data correta. As categorias iniciais são criadas para o usuário; nenhum lançamento de exemplo é criado.

O fluxo usa PKCE e troca do código em `/auth/callback`. Os links de e-mail devem retornar para esse callback no mesmo navegador que iniciou a solicitação. Configure SMTP e revise os limites de envio do Supabase antes de produção. Não é necessária chave administrativa em nenhuma variável do aplicativo.

## Testes

```bash
npm test
npm run build
npm run test:e2e
```

Os testes de unidade cobrem dinheiro, datas, competência/caixa, cartões, transferências, cenários e metas. Os testes SQL executam a migração em PostgreSQL embarcado (PGlite), incluindo RLS, propriedade, operações atômicas, idempotência e estornos.

O teste E2E usa Chrome instalado, portas 3100/54329, Next.js real e um adaptador HTTP **exclusivamente de teste** para executar os RPCs reais em PGlite. O serviço de autenticação nesse teste é simulado; ele **não comprova entrega de e-mails nem configuração de Supabase Auth externo**. Dados sintéticos são restritos aos testes. Nenhuma rota de demonstração/bypass faz parte do aplicativo.

Webpack é utilizado nos scripts de build/dev por compatibilidade com ambientes que restringem o processo interno do Turbopack. Não é necessário TypeScript para o frontend.

## Preparar Vercel

Importe este diretório como projeto Next.js. Configure as mesmas variáveis em cada ambiente e a URL HTTPS correta. Instale as dependências com `npm ci` e compile com `npm run build`. Aplique a migração no Supabase correspondente e cadastre os callbacks do domínio antes de testar o login. Não publique `.env.local` e não inclua chaves `service_role`/`sb_secret`.


A configuração e a validação dos serviços externos devem ser realizadas no ambiente de destino antes do uso em produção.
