
-- Add monthly_income to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_income numeric NOT NULL DEFAULT 0;

-- Create category_budgets table for % allocation per category
CREATE TABLE public.category_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  percentage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budgets" ON public.category_budgets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_category_budgets_updated_at
  BEFORE UPDATE ON public.category_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
