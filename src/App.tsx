import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { HashRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { AppLockProvider } from "@/hooks/useAppLock";
import { AppLockModal } from "@/components/security/AppLockModal";
import { SyncProvider } from "@/hooks/useRealtimeSync";
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from "@/components/AppLayout";
import PageSkeleton from "@/components/PageSkeleton";

const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Cards = lazy(() => import('./pages/Cards'));
const Profile = lazy(() => import('./pages/Profile'));
const Categories = lazy(() => import('./pages/Categories'));
const TaxReport = lazy(() => import('./pages/TaxReport'));
const Settings = lazy(() => import('./pages/Settings'));
const HourlyRate = lazy(() => import('./pages/HourlyRate'));
const Install = lazy(() => import('./pages/Install'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Trust = lazy(() => import('./pages/Trust'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutos
      gcTime: 1000 * 60 * 60 * 24, // 24 horas no cache offline
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'FINMASTER_OFFLINE_CACHE',
});

const NativeDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        await Browser.close().catch(() => {});
      } catch {}

      if (url && (url.includes('login-callback') || url.includes('access_token') || url.includes('code='))) {
        const hashPart = url.split('#')[1];
        if (hashPart) {
          const params = new URLSearchParams(hashPart);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error) {
              navigate('/', { replace: true });
              return;
            }
          }
        }

        const queryPart = url.split('?')[1]?.split('#')[0];
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          const code = params.get('code');
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              navigate('/', { replace: true });
              return;
            }
          }
        }
      }
    });

    return () => {
      listenerPromise.then(handler => handler.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <SyncProvider>
      <AppLayout>{children}</AppLayout>
    </SyncProvider>
  );
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24, // 24 horas no storage offline
      buster: 'v1.1.1',
    }}
  >
    <TooltipProvider>
      <AppSettingsProvider>
        <AppLockProvider>
          <Toaster />
          <Sonner />
          <AppLockModal />
          <HashRouter>
            <AuthProvider>
              <NativeDeepLinkHandler />
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/trust" element={<Trust />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                  <Route path="/cards" element={<ProtectedRoute><Cards /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
                  <Route path="/tax-report" element={<ProtectedRoute><TaxReport /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/hourly-rate" element={<ProtectedRoute><HourlyRate /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </HashRouter>
        </AppLockProvider>
      </AppSettingsProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
