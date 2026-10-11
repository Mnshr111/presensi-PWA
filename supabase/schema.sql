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
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update students" on public.students;
create policy "Authenticated users can update students"
  on public.students for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can delete students" on public.students;
create policy "Authenticated users can delete students"
  on public.students for delete to authenticated
  using (auth.uid() is not null);
