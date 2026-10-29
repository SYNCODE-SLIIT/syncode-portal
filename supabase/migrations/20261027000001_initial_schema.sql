-- =============================================================================
-- SYNCODE Client Portal — Step 2: Database Schema, Functions, Triggers & RLS
-- =============================================================================
-- Target: Supabase PostgreSQL
-- Reference: docs/MASTER_PLAN.md (Sections 6 & 7)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS & EXTENSIONS
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('admin', 'team', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_type as enum (
    'website',
    'web_app',
    'mobile_app',
    'ecommerce',
    'ai_system',
    'design',
    'hosting_maintenance',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'planning',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.progress_mode as enum ('auto', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_status as enum ('not_started', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.update_visibility as enum ('client', 'internal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_priority as enum ('low', 'normal', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum (
    'submitted',
    'under_review',
    'quoted',
    'approved',
    'in_progress',
    'delivered',
    'declined'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.currency_code as enum ('LKR', 'USD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attachment_owner_type as enum ('update', 'request', 'comment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum (
    'draft',
    'sent',
    'partially_paid',
    'paid',
    'void'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('bank_transfer', 'cash', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. TABLES
-- -----------------------------------------------------------------------------

-- 2.1 Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  email text,
  phone text,
  address text,
  notes text,
  status public.client_status not null default 'active',
  created_at timestamptz not null default now()
);

-- 2.2 Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'client',
  phone text,
  client_id uuid references public.clients(id) on delete set null,
  is_active boolean not null default true,
  email_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_client_role_check check (
    (role = 'client') or (client_id is null)
  )
);

-- 2.3 Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  type public.project_type not null default 'website',
  status public.project_status not null default 'planning',
  description text,
  live_url text,
  staging_url text,
  repo_url text,
  start_date date,
  target_date date,
  progress_mode public.progress_mode not null default 'auto',
  manual_progress integer not null default 0 check (manual_progress between 0 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 2.4 Project Members (staff assigned to a project)
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

-- 2.5 Milestones
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  weight numeric(6,2) not null default 1 check (weight > 0),
  status public.milestone_status not null default 'not_started',
  percent integer not null default 0 check (percent between 0 and 100),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2.6 Project Updates
create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  visibility public.update_visibility not null default 'client',
  created_at timestamptz not null default now()
);

-- 2.7 Feature Requests
create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  priority public.request_priority not null default 'normal',
  status public.request_status not null default 'submitted',
  estimate_hours numeric(8,2) check (estimate_hours is null or estimate_hours >= 0),
  quote_amount numeric(12,2) check (quote_amount is null or quote_amount >= 0),
  quote_currency public.currency_code,
  decline_reason text,
  client_decision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.8 Request Comments
create table if not exists public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feature_requests(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2.9 Attachments
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_type public.attachment_owner_type not null,
  owner_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 2.10 Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  currency public.currency_code not null default 'LKR',
  issue_date date not null default current_date,
  due_date date not null,
  status public.invoice_status not null default 'draft',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  notes text,
  sent_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 2.11 Invoice Items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

-- 2.12 Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null default 'bank_transfer',
  paid_on date not null default current_date,
  reference text,
  slip_path text,
  status public.payment_status not null default 'pending',
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);

-- 2.13 Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2.14 Activity Log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2.15 Settings (single row enforced via singleton_key)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key = true),
  business_name text not null default 'Team SYNCODE',
  business_address text not null default '1166 Park Road, Pannipitiya 10230, Sri Lanka',
  business_phone text,
  business_email text not null default 'team.syncode@gmail.com',
  logo_path text,
  bank_name text,
  bank_branch text,
  bank_account_name text,
  bank_account_number text,
  bank_swift_code text,
  invoice_prefix text not null default 'SYN',
  next_invoice_seq integer not null default 1 check (next_invoice_seq >= 1),
  payment_terms_days integer not null default 14 check (payment_terms_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for frequent queries & RLS lookups
create index if not exists idx_profiles_client_id on public.profiles(client_id);
create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_milestones_project_id on public.milestones(project_id, position);
create index if not exists idx_project_updates_project_id on public.project_updates(project_id, created_at desc);
create index if not exists idx_feature_requests_project_id on public.feature_requests(project_id);
create index if not exists idx_feature_requests_client_id on public.feature_requests(client_id);
create index if not exists idx_request_comments_request_id on public.request_comments(request_id, created_at);
create index if not exists idx_attachments_owner on public.attachments(owner_type, owner_id);
create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id, position);
create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_client_id on public.payments(client_id);
create index if not exists idx_notifications_recipient on public.notifications(recipient_id, read_at, created_at desc);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);

-- -----------------------------------------------------------------------------
-- 3. SECURITY HELPER FUNCTIONS (RLS)
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('admin', 'team')
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id
  from public.profiles
  where id = auth.uid()
    and is_active = true
    and role = 'client';
$$;

-- -----------------------------------------------------------------------------
-- 4. BUSINESS LOGIC FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------

-- 4.1 Sequential invoice number generator (locks settings row)
-- Format: SYN-2026-0001
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
  if not public.is_admin() and current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
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

-- Auto-assign invoice number on insert if blank
create or replace function public.trg_assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.number is null or btrim(new.number) = '' then
    new.number := public.next_invoice_number(new.issue_date);
  end if;
  return new;
end;
$$;

drop trigger if exists before_insert_invoice_number on public.invoices;
create trigger before_insert_invoice_number
before insert on public.invoices
for each row
execute function public.trg_assign_invoice_number();

-- 4.2 Prevent editing line items of non-draft invoices & recalculate totals
create or replace function public.trg_guard_and_calc_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_status public.invoice_status;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select status into v_status
  from public.invoices
  where id = v_invoice_id;

  if v_status is not null and v_status <> 'draft' then
    raise exception 'Line items of a sent or voided invoice cannot be modified. Void and re-issue the invoice instead.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.amount := round(new.quantity * new.unit_price, 2);
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists before_write_invoice_item on public.invoice_items;
create trigger before_write_invoice_item
before insert or update or delete on public.invoice_items
for each row
execute function public.trg_guard_and_calc_invoice_item();

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12,2);
begin
  select coalesce(round(sum(amount), 2), 0)
  into v_subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id;

  update public.invoices
  set subtotal = v_subtotal,
      total = greatest(0, round(v_subtotal - discount + tax, 2))
  where id = p_invoice_id;
end;
$$;

create or replace function public.trg_after_write_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;

drop trigger if exists after_write_invoice_item on public.invoice_items;
create trigger after_write_invoice_item
after insert or update or delete on public.invoice_items
for each row
execute function public.trg_after_write_invoice_item();

-- 4.3 Recalculate invoice total when discount/tax changes on draft invoice
create or replace function public.trg_before_update_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.total := greatest(0, round(new.subtotal - new.discount + new.tax, 2));
  if new.status = 'sent' and old.status = 'draft' and new.sent_at is null then
    new.sent_at := now();
  end if;
  if new.status = 'void' and old.status <> 'void' and new.voided_at is null then
    new.voided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists before_update_invoice on public.invoices;
create trigger before_update_invoice
before insert or update on public.invoices
for each row
execute function public.trg_before_update_invoice();

-- 4.4 Recalculate invoice amount_paid and status when payments change
create or replace function public.recalculate_invoice_payments(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid numeric(12,2);
  v_total numeric(12,2);
  v_current_status public.invoice_status;
  v_new_status public.invoice_status;
begin
  select total, status
  into v_total, v_current_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(round(sum(amount), 2), 0)
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id
    and status = 'approved';

  v_new_status := v_current_status;
  if v_current_status not in ('draft', 'void') then
    if v_paid >= v_total and v_total > 0 then
      v_new_status := 'paid';
    elsif v_paid > 0 then
      v_new_status := 'partially_paid';
    else
      v_new_status := 'sent';
    end if;
  end if;

  update public.invoices
  set amount_paid = v_paid,
      status = v_new_status
  where id = p_invoice_id;
end;
$$;

create or replace function public.trg_after_write_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_invoice_payments(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;

drop trigger if exists after_write_payment on public.payments;
create trigger after_write_payment
after insert or update or delete on public.payments
for each row
execute function public.trg_after_write_payment();

-- 4.5 Milestone status sync ('done' -> 100%, 'not_started' -> 0%)
create or replace function public.trg_sync_milestone_percent()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    new.percent := 100;
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  elsif new.status = 'not_started' then
    new.percent := 0;
    new.completed_at := null;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists before_write_milestone on public.milestones;
create trigger before_write_milestone
before insert or update on public.milestones
for each row
execute function public.trg_sync_milestone_percent();

-- 4.6 Project weighted progress calculation helper
create or replace function public.calculate_project_progress(p_project_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode public.progress_mode;
  v_manual integer;
  v_weighted numeric;
begin
  select progress_mode, manual_progress
  into v_mode, v_manual
  from public.projects
  where id = p_project_id;

  if not found then
    return 0;
  end if;

  if v_mode = 'manual' then
    return v_manual;
  end if;

  select round(
    sum((case when status = 'done' then 100 else percent end) * weight)
    / nullif(sum(weight), 0)
  )
  into v_weighted
  from public.milestones
  where project_id = p_project_id;

  return coalesce(v_weighted::integer, 0);
end;
$$;

-- 4.7 Auto-create profile row when a new auth user is created
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'client';
  v_client_id uuid := null;
  v_full_name text := '';
begin
  if new.raw_user_meta_data ? 'role' then
    v_role := (new.raw_user_meta_data->>'role')::public.user_role;
  end if;
  if new.raw_user_meta_data ? 'client_id' and (new.raw_user_meta_data->>'client_id') <> '' then
    v_client_id := (new.raw_user_meta_data->>'client_id')::uuid;
  end if;
  if new.raw_user_meta_data ? 'full_name' then
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  end if;

  insert into public.profiles (id, full_name, role, client_id)
  values (new.id, v_full_name, v_role, v_client_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- 4.8 Updated_at timestamp helper for feature_requests
create or replace function public.trg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists before_update_feature_request on public.feature_requests;
create trigger before_update_feature_request
before update on public.feature_requests
for each row
execute function public.trg_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.project_updates enable row level security;
alter table public.feature_requests enable row level security;
alter table public.request_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.settings enable row level security;

-- 5.1 profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_staff()
  or (
    -- Clients can see fellow contacts at their own business & staff assigned to their projects
    (client_id is not null and client_id = public.current_client_id())
    or exists (
      select 1
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.profile_id = profiles.id
        and p.client_id = public.current_client_id()
    )
  )
);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
for update to authenticated
using (id = auth.uid() and is_active = true)
with check (
  id = auth.uid()
  and is_active = true
  -- Non-admins cannot escalate their own role or switch client_id
  and (
    public.is_admin()
    or (
      role = (select p.role from public.profiles p where p.id = auth.uid())
      and client_id is not distinct from (select p.client_id from public.profiles p where p.id = auth.uid())
    )
  )
);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 5.2 clients
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients
for select to authenticated
using (
  public.is_staff()
  or id = public.current_client_id()
);

drop policy if exists "clients_staff_write" on public.clients;
create policy "clients_staff_write" on public.clients
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.3 projects
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
for select to authenticated
using (
  public.is_staff()
  or client_id = public.current_client_id()
);

drop policy if exists "projects_staff_write" on public.projects;
create policy "projects_staff_write" on public.projects
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.4 project_members
drop policy if exists "project_members_select" on public.project_members;
create policy "project_members_select" on public.project_members
for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.client_id = public.current_client_id()
  )
);

drop policy if exists "project_members_staff_write" on public.project_members;
create policy "project_members_staff_write" on public.project_members
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.5 milestones
drop policy if exists "milestones_select" on public.milestones;
create policy "milestones_select" on public.milestones
for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.projects p
    where p.id = milestones.project_id
      and p.client_id = public.current_client_id()
  )
);

drop policy if exists "milestones_staff_write" on public.milestones;
create policy "milestones_staff_write" on public.milestones
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.6 project_updates (clients only see visibility = 'client')
drop policy if exists "project_updates_select" on public.project_updates;
create policy "project_updates_select" on public.project_updates
for select to authenticated
using (
  public.is_staff()
  or (
    visibility = 'client'
    and exists (
      select 1 from public.projects p
      where p.id = project_updates.project_id
        and p.client_id = public.current_client_id()
    )
  )
);

drop policy if exists "project_updates_staff_write" on public.project_updates;
create policy "project_updates_staff_write" on public.project_updates
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.7 feature_requests
drop policy if exists "feature_requests_select" on public.feature_requests;
create policy "feature_requests_select" on public.feature_requests
for select to authenticated
using (
  public.is_staff()
  or client_id = public.current_client_id()
);

drop policy if exists "feature_requests_client_insert" on public.feature_requests;
create policy "feature_requests_client_insert" on public.feature_requests
for insert to authenticated
with check (
  public.is_staff()
  or (
    client_id = public.current_client_id()
    and submitted_by = auth.uid()
    and status = 'submitted'
    and exists (
      select 1 from public.projects p
      where p.id = feature_requests.project_id
        and p.client_id = public.current_client_id()
    )
  )
);

drop policy if exists "feature_requests_staff_write" on public.feature_requests;
create policy "feature_requests_staff_write" on public.feature_requests
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- Clients can approve or decline a quoted feature request on their own project
drop policy if exists "feature_requests_client_quote_decision" on public.feature_requests;
create policy "feature_requests_client_quote_decision" on public.feature_requests
for update to authenticated
using (
  client_id = public.current_client_id()
  and status = 'quoted'
)
with check (
  client_id = public.current_client_id()
  and status in ('approved', 'declined')
);

-- 5.8 request_comments (clients never see internal comments)
drop policy if exists "request_comments_select" on public.request_comments;
create policy "request_comments_select" on public.request_comments
for select to authenticated
using (
  public.is_staff()
  or (
    is_internal = false
    and exists (
      select 1 from public.feature_requests fr
      where fr.id = request_comments.request_id
        and fr.client_id = public.current_client_id()
    )
  )
);

drop policy if exists "request_comments_client_insert" on public.request_comments;
create policy "request_comments_client_insert" on public.request_comments
for insert to authenticated
with check (
  public.is_staff()
  or (
    is_internal = false
    and author_id = auth.uid()
    and exists (
      select 1 from public.feature_requests fr
      where fr.id = request_comments.request_id
        and fr.client_id = public.current_client_id()
    )
  )
);

drop policy if exists "request_comments_staff_write" on public.request_comments;
create policy "request_comments_staff_write" on public.request_comments
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.9 attachments
drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments
for select to authenticated
using (
  public.is_staff()
  or (
    client_id = public.current_client_id()
    and (
      (owner_type = 'request' and exists (
        select 1 from public.feature_requests fr
        where fr.id = attachments.owner_id and fr.client_id = public.current_client_id()
      ))
      or (owner_type = 'update' and exists (
        select 1 from public.project_updates pu
        join public.projects p on p.id = pu.project_id
        where pu.id = attachments.owner_id
          and pu.visibility = 'client'
          and p.client_id = public.current_client_id()
      ))
      or (owner_type = 'comment' and exists (
        select 1 from public.request_comments rc
        join public.feature_requests fr on fr.id = rc.request_id
        where rc.id = attachments.owner_id
          and rc.is_internal = false
          and fr.client_id = public.current_client_id()
      ))
    )
  )
);

drop policy if exists "attachments_client_insert" on public.attachments;
create policy "attachments_client_insert" on public.attachments
for insert to authenticated
with check (
  public.is_staff()
  or (
    client_id = public.current_client_id()
    and uploaded_by = auth.uid()
    and owner_type in ('request', 'comment')
  )
);

drop policy if exists "attachments_staff_write" on public.attachments;
create policy "attachments_staff_write" on public.attachments
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- 5.10 invoices (Admin + owning Client for non-draft; Team members cannot see invoices)
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices
for select to authenticated
using (
  public.is_admin()
  or (
    client_id = public.current_client_id()
    and status <> 'draft'
  )
);

drop policy if exists "invoices_admin_write" on public.invoices;
create policy "invoices_admin_write" on public.invoices
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 5.11 invoice_items
drop policy if exists "invoice_items_select" on public.invoice_items;
create policy "invoice_items_select" on public.invoice_items
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.client_id = public.current_client_id()
      and i.status <> 'draft'
  )
);

drop policy if exists "invoice_items_admin_write" on public.invoice_items;
create policy "invoice_items_admin_write" on public.invoice_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 5.12 payments (Admin all; Client select own & insert pending on own non-draft invoices)
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
for select to authenticated
using (
  public.is_admin()
  or client_id = public.current_client_id()
);

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
    and exists (
      select 1 from public.invoices i
      where i.id = payments.invoice_id
        and i.client_id = public.current_client_id()
        and i.status in ('sent', 'partially_paid')
    )
  )
);

drop policy if exists "payments_admin_write" on public.payments;
create policy "payments_admin_write" on public.payments
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 5.13 notifications
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select to authenticated
using (recipient_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert" on public.notifications
for insert to authenticated
with check (public.is_staff());

-- 5.14 activity_log (Admin only for select, staff can insert)
drop policy if exists "activity_log_select_admin" on public.activity_log;
create policy "activity_log_select_admin" on public.activity_log
for select to authenticated
using (public.is_admin());

drop policy if exists "activity_log_insert_staff" on public.activity_log;
create policy "activity_log_insert_staff" on public.activity_log
for insert to authenticated
with check (public.is_staff());

-- 5.15 settings (Admin write; Admin + Client can read for invoice display)
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings
for select to authenticated
using (
  public.is_admin()
  or public.current_client_id() is not null
);

drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_admin_write" on public.settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. STORAGE BUCKETS & POLICIES (slips, attachments, branding)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('slips', 'slips', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('attachments', 'attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('branding', 'branding', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: slips/{client_id}/{payment_id}/filename
drop policy if exists "slips_select" on storage.objects;
create policy "slips_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'slips'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = public.current_client_id()::text
  )
);

drop policy if exists "slips_insert" on storage.objects;
create policy "slips_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'slips'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = public.current_client_id()::text
  )
);

-- Storage RLS: attachments/{client_id}/filename
drop policy if exists "attachments_storage_select" on storage.objects;
create policy "attachments_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    public.is_staff()
    or (storage.foldername(name))[1] = public.current_client_id()::text
  )
);

drop policy if exists "attachments_storage_insert" on storage.objects;
create policy "attachments_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (
    public.is_staff()
    or (storage.foldername(name))[1] = public.current_client_id()::text
  )
);

-- Storage RLS: branding/...
drop policy if exists "branding_storage_select" on storage.objects;
create policy "branding_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'branding');

drop policy if exists "branding_storage_admin_write" on storage.objects;
create policy "branding_storage_admin_write" on storage.objects
for all to authenticated
using (bucket_id = 'branding' and public.is_admin())
with check (bucket_id = 'branding' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 7. INITIAL SEED DATA (Singleton settings row)
-- -----------------------------------------------------------------------------
insert into public.settings (
  singleton_key,
  business_name,
  business_address,
  business_email,
  invoice_prefix,
  next_invoice_seq,
  payment_terms_days
)
values (
  true,
  'Team SYNCODE',
  '1166 Park Road, Pannipitiya 10230, Sri Lanka',
  'team.syncode@gmail.com',
  'SYN',
  1,
  14
)
on conflict (singleton_key) do nothing;
