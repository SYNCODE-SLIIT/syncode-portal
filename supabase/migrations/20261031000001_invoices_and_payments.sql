-- =============================================================================
-- SYNCODE Client Portal — Step 8: invoices and payments
-- =============================================================================
-- 1. save_invoice_draft(): creates or updates a draft invoice and replaces its
--    line items in one transaction, so a failed save never leaves half an invoice.
-- 2. Once an invoice is sent, its number, client, currency, dates and amounts are
--    locked, it can't go back to draft, and a voided invoice stays void.
-- 3. A client's payment slip must sit in their own storage folder.
-- Safe to run more than once.
-- =============================================================================

-- 1. Save a draft invoice with its line items --------------------------------
-- Runs as the caller (security invoker), so row-level security still applies:
-- only admins can write invoices.
create or replace function public.save_invoice_draft(
  p_invoice_id uuid,
  p_client_id uuid,
  p_project_id uuid,
  p_currency public.currency_code,
  p_issue_date date,
  p_due_date date,
  p_discount numeric,
  p_tax numeric,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can save invoices';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An invoice needs at least one line item';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id and client_id = p_client_id
  ) then
    raise exception 'The project does not belong to this client';
  end if;

  if p_invoice_id is null then
    insert into public.invoices (number, client_id, project_id, currency, issue_date, due_date, discount, tax, notes, created_by)
    values ('', p_client_id, p_project_id, p_currency, p_issue_date, p_due_date, p_discount, p_tax, p_notes, auth.uid())
    returning id into v_id;
  else
    update public.invoices
    set client_id = p_client_id,
        project_id = p_project_id,
        currency = p_currency,
        issue_date = p_issue_date,
        due_date = p_due_date,
        discount = p_discount,
        tax = p_tax,
        notes = p_notes
    where id = p_invoice_id and status = 'draft'
    returning id into v_id;

    if v_id is null then
      raise exception 'Only draft invoices can be edited';
    end if;

    delete from public.invoice_items where invoice_id = v_id;
  end if;

  insert into public.invoice_items (invoice_id, position, description, quantity, unit_price)
  select v_id,
         (item.ordinality - 1)::integer,
         item.value->>'description',
         (item.value->>'quantity')::numeric,
         (item.value->>'unit_price')::numeric
  from jsonb_array_elements(p_items) with ordinality as item(value, ordinality);

  return v_id;
end;
$$;

revoke all on function public.save_invoice_draft(uuid, uuid, uuid, public.currency_code, date, date, numeric, numeric, text, jsonb) from public, anon;
grant execute on function public.save_invoice_draft(uuid, uuid, uuid, public.currency_code, date, date, numeric, numeric, text, jsonb) to authenticated;

-- 2. Lock sent invoices ------------------------------------------------------
create or replace function public.trg_guard_invoice_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'A voided invoice cannot be reopened';
  end if;

  if old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'A sent invoice cannot go back to draft';
    end if;
    if new.number is distinct from old.number
      or new.client_id is distinct from old.client_id
      or new.currency is distinct from old.currency
      or new.issue_date is distinct from old.issue_date
      or new.subtotal is distinct from old.subtotal
      or new.discount is distinct from old.discount
      or new.tax is distinct from old.tax then
      raise exception 'A sent invoice cannot be changed. Void it and create a new one instead.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists before_update_guard_invoice on public.invoices;
create trigger before_update_guard_invoice
before update on public.invoices
for each row
execute function public.trg_guard_invoice_update();

-- 3. Client payments: slip must be in the client's own folder -----------------
drop policy if exists "payments_client_insert" on public.payments;
create policy "payments_client_insert" on public.payments
for insert to authenticated
with check (
  public.is_admin()
  or (
    client_id = public.current_client_id()
    and submitted_by = auth.uid()
    and status = 'pending'
    and method = 'bank_transfer'
    and reviewed_by is null
    and reviewed_at is null
    and reject_reason is null
    and slip_path is not null
    and split_part(slip_path, '/', 1) = public.current_client_id()::text
    and exists (
      select 1 from public.invoices i
      where i.id = payments.invoice_id
        and i.client_id = public.current_client_id()
        and i.status in ('sent', 'partially_paid')
    )
  )
);

create index if not exists idx_payments_status on public.payments(status, created_at desc);
create index if not exists idx_invoices_status on public.invoices(status, due_date);
