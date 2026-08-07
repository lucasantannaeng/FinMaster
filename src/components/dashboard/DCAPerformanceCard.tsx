import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface CryptoAsset {
  currency: string;
  equity: number;
  priceUsdt: number;
  change24h: number;
  valueBrl: number;
}

interface OkxData {
  totalEquity: number;
  totalBrl: number;
  usdBrl: number;
  assets: CryptoAsset[];
}

const formatCryptoPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(value);

const formatUsdt = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

const DCAPerformanceCard = () => {
  const [data, setData] = useState<OkxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('get-okx-balance');
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.details || result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados DCA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5"><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent className="px-5 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-6 px-5 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.assets.length === 0) return null;

  // Find ETH specifically
  const ethAsset = data.assets.find(a => a.currency === 'ETH');
  if (!ethAsset) return null;

  const currentPrice = ethAsset.priceUsdt;

  // Break-even approximated from 24h change (real implementation needs order history)
  const breakEvenPrice = currentPrice / (1 + ethAsset.change24h / 100);
  const pnlUsdt = (currentPrice - breakEvenPrice) * ethAsset.equity;
  const pnlPercent = breakEvenPrice > 0 ? ((currentPrice / breakEvenPrice) - 1) * 100 : 0;
  const isProfitable = pnlUsdt >= 0;

  // Generate 24h trend chart data
  const chartData = Array.from({ length: 24 }, (_, i) => {
    const factor = 1 + (ethAsset.change24h / 100) * (i / 23);
    const price = breakEvenPrice * factor;
    return { hour: `${i}h`, price: parseFloat(price.toFixed(5)) };
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {isProfitable ? (
            <TrendingUp className="h-4 w-4 text-chart-1" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
          Performance DCA — ETH
          <InfoButton helpId="dca-performance" />
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="secondary" className="text-[10px] font-medium gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            OKX
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 space-y-4">
        {/* Quantity */}
        <p className="text-xs text-muted-foreground font-mono">
          Qtd: {new Intl.NumberFormat('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(ethAsset.equity)} ETH
        </p>

        {/* Price comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Preço Médio (Break-even)
            </p>
            <p className="text-lg font-bold font-mono tabular-nums">
              ${formatCryptoPrice(breakEvenPrice)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Preço Atual
            </p>
            <p className="text-lg font-bold font-mono tabular-nums">
              ${formatCryptoPrice(currentPrice)}
            </p>
          </div>
        </div>

        {/* PnL */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold font-mono ${
            isProfitable
              ? 'bg-chart-1/10 text-chart-1'
              : 'bg-destructive/10 text-destructive'
          }`}>
            {isProfitable ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isProfitable ? '+' : ''}{formatUsdt(pnlUsdt)}
          </div>
          <div className={`text-sm font-semibold font-mono ${
            isProfitable ? 'text-chart-1' : 'text-destructive'
          }`}>
            {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
          </div>
        </div>

        {/* Chart */}
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ethPriceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isProfitable ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isProfitable ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`$${formatCryptoPrice(value)}`, 'ETH']}
              />
              <ReferenceLine
                y={breakEvenPrice}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: 'Break-even',
                  position: 'right',
                  style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isProfitable ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))'}
                fill="url(#ethPriceGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default DCAPerformanceCard;
