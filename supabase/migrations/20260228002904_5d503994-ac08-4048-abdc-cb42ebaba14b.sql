-- Atomic balance update for accounts
CREATE OR REPLACE FUNCTION public.update_account_balance(
  p_account_id UUID,
  p_delta NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE public.accounts 
  SET balance = balance + p_delta
  WHERE id = p_account_id 
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Atomic balance update for contacts
CREATE OR REPLACE FUNCTION public.update_contact_balance(
  p_contact_id UUID,
  p_delta NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE public.contacts 
  SET balance = balance + p_delta
  WHERE id = p_contact_id 
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;