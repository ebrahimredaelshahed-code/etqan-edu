CREATE TABLE public.category_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);
GRANT SELECT, INSERT, DELETE ON public.category_subscriptions TO authenticated;
GRANT ALL ON public.category_subscriptions TO service_role;
ALTER TABLE public.category_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own category subscriptions select" ON public.category_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own category subscriptions insert" ON public.category_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own category subscriptions delete" ON public.category_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);