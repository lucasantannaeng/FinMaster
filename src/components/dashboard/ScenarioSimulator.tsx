import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { FlaskConical, TrendingUp, TrendingDown } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { useAppSettings } from '@/hooks/useAppSettings';

const formatCrypto5 = (v: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(v);

const formatUsdt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

interface CryptoAsset {
  currency: string;
  equity: number;
  priceUsdt: number;
  valueBrl: number;
}

interface OkxData {
  totalEquity: number;
  totalBrl: number;
  usdBrl: number;
  assets: CryptoAsset[];
}

interface Props {
  cryptoData: OkxData | null;
  fiatBalance: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialSavings?: number; // from savings challenge
}

const SCENARIOS = [-20, -10, 0, 10, 20];

const ScenarioSimulator = ({ cryptoData, fiatBalance, open, onOpenChange, initialSavings }: Props) => {
  const { discreteMode } = useAppSettings();
  const [customVariation, setCustomVariation] = useState(0);
  const [dcaAmount, setDcaAmount] = useState(initialSavings || 0);

  const ethAsset = cryptoData?.assets.find(a => a.currency === 'ETH');

  const scenarioData = useMemo(() => {
    if (!ethAsset || !cryptoData) return [];

    const usdBrl = cryptoData.usdBrl || 5.0;
    const currentPrice = ethAsset.priceUsdt;
    const currentEquity = ethAsset.equity;
    const otherAssetsUsdt = cryptoData.totalEquity - (currentEquity * currentPrice);

    // DCA extra in ETH from BRL
    const dcaEthExtra = dcaAmount > 0 ? (dcaAmount / usdBrl) / currentPrice : 0;
    const totalEth = currentEquity + dcaEthExtra;

    return SCENARIOS.map(pct => {
      const simPrice = currentPrice * (1 + pct / 100);
      const simEthValue = totalEth * simPrice;
      const simTotal = simEthValue + otherAssetsUsdt + (fiatBalance / usdBrl);
      const currentTotal = cryptoData.totalEquity + (fiatBalance / usdBrl);
      const pnl = simTotal - currentTotal;

      return {
        label: pct === 0 ? 'Hoje' : `${pct > 0 ? '+' : ''}${pct}%`,
        pct,
        ethPrice: simPrice,
        ethValue: simEthValue,
        totalUsdt: simTotal,
        pnl,
        pnlBrl: pnl * usdBrl,
      };
    });
  }, [ethAsset, cryptoData, fiatBalance, dcaAmount]);

  // Custom scenario
  const customScenario = useMemo(() => {
    if (!ethAsset || !cryptoData) return null;
    const usdBrl = cryptoData.usdBrl || 5.0;
    const currentPrice = ethAsset.priceUsdt;
    const dcaEthExtra = dcaAmount > 0 ? (dcaAmount / usdBrl) / currentPrice : 0;
    const totalEth = ethAsset.equity + dcaEthExtra;
    const simPrice = currentPrice * (1 + customVariation / 100);
    const simEthValue = totalEth * simPrice;
    const otherAssetsUsdt = cryptoData.totalEquity - (ethAsset.equity * currentPrice);
    const simTotal = simEthValue + otherAssetsUsdt + (fiatBalance / usdBrl);
    const currentTotal = cryptoData.totalEquity + (fiatBalance / usdBrl);
    const pnl = simTotal - currentTotal;
    return { simPrice, simTotal, pnl, pnlBrl: pnl * usdBrl, totalEth };
  }, [ethAsset, cryptoData, fiatBalance, customVariation, dcaAmount]);

  if (!cryptoData || !ethAsset) return null;

  const content = (
    <div className="space-y-5">
      {/* Current state */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-secondary/10">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">ETH Atual</p>
          <p className="text-sm font-bold font-mono">
            {discreteMode ? '••••' : formatCrypto5(ethAsset.equity)}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            @ {discreteMode ? '••••' : `$${ethAsset.priceUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/10">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Patrimônio USDT</p>
          <p className="text-sm font-bold font-mono">
            {discreteMode ? '••••' : formatUsdt(cryptoData.totalEquity)}
          </p>
        </div>
      </div>

      {/* DCA input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Simular Aporte DCA (BRL)</p>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {discreteMode ? '••••' : `R$ ${dcaAmount.toFixed(2)}`}
          </Badge>
        </div>
        <Slider
          value={[dcaAmount]}
          onValueChange={(v) => setDcaAmount(v[0])}
          min={0}
          max={5000}
          step={50}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>R$ 0</span>
          <span>R$ 5.000</span>
        </div>
      </div>

      {/* Custom slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Variação Personalizada</p>
          <Badge
            variant="secondary"
            className={`text-[10px] font-mono ${
              customVariation > 0 ? 'text-primary' : customVariation < 0 ? 'text-destructive' : ''
            }`}
          >
            {customVariation > 0 ? '+' : ''}{customVariation}%
          </Badge>
        </div>
        <Slider
          value={[customVariation]}
          onValueChange={(v) => setCustomVariation(v[0])}
          min={-50}
          max={50}
          step={1}
          className="w-full"
        />
        {customScenario && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/10">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">ETH Simulado</p>
              <p className="text-xs font-bold font-mono">
                {discreteMode ? '••••' : `$${formatCrypto5(customScenario.simPrice)}`}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">PnL Projetado</p>
              <p className={`text-xs font-bold font-mono ${customScenario.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {discreteMode ? '••••' : `${customScenario.pnl >= 0 ? '+' : ''}${formatUsdt(customScenario.pnl)}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scenario comparison chart */}
      <div>
        <p className="text-xs font-medium text-foreground mb-3">PnL Projetado por Cenário</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scenarioData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                formatter={(value: number) => [formatUsdt(value), 'PnL']}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} barSize={32}>
                {scenarioData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.pnl >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-secondary/10">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cenário</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">ETH Price</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">PnL (USDT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scenarioData.map((s, i) => (
              <tr key={i} className={s.pct === 0 ? 'bg-secondary/5' : ''}>
                <td className="px-3 py-2 font-medium">{s.label}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {discreteMode ? '••••' : `$${formatCrypto5(s.ethPrice)}`}
                </td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${
                  s.pnl >= 0 ? 'text-primary' : 'text-destructive'
                }`}>
                  {discreteMode ? '••••' : `${s.pnl >= 0 ? '+' : ''}${formatUsdt(s.pnl)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // If controlled open/close
  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" />
              Simulador de Futuro
            </DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Standalone card with dialog trigger
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="py-4 px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-chart-1/10 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">Simulador de Cenários <InfoButton helpId="scenario-simulator" /></p>
                <p className="text-[11px] text-muted-foreground">Stress Test DCA · ETH</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Abrir →
            </Badge>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            Simulador de Futuro
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default ScenarioSimulator;
