-- FinanceHub: amounts are integer cents. All writes go through an authenticated command boundary.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null default '', unique(user_id));
create policy owner_read on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create index profiles_owner_idx on public.profiles(user_id);
grant select on public.profiles to authenticated;
revoke insert,update,delete on public.profiles from anon,authenticated;
create table public.accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, institution text not null default '', kind text not null check(kind in ('checking','savings','digital','cash','wallet','investment')), opening_cents bigint not null default 0 check(abs(opening_cents)<=100000000000), opened_on date not null);
alter table public.accounts enable row level security;
create policy owner_read on public.accounts for select to authenticated using ((select auth.uid())=user_id);
create index accounts_owner_idx on public.accounts(user_id);
grant select on public.accounts to authenticated;
revoke insert,update,delete on public.accounts from anon,authenticated;
create table public.categories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, kind text not null check(kind in ('income','expense')), scope text not null check(scope in ('home','personal','income')), parent_id uuid, unique(user_id,name), foreign key (parent_id,user_id) references public.categories(id,user_id), check(parent_id is null or parent_id<>id));
alter table public.categories enable row level security;
create policy owner_read on public.categories for select to authenticated using ((select auth.uid())=user_id);
create index categories_owner_idx on public.categories(user_id);
grant select on public.categories to authenticated;
revoke insert,update,delete on public.categories from anon,authenticated;
create table public.recurrences (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), description text not null, kind text not null check(kind in ('income','expense')), amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), category_id uuid not null, account_id uuid not null, start_date date not null, end_date date, day integer not null check(day between 1 and 31), active boolean not null default true, foreign key (category_id,user_id) references public.categories(id,user_id), foreign key (account_id,user_id) references public.accounts(id,user_id), check(end_date is null or end_date>=start_date));
alter table public.recurrences enable row level security;
create policy owner_read on public.recurrences for select to authenticated using ((select auth.uid())=user_id);
create index recurrences_owner_idx on public.recurrences(user_id);
grant select on public.recurrences to authenticated;
revoke insert,update,delete on public.recurrences from anon,authenticated;
create table public.transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), description text not null, kind text not null check(kind in ('income','expense')), amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), category_id uuid not null, account_id uuid not null, due_date date not null, competence date not null, fixed boolean not null default false, method text not null default 'pix', notes text not null default '', canceled boolean not null default false, recurrence_id uuid, unique(recurrence_id,due_date), foreign key (category_id,user_id) references public.categories(id,user_id), foreign key (account_id,user_id) references public.accounts(id,user_id), foreign key (recurrence_id,user_id) references public.recurrences(id,user_id));
alter table public.transactions enable row level security;
create policy owner_read on public.transactions for select to authenticated using ((select auth.uid())=user_id);
create index transactions_owner_idx on public.transactions(user_id);
grant select on public.transactions to authenticated;
revoke insert,update,delete on public.transactions from anon,authenticated;
create table public.cards (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, institution text not null default '', limit_cents bigint not null check (limit_cents > 0 and limit_cents <= 100000000000), closing_day integer not null check(closing_day between 1 and 31), due_day integer not null check(due_day between 1 and 31));
alter table public.cards enable row level security;
create policy owner_read on public.cards for select to authenticated using ((select auth.uid())=user_id);
create index cards_owner_idx on public.cards(user_id);
grant select on public.cards to authenticated;
revoke insert,update,delete on public.cards from anon,authenticated;
create table public.purchases (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), description text not null, card_id uuid not null, category_id uuid not null, amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), purchased_on date not null, count integer not null check(count between 1 and 360), canceled boolean not null default false, foreign key (card_id,user_id) references public.cards(id,user_id), foreign key (category_id,user_id) references public.categories(id,user_id));
alter table public.purchases enable row level security;
create policy owner_read on public.purchases for select to authenticated using ((select auth.uid())=user_id);
create index purchases_owner_idx on public.purchases(user_id);
grant select on public.purchases to authenticated;
revoke insert,update,delete on public.purchases from anon,authenticated;
create table public.invoices (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), card_id uuid not null, due_date date not null, unique(card_id,due_date), foreign key (card_id,user_id) references public.cards(id,user_id));
alter table public.invoices enable row level security;
create policy owner_read on public.invoices for select to authenticated using ((select auth.uid())=user_id);
create index invoices_owner_idx on public.invoices(user_id);
grant select on public.invoices to authenticated;
revoke insert,update,delete on public.invoices from anon,authenticated;
create table public.installments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), purchase_id uuid not null, invoice_id uuid not null, number integer not null, amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), unique(purchase_id,number), foreign key (purchase_id,user_id) references public.purchases(id,user_id), foreign key (invoice_id,user_id) references public.invoices(id,user_id));
alter table public.installments enable row level security;
create policy owner_read on public.installments for select to authenticated using ((select auth.uid())=user_id);
create index installments_owner_idx on public.installments(user_id);
grant select on public.installments to authenticated;
revoke insert,update,delete on public.installments from anon,authenticated;
create table public.payments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), transaction_id uuid, invoice_id uuid, account_id uuid not null, amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), paid_on date not null, request_id uuid not null, unique(user_id,request_id), check(num_nonnulls(transaction_id,invoice_id)=1), foreign key (transaction_id,user_id) references public.transactions(id,user_id), foreign key (invoice_id,user_id) references public.invoices(id,user_id), foreign key (account_id,user_id) references public.accounts(id,user_id));
alter table public.payments enable row level security;
create policy owner_read on public.payments for select to authenticated using ((select auth.uid())=user_id);
create index payments_owner_idx on public.payments(user_id);
grant select on public.payments to authenticated;
revoke insert,update,delete on public.payments from anon,authenticated;
create table public.transfers (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), source_id uuid not null, destination_id uuid not null, amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), transferred_on date not null, check(source_id<>destination_id), foreign key (source_id,user_id) references public.accounts(id,user_id), foreign key (destination_id,user_id) references public.accounts(id,user_id));
alter table public.transfers enable row level security;
create policy owner_read on public.transfers for select to authenticated using ((select auth.uid())=user_id);
create index transfers_owner_idx on public.transfers(user_id);
grant select on public.transfers to authenticated;
revoke insert,update,delete on public.transfers from anon,authenticated;
create table public.budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), category_id uuid not null, month date not null check(extract(day from month)=1), limit_cents bigint not null check (limit_cents > 0 and limit_cents <= 100000000000), unique(user_id,category_id,month), foreign key (category_id,user_id) references public.categories(id,user_id));
alter table public.budgets enable row level security;
create policy owner_read on public.budgets for select to authenticated using ((select auth.uid())=user_id);
create index budgets_owner_idx on public.budgets(user_id);
grant select on public.budgets to authenticated;
revoke insert,update,delete on public.budgets from anon,authenticated;
create table public.goals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, target_cents bigint not null check (target_cents > 0 and target_cents <= 100000000000), saved_cents bigint not null check (saved_cents >= 0 and saved_cents <= 100000000000), deadline date not null, check(saved_cents<=target_cents));
alter table public.goals enable row level security;
create policy owner_read on public.goals for select to authenticated using ((select auth.uid())=user_id);
create index goals_owner_idx on public.goals(user_id);
grant select on public.goals to authenticated;
revoke insert,update,delete on public.goals from anon,authenticated;
create table public.debts (balance_on date not null default current_date, id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, original_cents bigint not null check (original_cents > 0 and original_cents <= 100000000000), balance_cents bigint not null check (balance_cents >= 0 and balance_cents <= 100000000000), rate_bps integer not null check(rate_bps between 0 and 10000), payment_cents bigint not null check (payment_cents > 0 and payment_cents <= 100000000000), due_date date not null, installments integer not null check(installments between 1 and 600));
alter table public.debts enable row level security;
create policy owner_read on public.debts for select to authenticated using ((select auth.uid())=user_id);
create index debts_owner_idx on public.debts(user_id);
grant select on public.debts to authenticated;
revoke insert,update,delete on public.debts from anon,authenticated;
create table public.debt_payments (previous_due_date date not null, next_due_date date not null, id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), debt_id uuid not null, account_id uuid not null, principal_cents bigint not null check (principal_cents > 0 and principal_cents <= 100000000000), interest_cents bigint not null check (interest_cents >= 0 and interest_cents <= 100000000000), paid_on date not null, request_id uuid not null, unique(user_id,request_id), foreign key (debt_id,user_id) references public.debts(id,user_id), foreign key (account_id,user_id) references public.accounts(id,user_id));
alter table public.debt_payments enable row level security;
create policy owner_read on public.debt_payments for select to authenticated using ((select auth.uid())=user_id);
create index debt_payments_owner_idx on public.debt_payments(user_id);
grant select on public.debt_payments to authenticated;
revoke insert,update,delete on public.debt_payments from anon,authenticated;
create table public.investments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, kind text not null, opening_cents bigint not null check (opening_cents >= 0 and opening_cents <= 100000000000), opened_on date not null, emergency boolean not null default false);
alter table public.investments enable row level security;
create policy owner_read on public.investments for select to authenticated using ((select auth.uid())=user_id);
create index investments_owner_idx on public.investments(user_id);
grant select on public.investments to authenticated;
revoke insert,update,delete on public.investments from anon,authenticated;
create table public.investment_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), investment_id uuid not null, account_id uuid, kind text not null check(kind in ('deposit','withdrawal','yield')), amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000), event_date date not null, request_id uuid not null, unique(user_id,request_id), check(kind='yield' or account_id is not null), foreign key (investment_id,user_id) references public.investments(id,user_id), foreign key (account_id,user_id) references public.accounts(id,user_id));
alter table public.investment_events enable row level security;
create policy owner_read on public.investment_events for select to authenticated using ((select auth.uid())=user_id);
create index investment_events_owner_idx on public.investment_events(user_id);
grant select on public.investment_events to authenticated;
revoke insert,update,delete on public.investment_events from anon,authenticated;
create table public.assets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, value_cents bigint not null check (value_cents >= 0 and value_cents <= 100000000000), valued_on date not null);
alter table public.assets enable row level security;
create policy owner_read on public.assets for select to authenticated using ((select auth.uid())=user_id);
create index assets_owner_idx on public.assets(user_id);
grant select on public.assets to authenticated;
revoke insert,update,delete on public.assets from anon,authenticated;
create table public.scenarios (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), name text not null, income_bps integer not null default 10000 check(income_bps between 0 and 30000), expense_bps integer not null default 10000 check(expense_bps between 0 and 30000), income_delta_cents bigint not null default 0 check(abs(income_delta_cents)<=100000000000), expense_delta_cents bigint not null default 0 check(abs(expense_delta_cents)<=100000000000), purchase_cents bigint not null default 0 check(purchase_cents between 0 and 100000000000), installments integer not null default 1 check(installments between 1 and 360));
alter table public.scenarios enable row level security;
create policy owner_read on public.scenarios for select to authenticated using ((select auth.uid())=user_id);
create index scenarios_owner_idx on public.scenarios(user_id);
grant select on public.scenarios to authenticated;
revoke insert,update,delete on public.scenarios from anon,authenticated;
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(id,user_id), message text not null, read boolean not null default false);
alter table public.notifications enable row level security;
create policy owner_read on public.notifications for select to authenticated using ((select auth.uid())=user_id);
create index notifications_owner_idx on public.notifications(user_id);
grant select on public.notifications to authenticated;
revoke insert,update,delete on public.notifications from anon,authenticated;
create index transactions_period_idx on public.transactions(user_id,competence);
create index transactions_due_idx on public.transactions(user_id,due_date);
create index payments_transaction_idx on public.payments(transaction_id);
create index payments_invoice_idx on public.payments(invoice_id);
create index installments_invoice_idx on public.installments(invoice_id);
create index debt_payments_debt_idx on public.debt_payments(debt_id);
create index investment_events_asset_idx on public.investment_events(investment_id);
create or replace function private.month_day(d date, n integer, target integer) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month', d) + make_interval(months=>n))::date + least(target,extract(day from (date_trunc('month',d)+make_interval(months=>n+1)-interval '1 day'))::integer)-1;
$$;
-- This private definer is the only write boundary. It requires auth.uid(), forces ownership,
-- uses an allowlist and quoted identifiers, and never accepts arbitrary SQL or user_id.
create or replace function private.finance_command(p_action text, p_entity text, p_data jsonb, p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid(); item jsonb; result jsonb; fields text; vals text; changed integer;
 a bigint; total bigint; paid bigint; remaining bigint; principal bigint;
 tx public.transactions; card public.cards; purchase public.purchases; debt public.debts;
 inv public.invoices; rec public.recurrences; investment public.investments;
 d date; first_due date; end_on date; n integer; i integer; inv_id uuid; rec_id uuid;
begin
 if u is null then raise exception 'Autenticação obrigatória' using errcode='42501'; end if;
 if p_action in ('pay','amortize','invest') and p_data->>'account_id' is not null and not exists(select 1 from public.accounts where id=(p_data->>'account_id')::uuid and user_id=u and opened_on<=coalesce((p_data->>'paid_on')::date,(p_data->>'event_date')::date)) then raise exception 'Conta inválida ou data anterior ao saldo inicial'; end if;
 -- Serializes commands for this owner, including idempotency and available-limit checks.
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if p_action='initialize' then
   insert into public.profiles(user_id,name) values(u,'') on conflict(user_id) do nothing;
   insert into public.categories(user_id,name,kind,scope)
   select u,v.name,v.kind,v.scope from (values
   ('Salário principal','income','income'),('Segundo salário','income','income'),('Trabalho autônomo','income','income'),('Comissões','income','income'),('Horas extras','income','income'),('Bonificações','income','income'),('Rendimentos','income','income'),('Aluguéis recebidos','income','income'),('Vendas ocasionais','income','income'),('Reembolsos','income','income'),('Outras receitas','income','income'),
   ('Aluguel ou financiamento','expense','home'),('Energia elétrica','expense','home'),('Água','expense','home'),('Internet','expense','home'),('Condomínio','expense','home'),('Supermercado','expense','home'),('Gás','expense','home'),('Manutenção residencial','expense','home'),('Produtos de limpeza','expense','home'),('Móveis e eletrodomésticos','expense','home'),('Impostos e taxas','expense','home'),('Serviços domésticos','expense','home'),('Outras despesas residenciais','expense','home'),
   ('Alimentação','expense','personal'),('Restaurantes','expense','personal'),('Transporte','expense','personal'),('Combustível','expense','personal'),('Manutenção do veículo','expense','personal'),('Saúde','expense','personal'),('Farmácia','expense','personal'),('Academia','expense','personal'),('Educação','expense','personal'),('Assinaturas','expense','personal'),('Lazer','expense','personal'),('Viagens','expense','personal'),('Vestuário','expense','personal'),('Compras','expense','personal'),('Presentes','expense','personal'),('Cuidados pessoais','expense','personal'),('Outras despesas pessoais','expense','personal')
   ) v(name,kind,scope) on conflict(user_id,name) do nothing;
   return '{"ok":true}';
 end if;
 if p_action in ('create','update','delete') then
   if p_entity not in ('accounts','categories','transactions','recurrences','cards','transfers','budgets','goals','debts','investments','assets','scenarios','profiles') then raise exception 'Entidade inválida'; end if;
   if p_entity='profiles' and p_action<>'update' then raise exception 'Operação inválida'; end if;
   if p_id is null then raise exception 'ID obrigatório'; end if;
   execute format('select to_jsonb(t) from public.%I t where id=$1 and user_id=$2',p_entity) into item using p_id,u;
   if p_action='create' and item is not null then return item; end if;
   if p_action<>'create' and item is null then raise exception 'Registro não encontrado' using errcode='P0002'; end if;
   if p_entity='transfers' and p_action<>'delete' and (not exists(select 1 from public.accounts where id=(p_data->>'source_id')::uuid and user_id=u and opened_on<=(p_data->>'transferred_on')::date) or not exists(select 1 from public.accounts where id=(p_data->>'destination_id')::uuid and user_id=u and opened_on<=(p_data->>'transferred_on')::date)) then raise exception 'Conta inválida ou data anterior ao saldo inicial'; end if;
   if p_entity='transactions' then
     if p_action<>'create' and exists(select 1 from public.payments where transaction_id=p_id and user_id=u) then raise exception 'Estorne os pagamentos antes de alterar ou excluir o lançamento.'; end if;
     if p_action<>'delete' and not exists(select 1 from public.categories where id=(p_data->>'category_id')::uuid and user_id=u and kind=p_data->>'kind') then raise exception 'Categoria incompatível'; end if;
   end if;
   if p_entity='recurrences' and p_action<>'delete' and not exists(select 1 from public.categories where id=(p_data->>'category_id')::uuid and user_id=u and kind=p_data->>'kind') then raise exception 'Categoria incompatível'; end if;
   if p_entity='budgets' and p_action<>'delete' and not exists(select 1 from public.categories where id=(p_data->>'category_id')::uuid and user_id=u and kind='expense') then raise exception 'Orçamento requer categoria de despesa'; end if;
   if p_entity='categories' and p_action='update' and (item->>'kind'<>p_data->>'kind' or item->>'scope'<>p_data->>'scope') then raise exception 'O tipo e o grupo de uma categoria existente não podem ser alterados.'; end if;
   if p_entity='categories' and p_data->>'parent_id' is not null and exists(select 1 from public.categories where parent_id=p_id and user_id=u) then raise exception 'Categoria com subcategorias não pode se tornar subcategoria'; end if;
   if p_entity='categories' and p_data->>'parent_id' is not null and not exists(select 1 from public.categories where id=(p_data->>'parent_id')::uuid and user_id=u and parent_id is null and kind=p_data->>'kind' and scope=p_data->>'scope' and id<>p_id) then raise exception 'Escolha uma categoria principal do mesmo tipo e grupo.'; end if;
   if p_entity='debts' and p_action<>'create' and exists(select 1 from public.debt_payments where debt_id=p_id and user_id=u) then raise exception 'Dívida com amortizações: estorne-as antes de editar.'; end if;
   if p_entity='investments' and p_action<>'create' and exists(select 1 from public.investment_events where investment_id=p_id and user_id=u) then raise exception 'Investimento com eventos: estorne-os antes de editar.'; end if;
   if p_entity='recurrences' and p_action='delete' then
     delete from public.transactions t where t.recurrence_id=p_id and t.user_id=u and not exists(select 1 from public.payments p where p.transaction_id=t.id);
     update public.transactions set recurrence_id=null where recurrence_id=p_id and user_id=u;
   end if;
   if p_action='delete' then
     execute format('delete from public.%I where id=$1 and user_id=$2',p_entity) using p_id,u;
     return '{"ok":true}';
   end if;
   if jsonb_typeof(p_data)<>'object' or p_data ?| array['id','user_id','created_at','recurrence_id','canceled'] then raise exception 'Campos reservados'; end if;
   if exists(select 1 from jsonb_object_keys(p_data) k where not exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_entity and column_name=k)) then raise exception 'Campo inválido'; end if;
   select string_agg(format('%I',k),',' order by k), string_agg(format('r.%I',k),',' order by k) into fields,vals from jsonb_object_keys(p_data) k;
   if fields is null then raise exception 'Dados obrigatórios'; end if;
   if p_action='create' then
     execute format('insert into public.%I(id,user_id,%s) select $1,$2,%s from jsonb_populate_record(null::public.%I,$3) r returning to_jsonb(%I.*)',p_entity,fields,vals,p_entity,p_entity) into result using p_id,u,p_data;
   else
     execute format('update public.%I t set (%s)=(select %s from jsonb_populate_record(null::public.%I,$3) r) where id=$1 and user_id=$2 returning to_jsonb(t.*)',p_entity,fields,vals,p_entity) into result using p_id,u,p_data;
   end if;
   if p_entity='recurrences' and p_action='update' then
     -- Future unpaid occurrences are regenerated. Paid history is immutable.
     delete from public.transactions t where t.recurrence_id=p_id and t.user_id=u and t.due_date >= (now() at time zone 'America/Sao_Paulo')::date and not t.canceled and not exists(select 1 from public.payments p where p.transaction_id=t.id);
   end if;
   return result;
 end if;
 if p_action='generate' then
   end_on := (p_data->>'through')::date;
   if end_on > current_date + interval '5 years' then raise exception 'Horizonte máximo: cinco anos'; end if;
   for rec in select * from public.recurrences where user_id=u and active loop
     d := private.month_day(rec.start_date,0,rec.day);
     if d<rec.start_date then d:=private.month_day(d,1,rec.day); end if;
     while d<=least(end_on,coalesce(rec.end_date,end_on)) loop
       insert into public.transactions(user_id,description,kind,amount_cents,category_id,account_id,due_date,competence,fixed,recurrence_id)
       values(u,rec.description,rec.kind,rec.amount_cents,rec.category_id,rec.account_id,d,d,true,rec.id) on conflict(recurrence_id,due_date) do nothing;
       d:=private.month_day(d,1,rec.day);
     end loop;
   end loop;
   return '{"ok":true}';
 end if;
 if p_action='purchase' then
   select * into purchase from public.purchases where id=p_id and user_id=u;
   if found then return to_jsonb(purchase); end if;
   select * into card from public.cards where id=(p_data->>'card_id')::uuid and user_id=u for update;
   if not found then raise exception 'Cartão não encontrado'; end if;
   if not exists(select 1 from public.categories where id=(p_data->>'category_id')::uuid and user_id=u and kind='expense') then raise exception 'Categoria inválida'; end if;
   a:=(p_data->>'amount_cents')::bigint; n:=(p_data->>'count')::integer; d:=(p_data->>'purchased_on')::date;
   if a<n or n not between 1 and 360 then raise exception 'Parcelamento inválido'; end if;
   select coalesce(sum(amount_cents),0) into total from public.purchases where card_id=card.id and user_id=u and not canceled;
   select coalesce(sum(p.amount_cents),0) into paid from public.payments p join public.invoices i on i.id=p.invoice_id where i.card_id=card.id and p.user_id=u;
   if total-paid+a > card.limit_cents then raise exception 'Compra excede o limite disponível'; end if;
   insert into public.purchases(id,user_id,description,card_id,category_id,amount_cents,purchased_on,count)
   values(p_id,u,p_data->>'description',card.id,(p_data->>'category_id')::uuid,a,d,n) returning * into purchase;
   i:=case when d>=private.month_day(d,0,card.closing_day) then 1 else 0 end + case when card.due_day<=card.closing_day then 1 else 0 end;
   first_due:=private.month_day(d,i,card.due_day);
   for i in 0..n-1 loop
     insert into public.invoices(user_id,card_id,due_date) values(u,card.id,private.month_day(first_due,i,card.due_day)) on conflict(card_id,due_date) do nothing;
     select id into inv_id from public.invoices where card_id=card.id and due_date=private.month_day(first_due,i,card.due_day) and user_id=u;
     insert into public.installments(user_id,purchase_id,invoice_id,number,amount_cents) values(u,purchase.id,inv_id,i+1,a/n+case when i<a%n then 1 else 0 end);
   end loop;
   return to_jsonb(purchase);
 end if;
 if p_action='pay' then
   select to_jsonb(p) into result from public.payments p where request_id=p_id and user_id=u;
   if result is not null then return result; end if;
   a:=(p_data->>'amount_cents')::bigint; d:=(p_data->>'paid_on')::date;
   if d>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Pagamento realizado não pode ter data futura'; end if;
   if p_data->>'transaction_id' is not null then
     select * into tx from public.transactions where id=(p_data->>'transaction_id')::uuid and user_id=u and not canceled for update;
     if not found then raise exception 'Lançamento inválido'; end if;
     total:=tx.amount_cents;
     select coalesce(sum(amount_cents),0) into paid from public.payments where transaction_id=tx.id and user_id=u;
   else
     select * into inv from public.invoices where id=(p_data->>'invoice_id')::uuid and user_id=u for update;
     if not found then raise exception 'Fatura inválida'; end if;
     select coalesce(sum(i.amount_cents),0) into total from public.installments i join public.purchases p on p.id=i.purchase_id where i.invoice_id=inv.id and not p.canceled and p.user_id=u;
     select coalesce(sum(amount_cents),0) into paid from public.payments where invoice_id=inv.id and user_id=u;
   end if;
   if a<=0 or a>total-paid then raise exception 'Pagamento excede o saldo pendente'; end if;
   insert into public.payments(user_id,transaction_id,invoice_id,account_id,amount_cents,paid_on,request_id)
   values(u,tx.id,inv.id,(p_data->>'account_id')::uuid,a,d,p_id) returning to_jsonb(payments.*) into result;
   return result;
 end if;
 if p_action='cancel' then
   if p_entity='transactions' then
     if exists(select 1 from public.payments where transaction_id=p_id and user_id=u) then raise exception 'Estorne os pagamentos antes de cancelar.'; end if;
     update public.transactions set canceled=true where id=p_id and user_id=u returning to_jsonb(transactions.*) into result;
   elsif p_entity='purchases' then
     if exists(select 1 from public.installments i join public.payments p on p.invoice_id=i.invoice_id where i.purchase_id=p_id and p.user_id=u) then raise exception 'Estorne os pagamentos das faturas antes de cancelar a compra.'; end if;
     update public.purchases set canceled=true where id=p_id and user_id=u returning to_jsonb(purchases.*) into result;
   else raise exception 'Entidade inválida'; end if;
   if result is null then raise exception 'Registro não encontrado'; end if;
   return result;
 end if;
 if p_action='amortize' then
   select to_jsonb(p) into result from public.debt_payments p where user_id=u and request_id=p_id;
   if result is not null then return result; end if;
   select * into debt from public.debts where id=(p_data->>'debt_id')::uuid and user_id=u for update;
   if not found then raise exception 'Dívida inválida'; end if;
   principal:=(p_data->>'principal_cents')::bigint;
   if principal<=0 or principal>debt.balance_cents then raise exception 'Amortização excede o saldo devedor'; end if;
   if (p_data->>'paid_on')::date>current_date or (p_data->>'paid_on')::date<debt.balance_on then raise exception 'Data de amortização inválida'; end if;
   if (p_data->>'next_due_date')::date < (p_data->>'paid_on')::date then raise exception 'Próximo vencimento anterior ao pagamento'; end if;
   insert into public.debt_payments(user_id,debt_id,account_id,principal_cents,interest_cents,paid_on,request_id,previous_due_date,next_due_date)
   values(u,debt.id,(p_data->>'account_id')::uuid,principal,(p_data->>'interest_cents')::bigint,(p_data->>'paid_on')::date,p_id,debt.due_date,(p_data->>'next_due_date')::date) returning to_jsonb(debt_payments.*) into result;
   update public.debts set balance_cents=balance_cents-principal, due_date=(p_data->>'next_due_date')::date where id=debt.id and user_id=u;
   return result;
 end if;
 if p_action='invest' then
   select to_jsonb(e) into result from public.investment_events e where user_id=u and request_id=p_id;
   if result is not null then return result; end if;
   select * into investment from public.investments where id=(p_data->>'investment_id')::uuid and user_id=u for update;
   if not found then raise exception 'Investimento inválido'; end if;
   a:=(p_data->>'amount_cents')::bigint;
   select investment.opening_cents+coalesce(sum(case when kind='withdrawal' then -amount_cents else amount_cents end),0) into total from public.investment_events where investment_id=investment.id and user_id=u;
   if p_data->>'kind'='withdrawal' and a>total then raise exception 'Resgate excede o saldo investido'; end if;
   if (p_data->>'event_date')::date<investment.opened_on or (p_data->>'event_date')::date>current_date then raise exception 'Data futura inválida'; end if;
   insert into public.investment_events(user_id,investment_id,account_id,kind,amount_cents,event_date,request_id)
   values(u,investment.id,(p_data->>'account_id')::uuid,p_data->>'kind',a,(p_data->>'event_date')::date,p_id) returning to_jsonb(investment_events.*) into result;
   if exists(select 1 from (select investment.opening_cents+sum(case when kind='withdrawal' then -amount_cents else amount_cents end) over(order by event_date,created_at,id) as balance from public.investment_events where investment_id=investment.id and user_id=u) running where balance<0) then raise exception 'Operação deixa saldo histórico do investimento negativo'; end if;
   return result;
 end if;
 if p_action='reverse' then
   if p_entity='payments' then delete from public.payments where id=p_id and user_id=u returning to_jsonb(payments.*) into result;
   elsif p_entity='debt_payments' then
     if exists(select 1 from public.debt_payments later join public.debt_payments target on target.debt_id=later.debt_id where target.id=p_id and later.user_id=u and later.created_at>target.created_at) then raise exception 'Estorne as amortizações mais recentes primeiro'; end if;
     delete from public.debt_payments where id=p_id and user_id=u returning to_jsonb(debt_payments.*) into result;
     update public.debts set balance_cents=balance_cents+(result->>'principal_cents')::bigint, due_date=(result->>'previous_due_date')::date where id=(result->>'debt_id')::uuid and user_id=u;
   elsif p_entity='investment_events' then
     select to_jsonb(e) into result from public.investment_events e where id=p_id and user_id=u;
     select i.opening_cents+coalesce(sum(case when e.kind='withdrawal' then -e.amount_cents else e.amount_cents end),0) into total from public.investments i left join public.investment_events e on e.investment_id=i.id where i.id=(result->>'investment_id')::uuid and i.user_id=u group by i.opening_cents;
     if result->>'kind'<>'withdrawal' and total<(result->>'amount_cents')::bigint then raise exception 'Estorno deixaria investimento negativo'; end if;
     delete from public.investment_events where id=p_id and user_id=u;
     if exists(select 1 from (select i.opening_cents+sum(case when e.kind='withdrawal' then -e.amount_cents else e.amount_cents end) over(order by e.event_date,e.created_at,e.id) as balance from public.investment_events e join public.investments i on i.id=e.investment_id where i.id=(result->>'investment_id')::uuid and i.user_id=u) running where balance<0) then raise exception 'Estorno deixa saldo histórico do investimento negativo'; end if;
   else raise exception 'Entidade inválida'; end if;
   if result is null then raise exception 'Registro não encontrado'; end if;
   return result;
 end if;
 raise exception 'Operação não reconhecida';
end;
$$;
revoke all on function private.finance_command(text,text,jsonb,uuid) from public,anon;
grant execute on function private.finance_command(text,text,jsonb,uuid) to authenticated;
revoke all on function private.month_day(date,integer,integer) from public,anon;
create or replace function public.finance_command(p_action text,p_entity text default '',p_data jsonb default '{}',p_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.finance_command(p_action,p_entity,p_data,p_id); $$;
revoke all on function public.finance_command(text,text,jsonb,uuid) from public,anon;
grant execute on function public.finance_command(text,text,jsonb,uuid) to authenticated;

create or replace function public.finance_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object(
'profiles',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.profiles t where user_id=(select auth.uid())),
'accounts',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.accounts t where user_id=(select auth.uid())),
'categories',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.categories t where user_id=(select auth.uid())),
'recurrences',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.recurrences t where user_id=(select auth.uid())),
'transactions',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.transactions t where user_id=(select auth.uid())),
'cards',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.cards t where user_id=(select auth.uid())),
'purchases',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.purchases t where user_id=(select auth.uid())),
'invoices',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.invoices t where user_id=(select auth.uid())),
'installments',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.installments t where user_id=(select auth.uid())),
'payments',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.payments t where user_id=(select auth.uid())),
'transfers',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.transfers t where user_id=(select auth.uid())),
'budgets',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.budgets t where user_id=(select auth.uid())),
'goals',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.goals t where user_id=(select auth.uid())),
'debts',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.debts t where user_id=(select auth.uid())),
'debt_payments',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.debt_payments t where user_id=(select auth.uid())),
'investments',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.investments t where user_id=(select auth.uid())),
'investment_events',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.investment_events t where user_id=(select auth.uid())),
'assets',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.assets t where user_id=(select auth.uid())),
'scenarios',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.scenarios t where user_id=(select auth.uid())),
'notifications',(select coalesce(jsonb_agg(t order by t.created_at,t.id),'[]'::jsonb) from public.notifications t where user_id=(select auth.uid()))); $$;
revoke all on function public.finance_snapshot() from public,anon;
grant execute on function public.finance_snapshot() to authenticated;

-- Harden direct RPC callers as well as the validated HTTP API.
do $$ declare c record; begin
 for c in select table_name,column_name from information_schema.columns where table_schema='public' and data_type='date' loop
   execute format('alter table public.%I add check (%I between date ''1900-01-01'' and date ''2100-12-31'')',c.table_name,c.column_name);
 end loop;
 for c in select table_name,column_name from information_schema.columns where table_schema='public' and data_type='text' loop
   execute format('alter table public.%I add check (length(%I)<=2000)',c.table_name,c.column_name);
 end loop;
end $$;
