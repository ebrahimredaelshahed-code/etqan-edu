CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, guardian_phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone',''),
    COALESCE(NEW.raw_user_meta_data->>'guardian_phone','')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'password_plain'
WHERE raw_user_meta_data ? 'password_plain';

ALTER TABLE public.profiles DROP COLUMN password_plain;