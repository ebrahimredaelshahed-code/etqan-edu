ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS teacher_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS teacher_image_url text NOT NULL DEFAULT '';