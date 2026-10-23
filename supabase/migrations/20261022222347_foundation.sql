Claude



















20261022222348 purchase edit delete · SQL
-- Migration 20261022222348: adiciona 'delete_purchase' e 'update_purchase' ao finance_command.
--
-- delete_purchase → remove fisicamente a compra e suas parcelas.
--                   Bloqueado se houver pagamentos nas faturas que contenham parcelas desta compra.
-- update_purchase → atualiza descrição, categoria e data da compra.
--                   Valor e número de parcelas não são alterados para preservar a integridade
--                   das faturas e parcelas já existentes.
 
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
 -- ── NOVO: excluir compra ────────────────────────────────────────────────────
 if p_action='delete_purchase' then
   select * into purchase from public.purchases where id=p_id and user_id=u;
   if not found then raise exception 'Compra não encontrada' using errcode='P0002'; end if;
   if exists(
     select 1 from public.installments i
     join public.payments p on p.invoice_id=i.invoice_id
     where i.purchase_id=p_id and p.user_id=u
   ) then raise exception 'Estorne os pagamentos das faturas antes de excluir a compra.'; end if;
   delete from public.installments where purchase_id=p_id and user_id=u;
   delete from public.purchases where id=p_id and user_id=u returning to_jsonb(purchases.*) into result;
   if result is null then raise exception 'Erro ao excluir compra'; end if;
   return result;
 end if;
 -- ── NOVO: editar compra ─────────────────────────────────────────────────────
 if p_action='update_purchase' then
   select * into purchase from public.purchases where id=p_id and user_id=u;
   if not found then raise exception 'Compra não encontrada' using errcode='P0002'; end if;
   if purchase.canceled then raise exception 'Compra cancelada não pode ser editada.'; end if;
   if not exists(
     select 1 from public.categories
     where id=(p_data->>'category_id')::uuid and user_id=u and kind='expense'
   ) then raise exception 'Categoria inválida'; end if;
   update public.purchases set
     description  = coalesce(nullif(trim(p_data->>'description'),''), purchase.description),
     category_id  = coalesce((p_data->>'category_id')::uuid, purchase.category_id),
     purchased_on = coalesce((p_data->>'purchased_on')::date, purchase.purchased_on)
   where id=p_id and user_id=u returning to_jsonb(purchases.*) into result;
   if result is null then raise exception 'Erro ao atualizar compra'; end if;
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
 