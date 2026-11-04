create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_level text not null check (academic_level in ('Ordinary Level (O-Level)', 'Advanced Level (A-Level)')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, academic_level)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  description text,
  keywords text[] not null default '{}',
  category_id uuid not null references public.categories (id) on delete restrict,
  subject_id uuid references public.subjects (id) on delete set null,
  academic_level text not null check (academic_level in ('Ordinary Level (O-Level)', 'Advanced Level (A-Level)')),
  class_level text check (class_level in ('Form I', 'Form II', 'Form III', 'Form IV', 'Form V', 'Form VI')),
  check (
    class_level is null
    or (academic_level = 'Ordinary Level (O-Level)' and class_level in ('Form I', 'Form II', 'Form III', 'Form IV'))
    or (academic_level = 'Advanced Level (A-Level)' and class_level in ('Form V', 'Form VI'))
  ),
  academic_year integer check (academic_year is null or academic_year between 1900 and 2200),
  author text,
  publisher text,
  cover_image_path text,
  file_path text not null unique,
  file_format text not null check (file_format in ('pdf', 'docx', 'pptx')),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  status text not null default 'draft' check (status in ('draft', 'published')),
  download_count bigint not null default 0 check (download_count >= 0),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  modified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists resources_published_recent_idx on public.resources (created_at desc) where status = 'published';
create index if not exists resources_category_idx on public.resources (category_id);
create index if not exists resources_subject_idx on public.resources (subject_id);
create index if not exists resources_level_class_idx on public.resources (academic_level, class_level);
create index if not exists resources_year_idx on public.resources (academic_year);
create index if not exists resources_download_count_idx on public.resources (download_count desc) where status = 'published';
create index if not exists resources_search_idx on public.resources using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || array_to_string(keywords, ' '))
);
create index if not exists downloads_resource_date_idx on public.downloads (resource_id, downloaded_at desc);
create index if not exists reports_status_date_idx on public.reports (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_resource_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.modified_by = (select auth.uid());
  return new;
end;
$$;

create or replace function public.validate_resource_subject()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subject_id is not null and not exists (
    select 1 from public.subjects
    where id = new.subject_id and academic_level = new.academic_level
  ) then
    raise exception 'Subject must belong to the resource academic level';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at before update on public.resources
for each row execute function public.set_resource_updated_at();
drop trigger if exists resources_validate_subject on public.resources;
create trigger resources_validate_subject before insert or update of subject_id, academic_level on public.resources
for each row execute function public.validate_resource_subject();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.record_download(resource_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resources
  set download_count = download_count + 1
  where id = resource_uuid and status = 'published';

  if not found then
    raise exception 'Resource is unavailable';
  end if;

  insert into public.downloads (resource_id) values (resource_uuid);
end;
$$;

create or replace function public.search_resource_ids(search_query text)
returns table(resource_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id
  from public.resources as r
  join public.categories as c on c.id = r.category_id
  left join public.subjects as s on s.id = r.subject_id
  where r.status = 'published'
    and search_query ~ '[[:alnum:]]'
    and not exists (
      select 1
      from regexp_split_to_table(lower(search_query), '[^[:alnum:]]+') as terms(term)
      where terms.term <> ''
        and concat_ws(
          ' ',
          r.title,
          r.description,
          array_to_string(r.keywords, ' '),
          c.name,
          s.name,
          r.academic_level,
          r.class_level,
          r.academic_year::text
        ) not ilike '%' || terms.term || '%'
    );
$$;

create or replace function public.admin_dashboard_stats()
returns table(total_resources bigint, published_resources bigint, draft_resources bigint, total_downloads bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where status = 'published')::bigint,
    count(*) filter (where status = 'draft')::bigint,
    coalesce(sum(download_count), 0)::bigint
  from public.resources;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.subjects enable row level security;
alter table public.resources enable row level security;
alter table public.downloads enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Profiles readable by owner or admins" on public.profiles;
create policy "Profiles readable by owner or admins" on public.profiles for select
using ((select auth.uid()) = id or (select public.is_admin()));
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Admins create profiles" on public.profiles;
create policy "Admins create profiles" on public.profiles for insert
with check ((select public.is_admin()));
drop policy if exists "Admins update other profiles" on public.profiles;
create policy "Admins update other profiles" on public.profiles for update
using ((select public.is_admin()) and id <> (select auth.uid()))
with check ((select public.is_admin()) and id <> (select auth.uid()));
drop policy if exists "Admins delete other profiles" on public.profiles;
create policy "Admins delete other profiles" on public.profiles for delete
using ((select public.is_admin()) and id <> (select auth.uid()));

drop policy if exists "Categories readable by everyone" on public.categories;
create policy "Categories readable by everyone" on public.categories for select using (true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Active subjects readable by everyone" on public.subjects;
create policy "Active subjects readable by everyone" on public.subjects for select
using (is_active or (select public.is_admin()));
drop policy if exists "Admins manage subjects" on public.subjects;
create policy "Admins manage subjects" on public.subjects for all
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Published resources readable by everyone" on public.resources;
create policy "Published resources readable by everyone" on public.resources for select
using (status = 'published' or (select public.is_admin()));
drop policy if exists "Admins create resources" on public.resources;
create policy "Admins create resources" on public.resources for insert
with check ((select public.is_admin()) and uploaded_by = (select auth.uid()));
drop policy if exists "Admins update resources" on public.resources;
create policy "Admins update resources" on public.resources for update
using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins delete resources" on public.resources;
create policy "Admins delete resources" on public.resources for delete
using ((select public.is_admin()));

drop policy if exists "Admins read downloads" on public.downloads;
create policy "Admins read downloads" on public.downloads for select
using ((select public.is_admin()));
drop policy if exists "Public can report resources" on public.reports;
create policy "Public can report resources" on public.reports for insert
with check (exists (select 1 from public.resources where id = resource_id and status = 'published'));
drop policy if exists "Admins manage reports" on public.reports;
create policy "Admins manage reports" on public.reports for all
using ((select public.is_admin())) with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Published resource files are readable" on storage.objects;
create policy "Published resource files are readable" on storage.objects for select
using (
  bucket_id = 'documents'
  and (
    (select public.is_admin())
    or exists (
      select 1 from public.resources
      where resources.file_path = name and resources.status = 'published'
    )
  )
);
drop policy if exists "Admins upload resource files" on storage.objects;
create policy "Admins upload resource files" on storage.objects for insert
with check (bucket_id = 'documents' and (select public.is_admin()));
drop policy if exists "Admins update resource files" on storage.objects;
create policy "Admins update resource files" on storage.objects for update
using (bucket_id = 'documents' and (select public.is_admin()))
with check (bucket_id = 'documents' and (select public.is_admin()));
drop policy if exists "Admins delete resource files" on storage.objects;
create policy "Admins delete resource files" on storage.objects for delete
using (bucket_id = 'documents' and (select public.is_admin()));

grant execute on function public.record_download(uuid) to anon, authenticated;
grant execute on function public.search_resource_ids(text) to anon, authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

grant select on public.categories, public.subjects, public.resources to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.subjects, public.resources to authenticated;
grant select on public.downloads to authenticated;
grant insert on public.reports to anon, authenticated;
grant select, update, delete on public.reports to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

insert into public.categories (name, description, icon) values
  ('Textbooks', 'Core textbooks organized by subject and class.', 'book-open'),
  ('Past Examination Papers', 'Previous examination papers for practice.', 'file-text'),
  ('Mock Examinations', 'Practice examinations to build confidence.', 'clipboard-check'),
  ('National Examinations', 'National examination learning materials.', 'award'),
  ('Study Notes', 'Clear notes to support everyday learning.', 'notebook-text'),
  ('Revision Materials', 'Focused materials for revision and review.', 'repeat'),
  ('Assignments', 'Assignments and independent practice resources.', 'pencil'),
  ('Subject Guides', 'Guides to help navigate each subject.', 'compass'),
  ('Educational Documents', 'Useful documents for students and educators.', 'file'),
  ('Other Learning Resources', 'Additional resources for curious learners.', 'layers')
on conflict (name) do nothing;

insert into public.subjects (name, academic_level) values
  ('Mathematics', 'Ordinary Level (O-Level)'),
  ('Basic Mathematics', 'Ordinary Level (O-Level)'),
  ('English', 'Ordinary Level (O-Level)'),
  ('Kiswahili', 'Ordinary Level (O-Level)'),
  ('Physics', 'Ordinary Level (O-Level)'),
  ('Chemistry', 'Ordinary Level (O-Level)'),
  ('Biology', 'Ordinary Level (O-Level)'),
  ('Geography', 'Ordinary Level (O-Level)'),
  ('History', 'Ordinary Level (O-Level)'),
  ('Civics', 'Ordinary Level (O-Level)'),
  ('Computer Studies', 'Ordinary Level (O-Level)'),
  ('Commerce', 'Ordinary Level (O-Level)'),
  ('Bookkeeping', 'Ordinary Level (O-Level)'),
  ('Economics', 'Advanced Level (A-Level)'),
  ('Additional Mathematics', 'Advanced Level (A-Level)'),
  ('Physics', 'Advanced Level (A-Level)'),
  ('Chemistry', 'Advanced Level (A-Level)'),
  ('Biology', 'Advanced Level (A-Level)'),
  ('Geography', 'Advanced Level (A-Level)'),
  ('History', 'Advanced Level (A-Level)'),
  ('Kiswahili', 'Advanced Level (A-Level)'),
  ('English Language', 'Advanced Level (A-Level)')
on conflict (name, academic_level) do nothing;
