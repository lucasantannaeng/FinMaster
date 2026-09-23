import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { generateCashFlowForecast } from '@/services/cashFlowForecastService';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppSettings } from '@/hooks/useAppSettings';
import { LineChart, AlertTriangle, TrendingUp, TrendingDown, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  initialBalance: number;
  transactions: Array<{
    date: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    description: string;
    is_paid?: boolean;
    recurrence?: string | null;
  }>;
}

export function CashFlowForecastCard({ initialBalance, transactions }: Props) {
  const { discreteMode } = useAppSettings();
  const d = discreteMode;

  const [daysHorizon, setDaysHorizon] = useState<30 | 60 | 90>(60);

  const forecast = useMemo(() => {
    return generateCashFlowForecast(initialBalance, transactions, daysHorizon);
  }, [initialBalance, transactions, daysHorizon]);

  // Reduz a quantidade de pontos exibidos no gráfico para manter alta performance
  const chartData = useMemo(() => {
    const step = daysHorizon === 90 ? 3 : daysHorizon === 60 ? 2 : 1;
    return forecast.days.filter((_, idx) => idx % step === 0 || idx === forecast.days.length - 1);
  }, [forecast, daysHorizon]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LineChart className="h-4 w-4 text-primary" />
            Projeção de Fluxo de Caixa ({daysHorizon} Dias)
          </CardTitle>
          <CardDescription className="text-xs">
            Evolução estimada da sua liquidez considerando receitas esperadas, contas fixas e parcelas.
          </CardDescription>
        </div>

        {/* Seletor de Horizonte Temporal */}
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border">
          {[30, 60, 90].map((h) => (
            <Button
              key={h}
              variant={daysHorizon === h ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setDaysHorizon(h as any)}
            >
              {h}d
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-5 space-y-4">
        {/* Painel de Métricas Principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30 p-2.5 rounded-lg border text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Saldo Inicial</span>
            <p className="font-semibold font-mono text-sm">
              {d ? '••••' : formatCurrency(forecast.currentBalance)}
            </p>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Saldo Final Projetado</span>
            <p className={`font-semibold font-mono text-sm ${forecast.finalBalance >= forecast.currentBalance ? 'text-emerald-500' : 'text-amber-500'}`}>
              {d ? '••••' : formatCurrency(forecast.finalBalance)}
            </p>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Menor Saldo Esperado</span>
            <p className={`font-semibold font-mono text-sm ${forecast.isAtRisk ? 'text-destructive font-bold' : 'text-foreground'}`}>
              {d ? '••••' : formatCurrency(forecast.lowestBalance)}
            </p>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase">Variação Líquida</span>
            <p className={`font-semibold font-mono text-sm flex items-center ${forecast.netChange >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              {forecast.netChange >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" /> : <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />}
              {d ? '••••' : formatCurrency(forecast.netChange)}
            </p>
          </div>
        </div>

        {/* Alerta de Risco de Liquidez */}
        {forecast.isAtRisk && (
          <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Atenção:</strong> Sua projeção aponta saldo negativo em <strong>{formatDate(forecast.lowestBalanceDate)}</strong> ({formatCurrency(forecast.lowestBalance)}). Considere reprogramar despesas ou antecipar receitas.
            </span>
          </div>
        )}

        {/* Gráfico de Área com Recharts */}
        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={forecast.isAtRisk ? '#ef4444' : '#10b981'} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={forecast.isAtRisk ? '#ef4444' : '#10b981'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dayLabel" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => (d ? '••••' : `R$ ${Math.round(value / 1000)}k`)}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border text-popover-foreground text-xs p-2 rounded shadow-md space-y-1">
                        <p className="font-semibold">{formatDate(data.date)}</p>
                        <p className="font-mono text-primary">
                          Saldo: {d ? '••••' : formatCurrency(data.projectedBalance)}
                        </p>
                        {data.income > 0 && (
                          <p className="text-emerald-500 font-mono text-[11px]">
                            + Entradas: {formatCurrency(data.income)}
                          </p>
                        )}
                        {data.expense > 0 && (
                          <p className="text-destructive font-mono text-[11px]">
                            - Saídas: {formatCurrency(data.expense)}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="projectedBalance"
                stroke={forecast.isAtRisk ? '#ef4444' : '#10b981'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#forecastGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
