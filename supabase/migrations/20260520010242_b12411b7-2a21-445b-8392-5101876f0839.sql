UPDATE public.contacts c
SET balance = COALESCE((
  SELECT SUM(CASE WHEN t.type = 'expense' THEN t.amount
                  WHEN t.type = 'income'  THEN -t.amount
                  ELSE 0 END)
  FROM public.transactions t
  WHERE t.contact_id = c.id AND t.is_paid = true
), 0);