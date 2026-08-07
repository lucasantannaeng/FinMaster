import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { Flame } from 'lucide-react';
import InfoButton from '@/components/InfoButton';

interface CategoryExpense {
  name: string;
  value: number;
  color: string;
}

interface Props {
  monthlyIncome: number;
  totalExpense: number;
  topCategories: CategoryExpense[];
}

const BurnRateChart = ({ monthlyIncome, totalExpense, topCategories }: Props) => {
  if (monthlyIncome <= 0 && totalExpense <= 0) return null;

  const data = topCategories.slice(0, 5).map(c => ({
    name: c.name.length > 10 ? c.name.slice(0, 10) + '…' : c.name,
    gastos: c.value,
  }));

  const burnPct = monthlyIncome > 0 ? ((totalExpense / monthlyIncome) * 100).toFixed(0) : '—';
  const remaining = Math.max(monthlyIncome - totalExpense, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          Burn Rate vs. Renda
          <InfoButton helpId="burn-rate" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Renda</p>
            <p className="text-sm font-bold font-mono">{formatCurrency(monthlyIncome)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gastos</p>
            <p className="text-sm font-bold font-mono text-destructive">{formatCurrency(totalExpense)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Burn</p>
            <p className={`text-sm font-bold font-mono ${Number(burnPct) > 90 ? 'text-destructive' : 'text-primary'}`}>
              {burnPct}%
            </p>
          </div>
        </div>

        {/* Bar chart */}
        {data.length > 0 && (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={75}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="gastos" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Remaining */}
        {monthlyIncome > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Saldo disponível</span>
            <span className="text-sm font-bold font-mono text-primary">{formatCurrency(remaining)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(BurnRateChart);
