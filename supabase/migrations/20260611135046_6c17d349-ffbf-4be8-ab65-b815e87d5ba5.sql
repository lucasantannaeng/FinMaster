
-- Trigger-only functions: revoke all API access
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_categories() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Balance RPCs: only authenticated users (function internally enforces auth.uid())
REVOKE EXECUTE ON FUNCTION public.update_account_balance(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_contact_balance(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_account_balance(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_contact_balance(uuid, numeric) TO authenticated;
