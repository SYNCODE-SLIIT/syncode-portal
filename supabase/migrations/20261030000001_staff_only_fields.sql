-- =============================================================================
-- SYNCODE Client Portal — Step 5 prerequisite: staff-only fields
-- =============================================================================
-- Row-level security controls which rows a user can read, not which columns.
-- Clients can read their own client row and their projects, so internal notes
-- and repository links move into separate tables that only staff can read.
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.client_internal (
  client_id uuid primary key references public.clients(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_internal (
  project_id uuid primary key references public.projects(id) on delete cascade,
  repo_url text,
  updated_at timestamptz not null default now()
);

alter table public.client_internal enable row level security;
alter table public.project_internal enable row level security;

drop policy if exists "client_internal_staff_all" on public.client_internal;
create policy "client_internal_staff_all" on public.client_internal
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "project_internal_staff_all" on public.project_internal;
create policy "project_internal_staff_all" on public.project_internal
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

grant select, insert, update, delete on public.client_internal, public.project_internal to authenticated, service_role;
revoke all on public.client_internal, public.project_internal from anon;

-- Move existing values, then drop the old columns (only if they still exist)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'notes'
  ) then
    insert into public.client_internal (client_id, notes)
    select id, notes from public.clients where notes is not null
    on conflict (client_id) do update set notes = excluded.notes;
    alter table public.clients drop column notes;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'repo_url'
  ) then
    insert into public.project_internal (project_id, repo_url)
    select id, repo_url from public.projects where repo_url is not null
    on conflict (project_id) do update set repo_url = excluded.repo_url;
    alter table public.projects drop column repo_url;
  end if;
end $$;
