create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  name text not null,
  class_name text not null,
  school text not null,
  status text not null default 'Alpha'
    check (status in ('Hadir', 'Izin', 'Alpha')),
  time text not null default '-',
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

revoke all on table public.students from anon;
grant select, insert, update, delete on table public.students to authenticated;

drop policy if exists "Authenticated users can read students" on public.students;
create policy "Authenticated users can read students"
  on public.students for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can add students" on public.students;
create policy "Authenticated users can add students"
  on public.students for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated users can update students" on public.students;
create policy "Authenticated users can update students"
  on public.students for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated users can delete students" on public.students;
create policy "Authenticated users can delete students"
  on public.students for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  tentor_code text not null default '',
  role text not null default 'tentor'
    check (role in ('admin', 'tentor')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and role = coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'tentor')
  );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'tentor')
  );

create or replace function public.sync_profile_role_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'tentor' end
  )
  on conflict (id) do update
    set role = excluded.role;
  return new;
end;
$$;

revoke all on function public.sync_profile_role_from_auth() from public, anon, authenticated;

drop trigger if exists sync_profile_role_from_auth on auth.users;
create trigger sync_profile_role_from_auth
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_role_from_auth();

insert into public.profiles (id, display_name, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''),
  case when raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'tentor' end
from auth.users
on conflict (id) do update
  set role = excluded.role;
