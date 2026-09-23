import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { calculateSha256 } from '@/services/cryptoVaultService';
import { useAppSettings } from './useAppSettings';
import { toast } from 'sonner';

interface AppLockContextType {
  isLocked: boolean;
  isPinConfigured: boolean;
  autoLockMinutes: number;
  lockApp: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  setupPin: (newPin: string) => Promise<void>;
  removePin: (currentPin: string) => Promise<boolean>;
  updateAutoLockMinutes: (minutes: number) => void;
}

const PIN_HASH_KEY = 'finmaster_pin_hash';
const PIN_SALT_KEY = 'finmaster_pin_salt';
const AUTOLOCK_KEY = 'finmaster_autolock_minutes';
const LOCKED_STATE_KEY = 'finmaster_app_locked';

const AppLockContext = createContext<AppLockContextType | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { discreteMode, setDiscreteMode } = useAppSettings();

  const [isPinConfigured, setIsPinConfigured] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(PIN_HASH_KEY);
    } catch {
      return false;
    }
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const hasPin = !!localStorage.getItem(PIN_HASH_KEY);
      const wasLocked = localStorage.getItem(LOCKED_STATE_KEY) === 'true';
      return hasPin && wasLocked;
    } catch {
      return false;
    }
  });

  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    try {
      const val = localStorage.getItem(AUTOLOCK_KEY);
      return val !== null ? parseInt(val, 10) : 5;
    } catch {
      return 5;
    }
  });

  const timerRef = useRef<any>(null);

  const lockApp = useCallback(() => {
    if (!isPinConfigured) return;
    setIsLocked(true);
    try {
      localStorage.setItem(LOCKED_STATE_KEY, 'true');
    } catch {}
  }, [isPinConfigured]);

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const storedHash = localStorage.getItem(PIN_HASH_KEY);
      const salt = localStorage.getItem(PIN_SALT_KEY) || 'default-salt';
      if (!storedHash) return false;

      const hash = await calculateSha256(`${pin}:${salt}`);
      if (hash === storedHash) {
        setIsLocked(false);
        try {
          localStorage.removeItem(LOCKED_STATE_KEY);
        } catch {}
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao verificar PIN:', err);
      return false;
    }
  }, []);

  const setupPin = useCallback(async (newPin: string): Promise<void> => {
    if (!newPin || newPin.length < 4) {
      throw new Error('O PIN deve ter no mínimo 4 dígitos.');
    }
    const salt = window.crypto.getRandomValues(new Uint8Array(16)).join('');
    const hash = await calculateSha256(`${newPin}:${salt}`);

    localStorage.setItem(PIN_HASH_KEY, hash);
    localStorage.setItem(PIN_SALT_KEY, salt);
    setIsPinConfigured(true);
    toast.success('PIN de segurança configurado com sucesso!');
  }, []);

  const removePin = useCallback(async (currentPin: string): Promise<boolean> => {
    const valid = await unlockWithPin(currentPin);
    if (!valid) {
      toast.error('PIN atual incorreto.');
      return false;
    }

    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(PIN_SALT_KEY);
    localStorage.removeItem(LOCKED_STATE_KEY);
    setIsPinConfigured(false);
    setIsLocked(false);
    toast.success('Bloqueio por PIN desativado.');
    return true;
  }, [unlockWithPin]);

  const updateAutoLockMinutes = useCallback((minutes: number) => {
    setAutoLockMinutes(minutes);
    try {
      localStorage.setItem(AUTOLOCK_KEY, String(minutes));
    } catch {}
    toast.success(`Bloqueio automático ajustado para ${minutes === 0 ? 'Desativado' : `${minutes} min`}.`);
  }, []);

  // Monitor de Inatividade
  useEffect(() => {
    if (!isPinConfigured || autoLockMinutes <= 0 || isLocked) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lockApp();
      }, autoLockMinutes * 60 * 1000);
    };

    resetTimer();

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    // Bloquear ao perder o foco da janela caso configurado
    const handleVisibilityChange = () => {
      if (document.hidden && autoLockMinutes > 0) {
        // Quando a aba/janela fica em segundo plano
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPinConfigured, autoLockMinutes, isLocked, lockApp]);

  // Atalho de Pânico Global (Ctrl+H ou Ctrl+Shift+H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+H ou Cmd+H
      if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setDiscreteMode(!discreteMode);
        toast.info(
          !discreteMode ? '🛡️ Modo Discreto ATIVADO (Saldos Ocultos)' : 'Modo Discreto desativado'
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [discreteMode, setDiscreteMode]);

  return (
    <AppLockContext.Provider
      value={{
        isLocked,
        isPinConfigured,
        autoLockMinutes,
        lockApp,
        unlockWithPin,
        setupPin,
        removePin,
        updateAutoLockMinutes,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock deve ser utilizado dentro de um AppLockProvider');
  }
  return context;
}
