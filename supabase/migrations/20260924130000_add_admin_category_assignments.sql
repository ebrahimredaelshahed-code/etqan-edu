CREATE TABLE public.admin_category_assignments (
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, category_id)
);

ALTER TABLE public.admin_category_assignments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_category_assignments TO service_role;

-- Existing admins keep access to every subject until assignments are configured.
INSERT INTO public.admin_category_assignments (admin_id, category_id)
SELECT roles.user_id, categories.id
FROM public.user_roles roles
CROSS JOIN public.categories categories
WHERE roles.role = 'admin'
ON CONFLICT DO NOTHING;
