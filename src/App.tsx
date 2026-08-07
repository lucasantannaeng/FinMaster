import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
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

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppSettingsProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
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
        </BrowserRouter>
      </AppSettingsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
