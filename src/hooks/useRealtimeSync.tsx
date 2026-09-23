import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SyncStatus = 'connected' | 'reconnecting' | 'offline';

interface SyncContextType {
  status: SyncStatus;
  isOnline: boolean;
  lastSync: Date | null;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  status: 'offline',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSync: null,
  forceSync: async () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [status, setStatus] = useState<SyncStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting'
  );
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const invalidateAll = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['card-invoice'] }),
      queryClient.invalidateQueries({ queryKey: ['burn-rate'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-health'] }),
      queryClient.invalidateQueries({ queryKey: ['safe-to-spend'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['category-budgets'] }),
    ]);
    setLastSync(new Date());
  }, [queryClient]);

  const forceSync = useCallback(async () => {
    setStatus('reconnecting');
    await invalidateAll();
    if (navigator.onLine) {
      setStatus('connected');
    } else {
      setStatus('offline');
    }
  }, [invalidateAll]);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus('reconnecting');
      invalidateAll().then(() => setStatus('connected'));
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [invalidateAll]);

  // Setup Supabase Realtime channel
  useEffect(() => {
    if (!user?.id || !isOnline) {
      if (!isOnline) setStatus('offline');
      return;
    }

    setStatus('reconnecting');

    const channelName = `realtime-user-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['card-invoice'] });
          queryClient.invalidateQueries({ queryKey: ['burn-rate'] });
          queryClient.invalidateQueries({ queryKey: ['portfolio-health'] });
          queryClient.invalidateQueries({ queryKey: ['safe-to-spend'] });
          setLastSync(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['portfolio-health'] });
          setLastSync(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_cards',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
          queryClient.invalidateQueries({ queryKey: ['card-invoice'] });
          setLastSync(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
          queryClient.invalidateQueries({ queryKey: ['category-budgets'] });
          setLastSync(new Date());
        }
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'SUBSCRIBED') {
          setStatus('connected');
          setLastSync(new Date());
        } else if (
          subscribeStatus === 'CHANNEL_ERROR' ||
          subscribeStatus === 'TIMED_OUT' ||
          subscribeStatus === 'CLOSED'
        ) {
          setStatus('reconnecting');
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (navigator.onLine) {
              channel.subscribe();
            }
          }, 5000);
        }
      });

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, isOnline, queryClient, invalidateAll]);

  return (
    <SyncContext.Provider value={{ status, isOnline, lastSync, forceSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncContext);
}

export function useRealtimeSync() {
  return useSyncStatus();
}
