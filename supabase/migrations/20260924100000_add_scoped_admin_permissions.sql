create table public.admin_scopes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  can_codes boolean not null default false,
  can_catalog boolean not null default false,
  can_videos boolean not null default false,
  can_users boolean not null default false,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

grant all on public.admin_scopes to service_role;
alter table public.admin_scopes enable row level security;

insert into public.admin_scopes (user_id, is_super_admin)
select user_id, row_number() over (order by min(id::text)) = 1
from public.user_roles
where role = 'admin'
group by user_id
on conflict (user_id) do update set is_super_admin = excluded.is_super_admin;

create or replace function public.is_super_admin(_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_scopes
    where user_id = _user_id and is_super_admin = true
  )
$$;

create or replace function public.admin_can(_permission text, _category_id uuid default null, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin(_user_id)
    or exists (
      select 1
      from public.admin_scopes s
      where s.user_id = _user_id
        and s.category_id = _category_id
        and case _permission
          when 'codes' then s.can_codes
          when 'catalog' then s.can_catalog
          when 'videos' then s.can_videos
          when 'users' then s.can_users
          else false
        end
    )
$$;

create or replace function public.get_admin_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'isSuperAdmin', public.is_super_admin(auth.uid()),
    'categoryIds', coalesce(
      (select jsonb_agg(category_id) from public.admin_scopes where user_id = auth.uid() and category_id is not null),
      '[]'::jsonb
    ),
    'permissions', jsonb_build_object(
      'codes', coalesce((select can_codes from public.admin_scopes where user_id = auth.uid()), false),
      'catalog', coalesce((select can_catalog from public.admin_scopes where user_id = auth.uid()), false),
      'videos', coalesce((select can_videos from public.admin_scopes where user_id = auth.uid()), false),
      'users', coalesce((select can_users from public.admin_scopes where user_id = auth.uid()), false)
    )
  )
$$;

grant execute on function public.get_admin_access() to authenticated;

create or replace function public.save_admin_scope(
  _user_id uuid,
  _category_id uuid,
  _can_codes boolean,
  _can_catalog boolean,
  _can_videos boolean,
  _can_users boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin(auth.uid()) or _user_id = auth.uid() then raise exception 'forbidden'; end if;
  insert into public.admin_scopes (user_id, category_id, can_codes, can_catalog, can_videos, can_users, is_super_admin)
  values (_user_id, _category_id, _can_codes, _can_catalog, _can_videos, _can_users, false)
  on conflict (user_id) do update set
    category_id = excluded.category_id,
    can_codes = excluded.can_codes,
    can_catalog = excluded.can_catalog,
    can_videos = excluded.can_videos,
    can_users = excluded.can_users;
end; $$;

create or replace function public.admin_list_admins()
returns table (
  id uuid,
  full_name text,
  phone text,
  category_id uuid,
  can_codes boolean,
  can_catalog boolean,
  can_videos boolean,
  can_users boolean,
  is_super_admin boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.phone, s.category_id, s.can_codes, s.can_catalog, s.can_videos, s.can_users, s.is_super_admin
  from public.admin_scopes s
  join public.profiles p on p.id = s.user_id
  where public.is_super_admin(auth.uid())
  order by s.is_super_admin desc, p.created_at;
$$;

grant execute on function public.save_admin_scope(uuid, uuid, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;

drop policy if exists "admins manage categories" on public.categories;
create policy "scoped admins manage categories" on public.categories for all to authenticated
  using (public.admin_can('catalog', id)) with check (public.admin_can('catalog', id));

drop policy if exists "admins manage courses" on public.courses;
create policy "scoped admins manage courses" on public.courses for all to authenticated
  using (public.admin_can('catalog', category_id)) with check (public.admin_can('catalog', category_id));

drop policy if exists "admins manage lessons" on public.lessons;
create policy "scoped admins manage lessons" on public.lessons for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and public.admin_can('videos', c.category_id)))
  with check (exists (select 1 from public.courses c where c.id = course_id and public.admin_can('videos', c.category_id)));

drop policy if exists "admins manage codes" on public.subscription_codes;
create policy "scoped admins manage codes" on public.subscription_codes for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and public.admin_can('codes', c.category_id)))
  with check (exists (select 1 from public.courses c where c.id = course_id and public.admin_can('codes', c.category_id)));

drop policy if exists "admins manage quizzes" on public.quizzes;
create policy "scoped admins manage quizzes" on public.quizzes for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and public.admin_can('videos', c.category_id)))
  with check (exists (select 1 from public.courses c where c.id = course_id and public.admin_can('videos', c.category_id)));

drop policy if exists "admins manage quiz questions" on public.quiz_questions;
create policy "scoped admins manage quiz questions" on public.quiz_questions for all to authenticated
  using (exists (
    select 1 from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = quiz_id and public.admin_can('videos', c.category_id)
  ))
  with check (exists (
    select 1 from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = quiz_id and public.admin_can('videos', c.category_id)
  ));

create or replace function public.generate_codes(_course_id uuid, _count int)
returns setof public.subscription_codes language plpgsql security definer set search_path = public as $$
declare i int; new_code text; category uuid;
begin
  select category_id into category from public.courses where id = _course_id;
  if category is null or not public.admin_can('codes', category) then raise exception 'forbidden'; end if;
  for i in 1..least(greatest(_count, 1), 100) loop
    new_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    return query insert into public.subscription_codes (code, course_id) values (new_code, _course_id) returning *;
  end loop;
end; $$;

create or replace function public.admin_list_codes()
returns table (id uuid, code text, course_id uuid, used_by uuid, used_at timestamptz, created_at timestamptz, course_title text, used_by_name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.course_id, c.used_by, c.used_at, c.created_at, co.title_ar, coalesce(p.full_name,'')
  from public.subscription_codes c
  join public.courses co on co.id = c.course_id
  left join public.profiles p on p.id = c.used_by
  where public.admin_can('codes', co.category_id)
  order by c.created_at desc
  limit 500;
$$;

revoke all on function public.admin_list_codes() from public;
grant execute on function public.admin_list_codes() to authenticated;
revoke all on function public.generate_codes(uuid, int) from public;
grant execute on function public.generate_codes(uuid, int) to authenticated;

create or replace function public.get_lesson_video(_lesson_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare lesson_course uuid; lesson_category uuid; lesson_url text;
begin
  select l.course_id, c.category_id, l.video_url
    into lesson_course, lesson_category, lesson_url
    from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = _lesson_id;
  if lesson_course is null then return null; end if;
  if public.admin_can('videos', lesson_category)
    or exists (select 1 from public.enrollments where course_id = lesson_course and user_id = auth.uid()) then
    return lesson_url;
  end if;
  return null;
end; $$;

create or replace function public.admin_list_lessons(_course_id uuid)
returns setof public.lessons language plpgsql stable security definer set search_path = public as $$
declare lesson_category uuid;
begin
  select category_id into lesson_category from public.courses where id = _course_id;
  if lesson_category is null or not public.admin_can('videos', lesson_category) then raise exception 'forbidden'; end if;
  return query select * from public.lessons where course_id = _course_id order by position;
end; $$;

revoke all on function public.get_lesson_video(uuid) from public;
grant execute on function public.get_lesson_video(uuid) to authenticated;
revoke all on function public.admin_list_lessons(uuid) from public;
grant execute on function public.admin_list_lessons(uuid) to authenticated;