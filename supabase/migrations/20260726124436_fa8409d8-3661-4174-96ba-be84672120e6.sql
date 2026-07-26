
revoke execute on function public.redeem_code(text, uuid) from anon, public;
revoke execute on function public.generate_codes(uuid, int) from anon, public;
revoke execute on function public.admin_list_codes() from anon, public;
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.redeem_code(text, uuid) to authenticated;
grant execute on function public.generate_codes(uuid, int) to authenticated;
grant execute on function public.admin_list_codes() to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
