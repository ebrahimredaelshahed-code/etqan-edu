CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title_ar text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  pass_score integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage quizzes" ON public.quizzes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "enrolled read quizzes" ON public.quizzes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = quizzes.course_id AND e.user_id = auth.uid()));

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  kind text NOT NULL DEFAULT 'mcq',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer,
  points integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage quiz questions" ON public.quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  has_essay boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts select" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$;

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.quiz_unlocked(_quiz_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = _quiz_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.lessons l ON l.course_id = q.course_id AND l.position <= q.position
      WHERE q.id = _quiz_id
        AND NOT EXISTS (
          SELECT 1 FROM public.lesson_progress p
          WHERE p.lesson_id = l.id AND p.user_id = _user_id AND p.completed
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_quiz_questions(_quiz_id uuid)
RETURNS TABLE(id uuid, prompt text, kind text, options jsonb, points integer, sort_order integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _course uuid;
BEGIN
  SELECT course_id INTO _course FROM public.quizzes WHERE quizzes.id = _quiz_id;
  IF _course IS NULL THEN RETURN; END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN
    IF NOT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = _course AND e.user_id = auth.uid()) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT public.quiz_unlocked(_quiz_id, auth.uid()) THEN
      RAISE EXCEPTION 'locked';
    END IF;
  END IF;
  RETURN QUERY
    SELECT q.id, q.prompt, q.kind, q.options, q.points, q.position
    FROM public.quiz_questions q WHERE q.quiz_id = _quiz_id ORDER BY q.position, q.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_quiz(_quiz_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  _course uuid;
  _score numeric := 0;
  _max numeric := 0;
  _essay boolean := false;
  r record;
  given text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT course_id INTO _course FROM public.quizzes WHERE id = _quiz_id;
  IF _course IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = _course AND e.user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enrolled');
  END IF;
  IF NOT public.quiz_unlocked(_quiz_id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked');
  END IF;

  FOR r IN SELECT * FROM public.quiz_questions WHERE quiz_id = _quiz_id LOOP
    given := _answers ->> r.id::text;
    IF r.kind = 'mcq' THEN
      _max := _max + r.points;
      IF given IS NOT NULL AND r.correct_index IS NOT NULL AND given = r.correct_index::text THEN
        _score := _score + r.points;
      END IF;
    ELSE
      _essay := true;
    END IF;
  END LOOP;

  INSERT INTO public.quiz_attempts (quiz_id, course_id, user_id, answers, score, max_score, has_essay)
  VALUES (_quiz_id, _course, uid, _answers, _score, _max, _essay);

  RETURN jsonb_build_object('ok', true, 'score', _score, 'max', _max, 'hasEssay', _essay);
END;
$$;