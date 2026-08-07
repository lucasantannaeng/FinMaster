import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { Landmark } from 'lucide-react';

interface Props {
  fiatBalance: number;
  cryptoBalanceBrl: number;
}

const COLORS = [
  'hsl(215, 60%, 60%)',
  'hsl(27, 95%, 60%)',
];

const AssetAllocationChart = ({ fiatBalance, cryptoBalanceBrl }: Props) => {
  const total = fiatBalance + cryptoBalanceBrl;
  if (total <= 0) return null;

  const data = [
    { name: 'Fiat (BRL)', value: fiatBalance },
    { name: 'Criptoativos', value: cryptoBalanceBrl },
  ].filter(d => d.value > 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          Alocação de Ativos
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
                  innerRadius={30}
                  outerRadius={50}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
          <div className="flex-1 space-y-3">
            {data.map((item, i) => {
              const pct = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground text-xs">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-xs font-mono">{formatCurrency(item.value)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetAllocationChart;
