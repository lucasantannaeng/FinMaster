import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import { useSyncStatus } from '@/hooks/useRealtimeSync';
import GlobalVoiceInput from './GlobalVoiceInput';
import { RefreshCw } from 'lucide-react';

function SyncStatusPill() {
  const { status, forceSync } = useSyncStatus();

  return (
    <button
      onClick={() => forceSync()}
      title={
        status === 'connected'
          ? 'Sincronizado em tempo real com o Supabase. Clique para forçar atualização.'
          : status === 'reconnecting'
          ? 'Reconectando ao servidor...'
          : 'Modo Offline: exibindo cache local persistido. Clique para tentar sincronizar.'
      }
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border border-border/60 bg-muted/40 hover:bg-muted/70"
    >
      {status === 'connected' ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-muted-foreground hidden sm:inline">Sincronizado</span>
        </>
      ) : status === 'reconnecting' ? (
        <>
          <RefreshCw className="h-2.5 w-2.5 text-amber-500 animate-spin" />
          <span className="text-amber-500 hidden sm:inline">Reconectando</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span className="text-muted-foreground hidden sm:inline">Offline</span>
        </>
      )}
    </button>
  );
}

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border px-4 shrink-0">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 ml-auto">
            <GlobalVoiceInput />
            <SyncStatusPill />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
