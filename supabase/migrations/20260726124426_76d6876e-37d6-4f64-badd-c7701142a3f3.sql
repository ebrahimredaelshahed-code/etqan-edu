
-- ROLES
create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  guardian_phone text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, guardian_phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'guardian_phone','')
  ) on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- CONTENT
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  description_ar text not null default '',
  description_en text not null default '',
  icon text not null default 'BookOpen',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  title_ar text not null,
  title_en text not null,
  description_ar text not null default '',
  description_en text not null default '',
  image_url text not null default '',
  duration_hours numeric not null default 0,
  price numeric not null default 0,
  instructor text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.courses to anon, authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "courses public read" on public.courses for select to anon, authenticated using (true);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title_ar text not null,
  title_en text not null,
  video_url text not null default '',
  duration_minutes int not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.lessons to anon, authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;
create policy "lessons public read" on public.lessons for select to anon, authenticated using (true);

-- ENROLLMENTS
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
grant select on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;
create policy "own enrollments" on public.enrollments for select to authenticated using (auth.uid() = user_id);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;
create policy "own progress" on public.lesson_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CODES
create table public.subscription_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  course_id uuid not null references public.courses(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.subscription_codes to authenticated;
grant all on public.subscription_codes to service_role;
alter table public.subscription_codes enable row level security;
create policy "admins manage codes" on public.subscription_codes for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.redeem_code(_code text, _course_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec public.subscription_codes; uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into rec from public.subscription_codes where code = upper(trim(_code)) for update;
  if rec.id is null then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if rec.course_id <> _course_id then return jsonb_build_object('ok', false, 'error', 'wrong_course'); end if;
  if rec.used_by is not null and rec.used_by <> uid then return jsonb_build_object('ok', false, 'error', 'already_used'); end if;
  update public.subscription_codes set used_by = uid, used_at = now() where id = rec.id;
  insert into public.enrollments (user_id, course_id) values (uid, _course_id) on conflict do nothing;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.generate_codes(_course_id uuid, _count int)
returns setof public.subscription_codes language plpgsql security definer set search_path = public as $$
declare i int; new_code text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  for i in 1.._count loop
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
  where public.has_role(auth.uid(),'admin')
  order by c.created_at desc
  limit 500;
$$;

-- SEED
insert into public.categories (slug, name_ar, name_en, description_ar, description_en, icon, sort_order) values
('programming','البرمجة','Programming','تعلم البرمجة من الصفر إلى الاحتراف','Learn programming from zero to hero','Code',1),
('design','التصميم','Design','تصميم الجرافيك وواجهات المستخدم','Graphic and UI design','Palette',2),
('business','إدارة الأعمال','Business','التسويق وريادة الأعمال','Marketing and entrepreneurship','Briefcase',3),
('languages','اللغات','Languages','إتقان اللغات الأكثر طلباً','Master in-demand languages','Languages',4);

insert into public.courses (category_id, title_ar, title_en, description_ar, description_en, image_url, duration_hours, price, instructor)
select id,'أساسيات جافاسكريبت','JavaScript Fundamentals','دورة شاملة في لغة جافاسكريبت الحديثة مع مشاريع عملية.','A complete modern JavaScript course with hands-on projects.','/images/course-programming.jpg',12,499,'أحمد سالم' from public.categories where slug='programming';
insert into public.courses (category_id, title_ar, title_en, description_ar, description_en, image_url, duration_hours, price, instructor)
select id,'تطوير الويب باستخدام React','Web Development with React','بناء تطبيقات ويب تفاعلية باستخدام React.','Build interactive web apps with React.','/images/course-programming.jpg',18,699,'منى خالد' from public.categories where slug='programming';
insert into public.courses (category_id, title_ar, title_en, description_ar, description_en, image_url, duration_hours, price, instructor)
select id,'تصميم واجهات المستخدم UI/UX','UI/UX Design','مبادئ تصميم تجربة المستخدم وواجهات عصرية.','Principles of UX and modern interface design.','/images/course-design.jpg',10,449,'سارة يوسف' from public.categories where slug='design';
insert into public.courses (category_id, title_ar, title_en, description_ar, description_en, image_url, duration_hours, price, instructor)
select id,'التسويق الرقمي','Digital Marketing','استراتيجيات التسويق عبر المنصات الرقمية.','Marketing strategies across digital platforms.','/images/course-business.jpg',8,399,'كريم فؤاد' from public.categories where slug='business';
insert into public.courses (category_id, title_ar, title_en, description_ar, description_en, image_url, duration_hours, price, instructor)
select id,'الإنجليزية للمحادثة','Conversational English','تحدث الإنجليزية بطلاقة وثقة.','Speak English fluently and confidently.','/images/course-business.jpg',14,349,'ليلى حسن' from public.categories where slug='languages';

insert into public.lessons (course_id, title_ar, title_en, video_url, duration_minutes, position)
select c.id, l.ar, l.en, l.url, l.mins, l.pos
from public.courses c
cross join (values
  ('مقدمة الدورة','Course Introduction','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',8,1),
  ('المفاهيم الأساسية','Core Concepts','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',22,2),
  ('تطبيق عملي','Hands-on Practice','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',31,3),
  ('مستوى متقدم','Advanced Level','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',26,4),
  ('المشروع الختامي','Final Project','https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',35,5)
) as l(ar,en,url,mins,pos);
