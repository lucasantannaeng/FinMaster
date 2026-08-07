import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/format';
import InfoButton from '@/components/InfoButton';

const CHART_COLORS = [
  'hsl(27, 95%, 60%)',
  'hsl(43, 96%, 56%)',
  'hsl(160, 60%, 45%)',
  'hsl(215, 60%, 60%)',
  'hsl(340, 65%, 55%)',
  'hsl(0, 0%, 55%)',
];

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: CategoryData[];
}

const ExpenseByCategoryChart = ({ data }: Props) => {
  if (data.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Despesas por Categoria
          <InfoButton helpId="expense-by-category" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <div className="flex items-center gap-5">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={50}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate max-w-[100px] text-xs">{cat.name}</span>
                </div>
                <span className="font-semibold text-xs font-mono">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(ExpenseByCategoryChart);
