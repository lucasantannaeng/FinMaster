import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou uma falha não tratada:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('FINMASTER_OFFLINE_CACHE');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Ops! Algo deu errado</h2>
                <p className="text-xs text-muted-foreground">O FinMaster encontrou uma falha inesperada de execução.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="rounded-lg bg-muted/60 p-3 text-xs font-mono text-destructive/90 overflow-x-auto max-h-32 border border-border/40">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar Aplicativo
              </Button>
              <Button
                variant="outline"
                onClick={this.handleClearCacheAndReload}
                className="w-full flex items-center justify-center gap-2 border-border/80 text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Limpar Cache Local e Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
