-- ==============================================================================
-- FINMASTER — SCRIPT DE ATIVAÇÃO DE STORAGE E REALTIME NO SUPABASE
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- Projeto: https://peiwulcxpihozgcmbgua.supabase.co
-- ==============================================================================

-- 1. ADIÇÃO DA COLUNA DE COMPROVANTE FISCAL EM TRANSACTIONS
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS receipt_url text;

-- 2. HABILITAÇÃO DO SUPABASE REALTIME NAS TABELAS PRINCIPAIS
-- Permite sincronização instantânea via WebSocket entre Desktop (.exe) e Mobile (Android)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'credit_cards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_cards;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
  END IF;
END $$;

-- 3. CRIAÇÃO E CONFIGURAÇÃO DO BUCKET DE COMPROVANTES (RECEIPTS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket de receipts
DO $$
BEGIN
  -- Permissão de Upload (Insert) para usuários autenticados na sua própria pasta
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can upload their own receipts' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload their own receipts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  -- Permissão de Leitura (Select) para o próprio usuário autenticado
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view their own receipts' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can view their own receipts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  -- Permissão de visualização pública da imagem do comprovante
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public receipts view' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public receipts view"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'receipts');
  END IF;
END $$;
