import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppSettings } from '@/hooks/useAppSettings';
import { TrendingUp } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CryptoAsset {
  currency: string;
  equity: number;
  priceUsdt: number;
}

interface CryptoRetirementSimulatorProps {
  currentBalanceUsdt: number;
  assets: CryptoAsset[];
  monthlyDcaUsdt: number;
  usdBrl: number;
}

const CryptoRetirementSimulator = ({
  currentBalanceUsdt,
  assets,
  monthlyDcaUsdt,
  usdBrl,
}: CryptoRetirementSimulatorProps) => {
  const { discreteMode } = useAppSettings();
  const [years, setYears] = useState(10);
  const [annualGrowth, setAnnualGrowth] = useState(15);

  // Filter out stablecoins and zero-value assets for selection
  const selectableAssets = useMemo(() => 
    assets.filter(a => a.equity > 0 && !['USDT', 'USDC', 'DAI', 'BUSD', 'BRL'].includes(a.currency)),
    [assets]
  );

  const [selectedCurrency, setSelectedCurrency] = useState(() => 
    selectableAssets[0]?.currency || 'ETH'
  );

  const selectedAsset = useMemo(() => 
    assets.find(a => a.currency === selectedCurrency) || { currency: selectedCurrency, equity: 0, priceUsdt: 0 },
    [assets, selectedCurrency]
  );

  const data = useMemo(() => {
    const points = [];
    const monthlyRate = Math.pow(1 + annualGrowth / 100, 1 / 12) - 1;
    let balance = currentBalanceUsdt;
    let cryptoBal = selectedAsset.equity;
    const cryptoPrice = selectedAsset.priceUsdt;

    for (let y = 0; y <= years; y++) {
      points.push({
        year: `Ano ${y}`,
        usdt: Math.round(balance * 100) / 100,
        brl: Math.round(balance * usdBrl * 100) / 100,
        crypto: parseFloat(cryptoBal.toFixed(5)),
      });
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyRate) + monthlyDcaUsdt;
        if (cryptoPrice > 0) {
          cryptoBal += monthlyDcaUsdt / cryptoPrice;
        }
      }
    }
    return points;
  }, [years, annualGrowth, currentBalanceUsdt, selectedAsset, monthlyDcaUsdt, usdBrl]);

  const finalUsdt = data[data.length - 1]?.usdt || 0;
  const finalBrl = data[data.length - 1]?.brl || 0;
  const finalCrypto = data[data.length - 1]?.crypto || 0;

  const formatVal = (v: number) => discreteMode ? '••••' : `$${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  const formatBrl = (v: number) => discreteMode ? '••••' : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Simulador de Aposentadoria Cripto
          <InfoButton helpId="crypto-retirement" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 space-y-4">
        {/* Asset selector */}
        {selectableAssets.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Ativo:</Label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableAssets.map(a => (
                  <SelectItem key={a.currency} value={a.currency} className="text-xs">
                    {a.currency} ({a.equity.toFixed(5)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Horizonte:</Label>
          <Tabs value={String(years)} onValueChange={(v) => setYears(Number(v))}>
            <TabsList className="h-8">
              {[5, 10, 15, 20].map(y => (
                <TabsTrigger key={y} value={String(y)} className="text-xs px-3 h-6">
                  {y}a
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Growth rate */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Valorização anual</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={annualGrowth}
                onChange={(e) => setAnnualGrowth(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-16 h-7 text-xs text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <Slider
            value={[annualGrowth]}
            onValueChange={([v]) => setAnnualGrowth(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="retirementGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                formatter={(v: number, name: string) => [
                  name === 'usdt' ? formatVal(v) : formatBrl(v),
                  name === 'usdt' ? 'USDT' : 'BRL',
                ]}
              />
              <Area
                type="monotone"
                dataKey="usdt"
                stroke="hsl(var(--primary))"
                fill="url(#retirementGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Results */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">USDT</p>
            <p className="text-sm font-bold font-mono">{formatVal(finalUsdt)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">BRL</p>
            <p className="text-sm font-bold font-mono">{formatBrl(finalBrl)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">{selectedCurrency}</p>
            <p className="text-sm font-bold font-mono">
              {discreteMode ? '••••' : finalCrypto.toFixed(5)}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Aporte mensal: {discreteMode ? '••••' : `$${monthlyDcaUsdt.toFixed(2)}`} · Taxa câmbio: 1 USD = R$ {usdBrl.toFixed(2)}
        </p>
      </CardContent>
    </Card>
  );
};

export default CryptoRetirementSimulator;
