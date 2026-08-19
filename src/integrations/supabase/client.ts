// This file is automatically configured for standalone cloning and multi-environment setups.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Read from localStorage override if customized by the user, or fallback to Vite environment variables
function getSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('CUSTOM_SUPABASE_URL');
    const customKey = localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY');
    if (customUrl && customKey) {
      return { url: customUrl.trim(), key: customKey.trim() };
    }
  }
  return {
    url: (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-finmaster.supabase.co').trim(),
    key: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key').trim(),
  };
}

const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = getSupabaseCredentials();

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});