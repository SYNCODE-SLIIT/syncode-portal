-- =============================================================================
-- SYNCODE Client Portal — Step 2/3 fixes: table privileges and security hardening
-- =============================================================================
-- Run after 20261027000001_initial_schema.sql. Safe to run more than once.
--
-- 1. Grants: the project was created with "Automatically expose new tables" turned
--    off, so signed-in users and the server need explicit privileges. Row-level
--    security still decides which rows each user can see or change.
-- 2. New accounts no longer take their role or client from sign-up metadata, which
--    the person signing up controls. Roles are set by an admin (invite action).
-- 3. Clients can only approve or decline a quote, and cannot set staff-only fields.
-- 4. Client attachments must belong to the client's own requests or comments.
-- 5. Invoice numbering recognises the service role via the JWT claims.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRIVILEGES
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;

-- Functions: only what RLS policies and the app call directly
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to service_role;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.current_client_id() to authenticated;
grant execute on function public.calculate_project_progress(uuid) to authenticated;
grant execute on function public.next_invoice_number(date) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. NEW AUTH USERS: never trust user-supplied metadata for role or client
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'client';
  v_client_id uuid := null;
begin
  -- app_metadata can only be written with the service role, so it is safe to read.
  -- The invite action also upserts the profile with the chosen role and client.
  begin
    if new.raw_app_meta_data ? 'role' then
      v_role := (new.raw_app_meta_data->>'role')::public.user_role;
    end if;
    if coalesce(new.raw_app_meta_data->>'client_id', '') <> '' then
      v_client_id := (new.raw_app_meta_data->>'client_id')::uuid;
    end if;
  exception when others then
    v_role := 'client';
    v_client_id := null;
  end;

  if v_role <> 'client' then
    v_client_id := null;
  end if;

  insert into public.profiles (id, full_name, role, client_id)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    v_role,
    v_client_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. FEATURE REQUESTS: limit what clients can write
-- -----------------------------------------------------------------------------
create or replace function public.trg_guard_feature_request_client_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Staff, the service role and direct database sessions (no JWT) are not restricted
  if public.is_staff()
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or auth.jwt() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'submitted';
    new.estimate_hours := null;
    new.quote_amount := null;
    new.quote_currency := null;
    new.decline_reason := null;
    new.client_decision_at := null;
    return new;
  end if;

  -- UPDATE by a client: only a quoted request may move to approved or declined
  if old.status <> 'quoted' or new.status not in ('approved', 'declined') then
    raise exception 'Clients can only approve or decline a quoted request';
  end if;

  if (new.project_id, new.client_id, new.submitted_by, new.title, new.description,
      new.priority, new.estimate_hours, new.quote_amount, new.quote_currency, new.created_at)
     is distinct from
     (old.project_id, old.client_id, old.submitted_by, old.title, old.description,
      old.priority, old.estimate_hours, old.quote_amount, old.quote_currency, old.created_at) then
    raise exception 'Clients can only change the decision on a quote';
  end if;

  if new.status = 'approved' then
    new.decline_reason := null;
  end if;
  new.client_decision_at := now();
  return new;
end;
$$;

drop trigger if exists before_write_feature_request_guard on public.feature_requests;
create trigger before_write_feature_request_guard
before insert or update on public.feature_requests
for each row
execute function public.trg_guard_feature_request_client_write();

-- -----------------------------------------------------------------------------
-- 4. ATTACHMENTS: client uploads must belong to their own request or comment
-- -----------------------------------------------------------------------------
drop policy if exists "attachments_client_insert" on public.attachments;
create policy "attachments_client_insert" on public.attachments
for insert to authenticated
with check (
  public.is_staff()
  or (
    client_id = public.current_client_id()
    and uploaded_by = auth.uid()
    and (
      (owner_type = 'request' and exists (
        select 1 from public.feature_requests fr
        where fr.id = attachments.owner_id
          and fr.client_id = public.current_client_id()
      ))
      or (owner_type = 'comment' and exists (
        select 1 from public.request_comments rc
        join public.feature_requests fr on fr.id = rc.request_id
        where rc.id = attachments.owner_id
          and rc.author_id = auth.uid()
          and rc.is_internal = false
          and fr.client_id = public.current_client_id()
      ))
    )
  )
);

-- -----------------------------------------------------------------------------
-- 5. INVOICE NUMBERS: recognise the service role from the JWT claims
-- -----------------------------------------------------------------------------
create or replace function public.next_invoice_number(p_issue_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq integer;
  v_year text;
begin
  if not public.is_admin()
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and auth.jwt() is not null then
    raise exception 'Only admins can generate invoice numbers';
  end if;

  update public.settings
  set next_invoice_seq = next_invoice_seq + 1,
      updated_at = now()
  where singleton_key = true
  returning invoice_prefix, next_invoice_seq - 1 into v_prefix, v_seq;

  if v_prefix is null then
    insert into public.settings (singleton_key, next_invoice_seq)
    values (true, 2)
    returning invoice_prefix, 1 into v_prefix, v_seq;
  end if;

  v_year := to_char(coalesce(p_issue_date, current_date), 'YYYY');
  return format('%s-%s-%s', v_prefix, v_year, lpad(v_seq::text, 4, '0'));
end;
$$;

-- Re-apply function grants for the functions replaced above
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.trg_guard_feature_request_client_write() from public, anon, authenticated;
grant execute on function public.next_invoice_number(date) to authenticated, service_role;
