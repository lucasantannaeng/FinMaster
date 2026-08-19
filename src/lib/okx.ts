import { supabase } from '@/integrations/supabase/client';

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

export function getLocalOkxCredentials() {
  if (typeof window === 'undefined') return null;
  const apiKey = localStorage.getItem('OKX_API_KEY')?.trim();
  const secretKey = localStorage.getItem('OKX_SECRET_KEY')?.trim();
  const passphrase = localStorage.getItem('OKX_PASSPHRASE')?.trim();
  if (apiKey && secretKey && passphrase) {
    return { apiKey, secretKey, passphrase };
  }
  return null;
}

export async function fetchOkxBalance() {
  const localCreds = getLocalOkxCredentials();
  const options = localCreds ? { body: localCreds } : undefined;
  return supabase.functions.invoke('get-okx-balance', options);
}
