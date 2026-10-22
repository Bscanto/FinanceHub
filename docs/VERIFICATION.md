# Verificação

## Escopo

O fluxo principal é: formulário React → POST autenticado e validado → comando transacional PostgreSQL → snapshot → saldos, relatórios e projeções atualizados. A validação local separa testes de domínio, execução real do SQL e verificação de navegador.

## Evidências locais

- `npm test`: 26 testes aprovados (16 de domínio/validação e 10 de PostgreSQL).
- A migração foi executada integralmente em PGlite, com papéis `authenticated`/`anon`, tabela `auth.users` e função `auth.uid()` equivalentes para os testes de autorização.
- RLS impede leitura de contas de outro usuário; RPC impede alteração de outro dono e referências cruzadas; escrita direta nas tabelas é negada.
- Testados pagamentos parciais, excesso de pagamento, idempotência, reversões, distribuição exata de parcelas, fechamento do cartão, limite disponível, recorrências em fevereiro e amortizações.
- Testados caixa versus competência, neutralidade de transferências, preservação de patrimônio em aportes e pagamentos, projeções sem duplicação e CSV protegido contra fórmulas.
- `npm run build`: compilação de produção aprovada usando Webpack. Turbopack não conseguiu abrir seu processo/porta auxiliar neste ambiente.

## Teste de navegador

`npm run test:e2e` inicia Next.js e um adaptador HTTP somente para testes, com PostgreSQL PGlite vazio. O roteiro cria seus próprios dados: conta, receita, recebimento parcial e compra parcelada; verifica persistência após recarregar, navegação entre módulos e dimensões mobile.

O adaptador usa autenticação controlada para testar o contrato do SDK e a aplicação. Não substitui Supabase Auth real. Não há rota de teste habilitada no aplicativo nem dados de teste enviados a um projeto externo.

## Ainda depende de ambiente externo

- Aplicação da migração no projeto Supabase do usuário e execução dos Database Advisors.
- Testes de cadastro com confirmação por e-mail, recuperação de senha, expiração/renovação de sessão e SMTP no Supabase real.
- Testes em dois navegadores com usuários distintos no ambiente de homologação.
- Deploy Vercel, domínio, callbacks HTTPS e validação pós-deploy.
- Testes de carga, backup/restauração e particularidades dos contratos bancários.

## Limites funcionais explícitos

- PDF via impressão do navegador; escolha “Salvar como PDF”. CSV é download direto.
- Juros de dívidas: modelo de prestação fixa e taxa mensal informada, sem CET, tarifas, seguros ou indexadores.
- Histórico patrimonial reconstruído com posições iniciais e eventos manuais; bens mantêm a avaliação vigente, sem histórico de reavaliação.
- Alertas dentro do aplicativo; sem e-mail/push ou Open Finance.
- Recorrências materializadas ao abrir o aplicativo; não há agendador externo. Projeções estendem as ocorrências sem depender de geração antecipada no banco.
- Snapshot completo adequado ao uso pessoal. Paginação/agregação no servidor deve preceder cargas grandes.
