<div align="center">

# FinanceHub

**Sua vida financeira, em equilíbrio.**

Organize suas contas, acompanhe seus gastos e transforme objetivos em planos.

[Recursos](#recursos) · [Tecnologias](#tecnologias) · [Como executar](#como-executar) · [Documentação](#documentação)

</div>

---

## Sobre o projeto

O **FinanceHub** é um aplicativo web de gestão de finanças pessoais que reúne receitas, despesas, contas, cartões e planejamento em um único espaço.

A proposta é ajudar você a entender para onde o dinheiro está indo, acompanhar compromissos e avaliar como as escolhas de hoje podem afetar os próximos meses. A interface utiliza português brasileiro, valores em reais e datas no padrão brasileiro.

## Recursos

| Área | O que você pode fazer |
| --- | --- |
| **Visão geral** | Acompanhar saldos, receitas, despesas, pendências e patrimônio em indicadores e gráficos. |
| **Receitas e despesas** | Organizar lançamentos pessoais e residenciais, categorias, recorrências e pagamentos parciais. |
| **Contas e carteiras** | Consultar saldos e extratos e registrar transferências entre suas contas. |
| **Cartões de crédito** | Cadastrar cartões, distribuir compras parceladas e acompanhar faturas e pagamentos. |
| **Planejamento** | Projetar o fluxo financeiro de 1 a 60 meses e comparar cenários conservador, realista e otimista. |
| **Calendário** | Visualizar receitas previstas, despesas, atrasos e vencimentos de faturas. |
| **Orçamentos** | Definir limites por categoria e acompanhar alertas de consumo de 80%, 90% e 100%. |
| **Metas** | Registrar objetivos, acompanhar o valor reservado e calcular a contribuição mensal necessária. |
| **Dívidas** | Acompanhar saldos devedores, registrar amortizações e simular antecipações. |
| **Investimentos** | Registrar posições, aportes, resgates, rendimentos e bens manualmente. |
| **Relatórios** | Comparar períodos, analisar categorias e exportar CSV ou salvar PDF pela impressão do navegador. |

## Planeje com mais clareza

O FinanceHub permite explorar perguntas do dia a dia:

- Quanto ainda tenho para receber e pagar?
- Quanto gasto com a casa e com despesas pessoais?
- Quais parcelas comprometem os próximos meses?
- Como uma nova despesa pode afetar meu saldo futuro?
- Quanto preciso reservar por mês para alcançar uma meta?

As simulações usam os registros cadastrados e premissas apresentadas na tela. Cenários personalizados permitem ajustar receitas, despesas e compras parceladas sem modificar os lançamentos reais.

## Cuidado com os números

Os cálculos distinguem **competência financeira** de **movimentação de caixa**. Uma receita prevista não aumenta o saldo disponível antes do recebimento, transferências internas não viram receitas e o pagamento de uma fatura não duplica a despesa da compra.

Valores monetários são armazenados em centavos inteiros. Pagamentos parciais, estornos e recorrências possuem regras próprias, com operações transacionais no PostgreSQL e testes automatizados.

## Experiência e acesso

- Interface responsiva com navegação lateral e temas claro e escuro.
- Cadastro, login e recuperação de senha pelo Supabase Auth.
- Validação de formulários no cliente e no servidor.
- Isolamento dos dados por usuário com Row Level Security e controle das operações no banco.
- Análises financeiras baseadas em regras matemáticas, sem dependência de IA externa.

Os investimentos são acompanhados manualmente. As projeções são estimativas; não há integração automática com bancos ou corretoras.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Aplicação | Next.js, React e JavaScript/JSX |
| Interface | Tailwind CSS, Radix no padrão shadcn/ui e Lucide |
| Gráficos | Recharts |
| Formulários e validação | React Hook Form e Zod |
| Backend | API Routes do Next.js e funções PostgreSQL |
| Banco e autenticação | Supabase e PostgreSQL |
| Testes | Vitest, PGlite e Playwright |
| Hospedagem prevista | Vercel |

## Como executar

Requer **Node.js 22 ou superior** e um projeto Supabase configurado.

```bash
npm ci
```

Crie o arquivo `.env.local` na raiz do projeto usando [.env.example](.env.example) como referência. Se o arquivo já existir, preserve seus valores.

Siga o [guia de configuração](docs/SETUP.md) para preencher as variáveis, aplicar a migração e configurar os retornos de autenticação. Depois, execute:

```bash
npm run dev
```

Acesse **http://localhost:3000**. Sem as variáveis do Supabase, o aplicativo apresenta as instruções de preparação. Os dados financeiros começam vazios e são preenchidos pelos seus próprios registros.

## Documentação

- [Configuração local, Supabase e hospedagem](docs/SETUP.md)
- [Arquitetura e regras financeiras](docs/ARCHITECTURE.md)
- [Verificação e limites conhecidos](docs/VERIFICATION.md)
- [Migração do banco de dados](supabase/migrations/20261022222347_foundation.sql)

## Desenvolvimento

```bash
npm test          # Regras financeiras e testes PostgreSQL
npm run build     # Compilação de produção
npm run test:e2e   # Fluxo de navegador em ambiente de teste
```

O teste de navegador utiliza autenticação simulada e um banco temporário. A autenticação real, os e-mails e o ambiente publicado precisam ser validados com o Supabase configurado.

---

<div align="center">

**FinanceHub — mais clareza para suas escolhas.**

</div>
