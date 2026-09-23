import { supabase } from '@/integrations/supabase/client';
import { getSecureItem } from '@/lib/secureStorage';

export interface OkxAsset {
  currency: string;
  equity: number;
  availableBalance: number;
  priceUsdt: number;
  change24h: number;
  valueBrl: number;
}

export interface OkxData {
  totalEquity: number;
  totalBrl: number;
  usdBrl: number;
  assets: OkxAsset[];
}

export async function getLocalOkxCredentials() {
  if (typeof window === 'undefined') return null;

  const apiKey = (await getSecureItem('OKX_API_KEY')) || localStorage.getItem('OKX_API_KEY');
  const secretKey = (await getSecureItem('OKX_SECRET_KEY')) || localStorage.getItem('OKX_SECRET_KEY');
  const passphrase = (await getSecureItem('OKX_PASSPHRASE')) || localStorage.getItem('OKX_PASSPHRASE');

  const trimmedApiKey = apiKey?.trim();
  const trimmedSecretKey = secretKey?.trim();
  const trimmedPassphrase = passphrase?.trim();

  if (trimmedApiKey && trimmedSecretKey && trimmedPassphrase) {
    return { apiKey: trimmedApiKey, secretKey: trimmedSecretKey, passphrase: trimmedPassphrase };
  }
  return null;
}

export async function fetchOkxBalance() {
  const localCreds = await getLocalOkxCredentials();
  const options = localCreds ? { body: localCreds } : undefined;
  return supabase.functions.invoke('get-okx-balance', options);
}
