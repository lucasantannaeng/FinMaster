
-- Add recurrence fields to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS recurrence text DEFAULT null;
-- recurrence values: null (one-time), 'weekly', 'monthly', 'yearly'

COMMENT ON COLUMN public.transactions.recurrence IS 'Recurrence type: null, weekly, monthly, yearly';
