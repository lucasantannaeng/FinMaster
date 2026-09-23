import { supabase } from '@/integrations/supabase/client';

/**
 * Faz upload do arquivo de comprovante (imagem ou PDF) para o bucket 'receipts' no Supabase Storage.
 * Retorna a URL pública gerada para persistência na transação.
 */
export async function uploadReceipt(
  file: File,
  userId: string
): Promise<{ url: string | null; error?: string }> {
  try {
    if (!file || !userId) {
      return { url: null, error: 'Arquivo ou identificador de usuário inválido.' };
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('[receiptService] Erro no upload do comprovante:', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
    return { url: data.publicUrl };
  } catch (err: any) {
    console.error('[receiptService] Exceção ao enviar comprovante:', err);
    return { url: null, error: err.message || 'Falha ao salvar comprovante.' };
  }
}
