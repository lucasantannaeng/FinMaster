import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/format';
import { Bell, Search, Check, X, Loader2 } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { toast } from 'sonner';

interface DetectedSubscription {
  description: string;
  amount: number;
  occurrences: number;
  transactionIds: string[];
}

const SubscriptionAlerts = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<DetectedSubscription[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);

  const detectSubscriptions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, description, amount, date, recurrence')
        .eq('type', 'expense')
        .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (!txs || txs.length === 0) {
        setScanned(true);
        setSubscriptions([]);
        return;
      }

      // Group by normalized description + amount (local analysis first)
      const groups = new Map<string, { desc: string; amount: number; ids: string[]; dates: string[] }>();
      for (const tx of txs) {
        if (tx.recurrence) continue; // already marked
        const key = `${tx.description.toLowerCase().trim()}|${Number(tx.amount).toFixed(2)}`;
        const g = groups.get(key) || { desc: tx.description, amount: Number(tx.amount), ids: [], dates: [] };
        g.ids.push(tx.id);
        g.dates.push(tx.date);
        groups.set(key, g);
      }

      // Filter: must have 2+ occurrences with ~30 day intervals
      const detected: DetectedSubscription[] = [];
      for (const [, g] of groups) {
        if (g.ids.length < 2) continue;
        const sortedDates = g.dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
        let isMonthly = true;
        for (let i = 1; i < sortedDates.length; i++) {
          const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
          if (diff < 20 || diff > 40) { isMonthly = false; break; }
        }
        if (isMonthly) {
          detected.push({
            description: g.desc,
            amount: g.amount,
            occurrences: g.ids.length,
            transactionIds: g.ids,
          });
        }
      }

      // Now use AI to enhance detection
      if (txs.length > 0) {
        try {
          const { data: aiResult } = await supabase.functions.invoke('detect-subscriptions', {
            body: {
              transactions: txs.filter(t => !t.recurrence).map(t => ({
                description: t.description,
                amount: t.amount,
                date: t.date,
              })),
            },
          });
          if (aiResult?.additionalSubscriptions) {
            for (const sub of aiResult.additionalSubscriptions) {
              if (!detected.find(d => d.description.toLowerCase() === sub.description.toLowerCase())) {
                const matchingTxs = txs.filter(
                  t => t.description.toLowerCase().includes(sub.description.toLowerCase())
                );
                if (matchingTxs.length >= 2) {
                  detected.push({
                    description: sub.description,
                    amount: sub.amount,
                    occurrences: matchingTxs.length,
                    transactionIds: matchingTxs.map(t => t.id),
                  });
                }
              }
            }
          }
        } catch {
          // AI enhancement is optional, local detection is sufficient
        }
      }

      setSubscriptions(detected);
      setScanned(true);
    } catch (err) {
      console.error('Subscription detection error:', err);
      toast.error('Erro ao detectar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  const markAsRecurrent = async (sub: DetectedSubscription) => {
    try {
      for (const id of sub.transactionIds) {
        await supabase.from('transactions').update({ recurrence: 'monthly' }).eq('id', id);
      }
      setDismissed(prev => new Set(prev).add(sub.description));
      toast.success(`"${sub.description}" marcado como recorrente`);
    } catch {
      toast.error('Erro ao marcar como recorrente');
    }
  };

  const ignore = (sub: DetectedSubscription) => {
    setDismissed(prev => new Set(prev).add(sub.description));
  };

  const visibleSubs = subscriptions.filter(s => !dismissed.has(s.description));

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Alertas de Assinaturas
          <InfoButton helpId="subscription-alerts" />
        </CardTitle>
        <CardDescription className="text-xs">
          Detecta cobranças mensais recorrentes não marcadas
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 space-y-3">
        {!scanned ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={detectSubscriptions}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando 90 dias...</>
            ) : (
              <><Search className="h-4 w-4 mr-2" /> Detectar Assinaturas Esquecidas</>
            )}
          </Button>
        ) : visibleSubs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              ✅ Nenhuma assinatura esquecida detectada
            </p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setScanned(false); setSubscriptions([]); }}>
              Escanear novamente
            </Button>
          </div>
        ) : (
          <>
            <Badge variant="secondary" className="text-[10px]">
              {visibleSubs.length} assinatura(s) detectada(s)
            </Badge>
            <div className="space-y-2">
              {visibleSubs.map((sub, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-2" />}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sub.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(sub.amount)} · {sub.occurrences}x nos últimos 90 dias
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-[11px] px-2"
                        onClick={() => markAsRecurrent(sub)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Recorrente
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2"
                        onClick={() => ignore(sub)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => { setScanned(false); setSubscriptions([]); }}>
              Escanear novamente
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionAlerts;
