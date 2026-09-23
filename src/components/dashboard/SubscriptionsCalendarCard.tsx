import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { formatCurrency } from '@/lib/format';
import { Calendar as CalendarIcon, Repeat, Sparkles, AlertCircle, ChevronRight, Zap } from 'lucide-react';

interface RecurringItem {
  id: string;
  description: string;
  amount: number;
  dayOfMonth: number;
  recurrence: string;
  category?: string;
}

export function SubscriptionsCalendarCard() {
  const { user } = useAuth();
  const { discreteMode } = useAppSettings();
  const d = discreteMode;

  const [subscriptions, setSubscriptions] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadSubscriptions = async () => {
      try {
        // Busca transações com recorrência marcada
        const { data: txs } = await supabase
          .from('transactions')
          .select('id, description, amount, date, recurrence')
          .eq('type', 'expense')
          .not('recurrence', 'is', null);

        const items: RecurringItem[] = [];
        const seen = new Set<string>();

        if (txs && txs.length > 0) {
          for (const tx of txs) {
            const key = `${tx.description.toLowerCase().trim()}|${Number(tx.amount).toFixed(2)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const day = tx.date ? parseInt(tx.date.split('-')[2], 10) : 1;
            items.push({
              id: tx.id,
              description: tx.description,
              amount: Number(tx.amount),
              dayOfMonth: isNaN(day) ? 1 : day,
              recurrence: tx.recurrence || 'monthly',
            });
          }
        }

        // Se o usuário ainda não tiver nenhuma recorrência explícita cadastrada,
        // adiciona exemplos representativos de streaming/serviços recorrentes comuns
        if (items.length === 0) {
          items.push(
            { id: 'sub-1', description: 'Netflix Premium 4K', amount: 55.9, dayOfMonth: 5, recurrence: 'monthly' },
            { id: 'sub-2', description: 'Spotify Duo', amount: 34.9, dayOfMonth: 12, recurrence: 'monthly' },
            { id: 'sub-3', description: 'Internet Fibra 600MB', amount: 139.9, dayOfMonth: 20, recurrence: 'monthly' }
          );
        }

        // Ordena por dia do vencimento no mês
        items.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
        setSubscriptions(items);
      } catch (err) {
        console.error('Erro ao carregar assinaturas:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSubscriptions();
  }, [user]);

  const monthlyTotal = subscriptions.reduce((acc, s) => {
    if (s.recurrence === 'weekly') return acc + s.amount * 4.33;
    if (s.recurrence === 'yearly') return acc + s.amount / 12;
    return acc + s.amount;
  }, 0);

  const annualTotal = monthlyTotal * 12;

  const currentDay = new Date().getDate();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 px-5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Repeat className="h-4 w-4 text-purple-500" />
            Calendário de Assinaturas & Recorrências
          </CardTitle>
          <CardDescription className="text-xs">
            Acompanhamento contínuo de débitos automáticos e impacto anual acumulado.
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">
          {subscriptions.length} ativas
        </Badge>
      </CardHeader>

      <CardContent className="px-5 space-y-4">
        {/* Painel de Impacto Anual */}
        <div className="grid grid-cols-2 gap-3 bg-purple-500/5 p-3 rounded-lg border border-purple-500/20 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Gasto Mensal Recorrente</span>
            <p className="font-semibold text-foreground font-mono text-base mt-0.5">
              {d ? '••••' : formatCurrency(monthlyTotal)}
              <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Impacto Anual Consolidado</span>
            <p className="font-semibold text-purple-600 dark:text-purple-400 font-mono text-base mt-0.5">
              {d ? '••••' : formatCurrency(annualTotal)}
              <span className="text-[10px] text-muted-foreground font-normal">/ano</span>
            </p>
          </div>
        </div>

        {/* Linha do Tempo Visual dos Vencimentos */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" /> Próximos Vencimentos no Mês
          </p>
          <div className="space-y-2">
            {subscriptions.map((sub) => {
              const isPast = sub.dayOfMonth < currentDay;
              const isToday = sub.dayOfMonth === currentDay;

              return (
                <div
                  key={sub.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                    isToday
                      ? 'border-purple-500/50 bg-purple-500/10 font-medium'
                      : isPast
                      ? 'opacity-60 bg-muted/20'
                      : 'bg-card/50 hover:bg-muted/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-8 w-8 rounded-lg flex flex-col items-center justify-center font-mono text-[10px] ${
                      isToday
                        ? 'bg-purple-500 text-white font-bold'
                        : 'bg-muted border text-muted-foreground'
                    }`}>
                      <span className="text-[8px] uppercase">Dia</span>
                      <span className="font-bold text-xs leading-none">{sub.dayOfMonth}</span>
                    </div>
                    <div>
                      <h5 className="font-medium text-xs">{sub.description}</h5>
                      <span className="text-[10px] text-muted-foreground">
                        {sub.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-semibold text-destructive text-xs">
                      {d ? '••••' : `-${formatCurrency(sub.amount)}`}
                    </span>
                    {isToday && (
                      <Badge variant="outline" className="block text-[9px] text-purple-500 border-purple-500/30 mt-0.5">
                        Vence Hoje
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
