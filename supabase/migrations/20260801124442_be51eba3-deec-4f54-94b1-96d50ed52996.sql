REVOKE SELECT ON public.lessons FROM anon, authenticated;
GRANT SELECT (id, course_id, title_ar, title_en, duration_minutes, position, created_at) ON public.lessons TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_lesson_video(_lesson_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course uuid;
  _url text;
BEGIN
  SELECT course_id, video_url INTO _course, _url FROM public.lessons WHERE id = _lesson_id;
  IF _course IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN _url; END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = _course AND e.user_id = auth.uid()) THEN
    RETURN _url;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_lesson_video(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_lesson_video(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_lessons(_course_id uuid)
RETURNS SETOF public.lessons
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.lessons WHERE course_id = _course_id ORDER BY position;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_lessons(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_lessons(uuid) TO authenticated;