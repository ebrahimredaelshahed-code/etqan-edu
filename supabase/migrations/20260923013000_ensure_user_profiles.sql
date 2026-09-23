CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, guardian_phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'guardian_phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = CASE WHEN public.profiles.phone = '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
    guardian_phone = CASE
      WHEN public.profiles.guardian_phone = '' THEN EXCLUDED.guardian_phone
      ELSE public.profiles.guardian_phone
    END;
  RETURN NEW;
END;
$function$;

INSERT INTO public.profiles (id, full_name, phone, guardian_phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(u.raw_user_meta_data->>'phone', ''),
  COALESCE(u.raw_user_meta_data->>'guardian_phone', '')
FROM auth.users AS u
ON CONFLICT (id) DO UPDATE SET
  full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
  phone = CASE WHEN public.profiles.phone = '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
  guardian_phone = CASE
    WHEN public.profiles.guardian_phone = '' THEN EXCLUDED.guardian_phone
    ELSE public.profiles.guardian_phone
  END;
