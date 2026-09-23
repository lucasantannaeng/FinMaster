import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export interface AuthResponse {
  user?: any;
  session?: any;
  error?: string;
  message?: string;
}

/**
 * Traduz mensagens técnicas de autenticação do Supabase / GoTrue para português claro
 */
export function translateAuthError(errorMsg: string): string {
  const msg = (errorMsg || '').toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.';
  }
  if (msg.includes('email not confirmed')) {
    return 'E-mail aguardando confirmação. Verifique sua caixa de entrada.';
  }
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'Este e-mail já possui uma conta cadastrada. Faça login.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak_password')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return 'Falha de conexão com o servidor. Verifique sua conexão com a internet.';
  }
  if (msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
    return 'O login com o Google ainda não foi ativado no painel do Supabase.';
  }
  return errorMsg || 'Ocorreu um erro ao processar a autenticação.';
}

/**
 * Verifica se o provedor Google OAuth está ativo no projeto Supabase
 */
export async function checkGoogleOAuthEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return false;
    const settings = await res.json();
    return Boolean(settings?.external?.google);
  } catch (err) {
    console.warn('[authService] Falha ao verificar status do Google OAuth:', err);
    return false;
  }
}

/**
 * Realiza login unificado via Google OAuth para Desktop (Electron), Mobile (Android) e Web
 */
export async function signInWithGoogle(): Promise<{ success?: boolean; error?: string; providerNotEnabled?: boolean }> {
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isDesktop);
  const isNative = Capacitor.isNativePlatform();

  // 1. Desktop Windows / Mac / Linux (Electron com Servidor Loopback local na porta 54321)
  if (isDesktop && (window as any).electronAPI?.startDesktopOAuth) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:54321/callback',
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
        return { providerNotEnabled: true, error: translateAuthError(error.message) };
      }
      return { error: translateAuthError(error.message) };
    }

    if (data?.url) {
      const result = await (window as any).electronAPI.startDesktopOAuth(data.url);
      if (result?.error) return { error: result.error };

      if (result?.access_token && result?.refresh_token) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (sessionErr) return { error: sessionErr.message };
        return { success: true };
      }

      if (result?.code) {
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(result.code);
        if (codeErr) return { error: codeErr.message };
        return { success: true };
      }
    }
    return { success: true };
  }

  // 2. Mobile Android / iOS (Capacitor Browser + Deep Link com scheme com.autorais.finmaster)
  if (isNative) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'com.autorais.finmaster://login-callback',
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
        return { providerNotEnabled: true, error: translateAuthError(error.message) };
      }
      return { error: translateAuthError(error.message) };
    }

    if (data?.url) {
      await Browser.open({ url: data.url, windowName: '_system' });
      return { success: true };
    }
  }

  // 3. Web Padrão (Redirecionamento nativo no navegador)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
      return { providerNotEnabled: true, error: translateAuthError(error.message) };
    }
    return { error: translateAuthError(error.message) };
  }

  return { success: true };
}
