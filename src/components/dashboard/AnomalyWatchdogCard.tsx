import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  Trash2,
  EyeOff,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  TrendingDown,
  Info,
} from 'lucide-react';
import {
  runAnomalyWatchdog,
  dismissAnomaly,
  TransactionInput,
  AnomalyAlert,
} from '@/services/anomalyWatchdogService';
import { supabase } from '@/integrations/supabase/client';
import { addToOutbox } from '@/services/offlineOutboxService';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

interface AnomalyWatchdogCardProps {
  transactions: TransactionInput[];
  monthlyIncome?: number;
  monthExpense?: number;
  categories?: Array<{ id: string; name: string }>;
  onOpenConsultant: (initialPrompt: string) => void;
  onRefreshData?: () => void;
}

export const AnomalyWatchdogCard: React.FC<AnomalyWatchdogCardProps> = ({
  transactions,
  monthlyIncome = 0,
  monthExpense = 0,
  categories = [],
  onOpenConsultant,
  onRefreshData,
}) => {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Computa o resumo de anomalias com memoização segura
  const summary = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    return runAnomalyWatchdog({
      transactions,
      monthlyIncome,
      monthExpense,
      categoryMap: catMap,
    });
  }, [transactions, monthlyIncome, monthExpense, categories, refreshNonce]);

  const { alerts, totalAtRisk, highSeverityCount, mediumSeverityCount } = summary;

  // Se não houver anomalias, renderiza barra discreta de integridade
  if (alerts.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm transition-all">
        <CardContent className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Sentinela Ativo & Integridade Verificada
              </p>
              <p className="text-[11px] text-muted-foreground">
                Nenhuma cobrança duplicada, tarifa oculta ou salto atípico detectado no período.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
            100% OK
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Ação de ignorar / descartar falso positivo
  const handleDismiss = (alertId: string) => {
    dismissAnomaly(alertId);
    setRefreshNonce(n => n + 1);
    toast.info('Alerta dispensado', {
      description: 'O Sentinela não notificará novamente sobre este item.',
    });
  };

  // Ação de excluir transação duplicada
  const handleDeleteDuplicate = async (alert: AnomalyAlert) => {
    // Exclui o segundo ID (a cópia duplicada mais recente)
    const duplicateTxId = alert.transactionIds[1] || alert.transactionIds[0];
    if (!duplicateTxId) return;

    setDeletingId(alert.id);
    try {
      if (!navigator.onLine) {
        addToOutbox('transactions', 'delete', {}, 'id', duplicateTxId);
        toast.success('Duplicata removida da fila offline', {
          description: 'A remoção será sincronizada assim que a conexão retornar.',
        });
      } else {
        const { error } = await supabase.from('transactions').delete().eq('id', duplicateTxId);
        if (error) throw error;
        toast.success('Cobrança duplicada excluída com sucesso!');
      }

      dismissAnomaly(alert.id);
      setRefreshNonce(n => n + 1);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Falha ao excluir duplicata:', err);
      toast.error('Erro ao excluir transação', {
        description: err.message || 'Tente novamente.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border-rose-500/30 bg-gradient-to-br from-card via-card to-rose-950/10 shadow-md transition-all overflow-hidden">
      {/* Header do Card */}
      <div className="p-4 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-3">
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
              highSeverityCount > 0
                ? 'bg-rose-500/15 text-rose-500 animate-pulse'
                : 'bg-amber-500/15 text-amber-500'
            }`}
          >
            {highSeverityCount > 0 ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Sentinela de Anomalias</span>
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0 h-4 font-mono font-semibold"
              >
                {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
              </Badge>
              {highSeverityCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-500">
                  {highSeverityCount} crítico
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Impacto financeiro sob atenção:{' '}
              <span className="font-bold text-rose-500 font-mono">
                {formatCurrency(totalAtRisk)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Recolher alertas' : 'Expandir alertas'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Conteúdo Expansível */}
      {expanded && (
        <CardContent className="p-4 pt-3 space-y-3">
          {alerts.map(alert => {
            const isCritical = alert.severity === 'high';
            const isSpike = alert.type === 'expense_spike';
            const isDuplicate = alert.type === 'duplicate_charge';
            const isBankFee = alert.type === 'bank_fee';
            const isLeak = alert.type === 'silent_leak';

            return (
              <div
                key={alert.id}
                className={`rounded-xl p-3.5 border transition-all ${
                  isCritical
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : isSpike
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-border/60 bg-muted/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium uppercase tracking-wider ${
                          isDuplicate
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : isSpike
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : isBankFee
                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isDuplicate
                          ? 'Cobrança Duplicada'
                          : isSpike
                          ? 'Salto Atípico'
                          : isBankFee
                          ? 'Tarifas / Juros'
                          : 'Vazamento Silencioso'}
                      </Badge>
                      <h4 className="text-xs font-semibold text-foreground">{alert.title}</h4>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {alert.description}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span>
                        Impacto estimado:{' '}
                        <strong className="font-mono text-foreground font-semibold">
                          {formatCurrency(alert.impactAmount)}
                        </strong>
                      </span>
                      {alert.categoryName && (
                        <span>
                          Categoria: <strong>{alert.categoryName}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações em 1 Clique */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {isDuplicate && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs px-2.5 gap-1 shadow-sm"
                        disabled={deletingId === alert.id}
                        onClick={() => handleDeleteDuplicate(alert)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === alert.id ? 'Excluindo...' : 'Excluir Duplicata'}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => onOpenConsultant(alert.aiPrompt)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Pedir Análise à IA
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Ignorar alerta"
                      onClick={() => handleDismiss(alert.id)}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
};

export default AnomalyWatchdogCard;
