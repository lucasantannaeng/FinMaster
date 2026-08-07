
-- Fix: Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- accounts
DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- categories
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
CREATE POLICY "Users manage own categories" ON public.categories
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- category_budgets
DROP POLICY IF EXISTS "Users manage own budgets" ON public.category_budgets;
CREATE POLICY "Users manage own budgets" ON public.category_budgets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- contacts
DROP POLICY IF EXISTS "Users manage own contacts" ON public.contacts;
CREATE POLICY "Users manage own contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- credit_cards
DROP POLICY IF EXISTS "Users manage own cards" ON public.credit_cards;
CREATE POLICY "Users manage own cards" ON public.credit_cards
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- transactions
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
