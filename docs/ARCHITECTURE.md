# Arquitetura do FinanceHub

## Fluxo

Navegador React/JavaScript → API Next.js `/api/finance` → sessão Supabase validada (`getUser`) → comando PostgreSQL transacional → snapshot consistente → recálculo de indicadores e gráficos.

O frontend utiliza React Hook Form e Zod. Formulários financeiros são definidos em `src/lib/finance/forms.js`; a validação compartilhada está em `schemas.js`. Componentes de botão e diálogo seguem a composição shadcn/ui, com Radix, CVA e Tailwind. A camada visual utiliza CSS com variáveis de tema e Tailwind v4, Lucide e Recharts.

As regras puras estão em `src/lib/finance`: conversão monetária, calendário de parcelas, saldos, competência, projeções, metas, juros e análises. O banco é a fonte de verdade. Não há persistência financeira em localStorage; somente a preferência de tema fica no dispositivo.

## Dados e segurança

- `auth.users` representa a identidade; `profiles` guarda o nome.
- Cada entidade contém `user_id`, uma chave única `(id, user_id)` e RLS de leitura por proprietário.
- Referências compostas `(registro_id, user_id)` impedem relacionamentos entre proprietários distintos.
- As tabelas não aceitam escrita direta de `authenticated` ou `anon`.
- `public.finance_command` é um invocador que encaminha para `private.finance_command`.
- O comando privado usa `SECURITY DEFINER` de modo deliberado: verifica `auth.uid()`, fixa o dono a partir da sessão, restringe entidades por lista, impede campos reservados, utiliza parâmetros SQL e identificadores escapados e fixa `search_path=''`. O esquema `private` **não deve ser exposto** na Data API.
- Apenas `authenticated` pode executar os comandos; `PUBLIC` e `anon` não podem.
- Um advisory lock por proprietário serializa operações para evitar disputa de limite, excesso de pagamento e duplicação. Cada operação é uma transação PostgreSQL.
- `payments`, `debt_payments` e `investment_events` possuem chaves de idempotência. Compras e cadastros usam IDs gerados antes do envio, reaproveitados em novas tentativas do mesmo formulário.
- `finance_snapshot` usa `SECURITY INVOKER`, respeita RLS e retorna uma visão transacional consistente, sem o limite silencioso de 1.000 linhas das listagens REST.
- A API valida a origem dos POSTs e o usuário em cada solicitação. Respostas financeiras e de sessão usam `private, no-store`.
- Sem service-role/secret key no frontend, backend ou testes.

## Modelo financeiro

Valores monetários: BIGINT em centavos, limite de R$ 1 bilhão por valor individual. Conversão de texto brasileiro por manipulação de dígitos; juros percentuais com BigInt e arredondamento em centavos. Taxas em pontos-base: `100 = 1%`.

Caixa = saldo inicial + recebimentos − pagamentos + transferências recebidas − transferências enviadas − aportes + resgates − principal e juros de dívidas pagos.

Competência = lançamentos não cancelados na data de competência + parcelas de cartão no mês de vencimento + juros efetivamente registrados. Pagamentos de fatura, transferências, aportes e amortizações de principal não são despesas por competência.

Patrimônio = caixa + posições de investimento + bens − saldo devedor de dívidas − compras ativas de cartão ainda não pagas. Metas não criam ativos; representam reservas desejadas. Evite registrar a mesma posição como conta de investimento e ativo ao mesmo tempo.

### Datas e cartões

As datas de negócio são `date`, sem conversão de fuso. “Hoje” usa America/Sao_Paulo. Um fechamento configurado para dia inexistente é ajustado ao último dia do mês. Compras **no dia do fechamento** pertencem ao próximo ciclo. Se o vencimento for menor ou igual ao fechamento, fica no mês seguinte ao ciclo. Diferenças de centavos são distribuídas nas primeiras parcelas.

Não se tenta reproduzir regras particulares de todos os bancos (feriados, horário de corte, juros rotativos e mudança retroativa de fechamento). As faturas existentes preservam seus vencimentos ao editar o cartão; novas compras usam os novos parâmetros.

### Pagamentos e estornos

Lançamentos começam previstos. Um ou mais pagamentos definem status previsto, parcial, pago/recebido. Não se aceita pagar acima do saldo, pagar lançamento cancelado, registrar data efetiva futura ou anterior ao saldo inicial da conta.

Para editar/excluir um lançamento pago, estorne os pagamentos primeiro. Estorno remove o efeito financeiro da operação; não é integração bancária e não movimenta dinheiro externo. Compras pagas exigem estorno das faturas antes do cancelamento. Esse fluxo serve para correção de registros; não representa chargeback bancário automático.

### Recorrências

Geração mensal por dia fixo com `unique(recurrence_id, due_date)`. Dias 29–31 se ajustam ao mês sem perder o dia preferido no mês seguinte. A abertura do aplicativo materializa 12 meses. O planejamento estende as ocorrências virtualmente sem gravar ou duplicar. Uma ocorrência cancelada permanece cancelada. Alterações na série regeneram apenas futuras não pagas e não canceladas. Excluir a série preserva pagamentos realizados e remove os demais lançamentos vinculados.

### Dívidas e investimentos

Dívidas usam saldo inicial informado com sua data e pagamentos de principal/juros separados. Ao amortizar, informe o próximo vencimento. Uma antecipação extra pode manter a data. Estornos de amortizações devem seguir a ordem inversa. A simulação usa prestação fixa e juros mensais sobre o saldo, sem tarifas, seguros, indexadores ou impostos; não reproduz contratos SAC nem CET.

Investimentos têm posição inicial e eventos de aporte, resgate e rendimento. Aportes/resgates alteram a conta de caixa e a posição na mesma transação. Rendimentos manuais aumentam a posição, sem criar recebimento em caixa. Não há cotação automática. Bens utilizam uma avaliação manual vigente, sem histórico de reavaliações.

### Projeções

Partem do caixa de hoje, incluem pendências (atrasadas entram no mês atual), recorrências, parcelas, cronogramas de dívida, ajustes de cenários e reservas para metas. Variáveis são estimadas pela média das três competências anteriores, incluindo meses sem registro como zero. Uma categoria com lançamento na competência não recebe estimativa adicional. Meses intermediários são calculados mesmo quando o usuário escolhe um início posterior.

Conservador: 90% de receitas e 110% de despesas; realista: 100%/100%; otimista: 110%/90%. Cenários personalizados incluem ajustes mensais e uma compra parcelada simulada. Os percentuais são premissas de cenário, não probabilidades. O saldo livre projetado desconta reservas para metas; essas reservas não alteram o caixa real.

## Organização e escala

O snapshot completo simplifica a consistência para uso pessoal. Tabelas são paginadas na interface; exportação e impressão incluem todos os registros do período. Para bases grandes (dezenas de milhares de lançamentos), evoluir para agregações e paginação no servidor antes de ampliar a carga. Não há alegação de desempenho de produção sem medição.

Atualização após cada operação e ao voltar à aba. Não há assinatura Realtime ou sincronização bancária automática. Alertas são calculados na interface, sem e-mail/push. A tabela de notificações está preparada para futura persistência de alertas.
