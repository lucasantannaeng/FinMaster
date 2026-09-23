-- Adiciona coluna para URL do comprovante fiscal anexado
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS receipt_url text;

-- Cria bucket de storage 'receipts' caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket de receipts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own receipts' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload their own receipts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own receipts' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can view their own receipts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public receipts view' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public receipts view"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'receipts');
  END IF;
END $$;
