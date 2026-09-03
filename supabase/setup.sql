create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('灵感', '启发', '感谢自己', '感谢他人')),
  text text not null check (char_length(text) between 1 and 300),
  recipient text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists notes_user_id_idx on public.notes(user_id);
alter table public.notes enable row level security;

revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;

drop policy if exists "read own notes" on public.notes;
drop policy if exists "insert own notes" on public.notes;
drop policy if exists "update own notes" on public.notes;
drop policy if exists "delete own notes" on public.notes;

create policy "read own notes"
on public.notes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "insert own notes"
on public.notes for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "update own notes"
on public.notes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "delete own notes"
on public.notes for delete to authenticated
using ((select auth.uid()) = user_id);

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.test_notebooks (
  code_hash text primary key,
  payload jsonb not null default '{"version":1,"records":[],"deleted":{}}'::jsonb,
  sync_phrase_changed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.test_notebooks
add column if not exists sync_phrase_changed_at timestamptz;

alter table public.test_notebooks enable row level security;
revoke all on public.test_notebooks from anon, authenticated;

-- Retired phrases retain only a one-way hash and retirement timestamp. No
-- notebook content is kept, but the phrase can never point at another notebook.
create table if not exists public.retired_test_notebook_codes (
  code_hash text primary key,
  retired_at timestamptz not null default now()
);

alter table public.retired_test_notebook_codes enable row level security;
revoke all on public.retired_test_notebook_codes from anon, authenticated;

create or replace function public.pull_test_notebook(p_code text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select payload from public.test_notebooks
  where code_hash = encode(extensions.digest(upper(p_code), 'sha256'), 'hex');
$$;

create or replace function public.create_test_notebook(p_code text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_hash text := encode(extensions.digest(upper(p_code), 'sha256'), 'hex');
begin
  if char_length(p_code) < 4 then raise exception 'sync phrase is too short'; end if;
  if exists (select 1 from public.retired_test_notebook_codes where code_hash = requested_hash) then
    return false;
  end if;
  insert into public.test_notebooks(code_hash, payload, updated_at)
  values (requested_hash, p_payload, now())
  on conflict (code_hash) do nothing;
  return found;
end;
$$;

create or replace function public.push_test_notebook(p_code text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.test_notebooks
  set payload = p_payload, updated_at = now()
  where code_hash = encode(extensions.digest(upper(p_code), 'sha256'), 'hex');
  return found;
end;
$$;

-- Combines two notebook snapshots without discarding either side's newer edits.
-- For each note and deletion marker, ISO timestamps determine the winner.
create or replace function public.merge_test_notebook_payload(p_left jsonb, p_right jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with all_records as (
    select entry.record, entry.record->>'id' as id, entry.record->>'updatedAt' as updated_at, entry.record->>'createdAt' as created_at
    from jsonb_array_elements(coalesce(p_left->'records', '[]'::jsonb)) as entry(record)
    union all
    select entry.record, entry.record->>'id', entry.record->>'updatedAt', entry.record->>'createdAt'
    from jsonb_array_elements(coalesce(p_right->'records', '[]'::jsonb)) as entry(record)
  ), latest_records as (
    select distinct on (id) id, record, updated_at, created_at
    from all_records
    where id is not null and updated_at is not null
    order by id, updated_at desc
  ), all_deletions as (
    select entry.key as id, entry.value as deleted_at
    from jsonb_each_text(coalesce(p_left->'deleted', '{}'::jsonb)) as entry(key, value)
    union all
    select entry.key, entry.value
    from jsonb_each_text(coalesce(p_right->'deleted', '{}'::jsonb)) as entry(key, value)
  ), latest_deletions as (
    select distinct on (id) id, deleted_at
    from all_deletions
    where id is not null and deleted_at is not null
    order by id, deleted_at desc
  ), surviving_records as (
    select records.id, records.record, records.created_at, records.updated_at
    from latest_records as records
    left join latest_deletions as deletions on deletions.id = records.id
    where deletions.deleted_at is null or records.updated_at > deletions.deleted_at
  ), surviving_deletions as (
    select deletions.id, deletions.deleted_at
    from latest_deletions as deletions
    left join latest_records as records on records.id = deletions.id
    where records.updated_at is null or deletions.deleted_at >= records.updated_at
  )
  select jsonb_build_object(
    'version', 1,
    'records', coalesce((select jsonb_agg(record order by created_at desc) from surviving_records), '[]'::jsonb),
    'deleted', coalesce((select jsonb_object_agg(id, deleted_at) from surviving_deletions), '{}'::jsonb)
  );
$$;

-- Moves a notebook to a new sync phrase. The old row is deleted in the same
-- transaction and its hash is permanently retired without retaining its content.
create or replace function public.rename_test_notebook_v2(p_old_code text, p_new_code text, p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_hash text := encode(extensions.digest(upper(p_old_code), 'sha256'), 'hex');
  new_hash text := encode(extensions.digest(upper(p_new_code), 'sha256'), 'hex');
  existing_payload jsonb;
  merged_payload jsonb;
  last_changed_at timestamptz;
begin
  if char_length(p_old_code) < 4 or char_length(p_new_code) < 4 then
    raise exception 'sync phrase is too short';
  end if;
  if old_hash = new_hash then
    raise exception 'sync phrase must change';
  end if;

  -- Lock and read the source together, so writes completed before the lock are
  -- merged into the new notebook instead of being overwritten by the migration.
  select payload, sync_phrase_changed_at into existing_payload, last_changed_at
  from public.test_notebooks
  where code_hash = old_hash
  for update;
  if not found then
    return 'not_found';
  end if;
  if last_changed_at is not null and last_changed_at > now() - interval '1 year' then
    return 'change_limit';
  end if;
  if exists (select 1 from public.retired_test_notebook_codes where code_hash = new_hash) then
    return 'code_unavailable';
  end if;

  select public.merge_test_notebook_payload(existing_payload, p_payload) into merged_payload;

  insert into public.test_notebooks(code_hash, payload, sync_phrase_changed_at, updated_at)
  values (new_hash, merged_payload, now(), now())
  on conflict (code_hash) do nothing;
  if not found then
    return 'code_unavailable';
  end if;

  insert into public.retired_test_notebook_codes(code_hash, retired_at)
  values (old_hash, now())
  on conflict (code_hash) do nothing;
  delete from public.test_notebooks where code_hash = old_hash;
  return 'renamed';
end;
$$;

revoke all on function public.pull_test_notebook(text) from public;
revoke all on function public.create_test_notebook(text, jsonb) from public;
revoke all on function public.push_test_notebook(text, jsonb) from public;
revoke all on function public.merge_test_notebook_payload(jsonb, jsonb) from public;
revoke all on function public.rename_test_notebook_v2(text, text, jsonb) from public;
grant execute on function public.pull_test_notebook(text) to anon, authenticated;
grant execute on function public.create_test_notebook(text, jsonb) to anon, authenticated;
grant execute on function public.push_test_notebook(text, jsonb) to anon, authenticated;
grant execute on function public.rename_test_notebook_v2(text, text, jsonb) to anon, authenticated;
