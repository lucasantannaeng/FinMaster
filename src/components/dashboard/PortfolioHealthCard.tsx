import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield, AlertTriangle, CheckCircle, Settings2, Landmark, Bot } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { useAppSettings } from '@/hooks/useAppSettings';
import { formatCurrency } from '@/lib/format';

interface CryptoAsset {
  currency: string;
  equity: number;
  priceUsdt: number;
  valueBrl: number;
}

interface OkxData {
  totalEquity: number;
  totalBrl: number;
  assets: CryptoAsset[];
}

const formatPct = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const formatCryptoVal = (v: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(v);

const COLORS = ['hsl(215, 60%, 60%)', 'hsl(27, 95%, 60%)'];

interface Props {
  fiatBalance: number;
  cryptoData: OkxData | null;
  cryptoBalanceBrl: number;
  onOpenConsultant?: () => void;
}

const PortfolioHealthCard = ({ fiatBalance, cryptoData, cryptoBalanceBrl, onOpenConsultant }: Props) => {
  const { discreteMode } = useAppSettings();
  const d = discreteMode;
  const [ethLimit, setEthLimit] = useState(() => {
    const saved = localStorage.getItem('eth_exposure_limit');
    return saved ? Number(saved) : 30;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('eth_exposure_limit', String(ethLimit));
  }, [ethLimit]);

  // --- Allocation data (always shown) ---
  const total = fiatBalance + cryptoBalanceBrl;
  const allocationData = [
    { name: 'Fiat (BRL)', value: fiatBalance },
    { name: 'Criptoativos', value: cryptoBalanceBrl },
  ].filter(item => item.value > 0);

  // --- ETH health data (only if crypto data available) ---
  const ethAsset = cryptoData?.assets.find(a => a.currency === 'ETH');
  const hasEthHealth = !!cryptoData && cryptoData.assets.length > 0 && !!ethAsset;

  let ethExposure = 0;
  let ethExposureTotal = 0;
  let isOverLimit = false;
  let healthScore = 100;
  let ethValueUsdt = 0;
  let totalPatrimonioUsdt = 0;

  if (hasEthHealth && ethAsset && cryptoData) {
    totalPatrimonioUsdt = cryptoData.totalEquity;
    ethValueUsdt = ethAsset.equity * ethAsset.priceUsdt;
    ethExposure = totalPatrimonioUsdt > 0 ? (ethValueUsdt / totalPatrimonioUsdt) * 100 : 0;
    ethExposureTotal = total > 0 ? (ethAsset.valueBrl / total) * 100 : 0;
    isOverLimit = ethExposure > ethLimit;
    healthScore = isOverLimit ? Math.max(0, 100 - ((ethExposure - ethLimit) * 3)) : 100;
  }

  const healthColor = healthScore >= 80 ? 'text-primary' : healthScore >= 50 ? 'text-chart-2' : 'text-destructive';
  const healthBg = healthScore >= 80 ? 'bg-primary/10' : healthScore >= 50 ? 'bg-chart-2/10' : 'bg-destructive/10';

  if (total <= 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          Alocação & Saúde do Portfólio
          <InfoButton helpId="portfolio-health" />
        </CardTitle>
        <div className="flex items-center gap-2">
          {hasEthHealth && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(!showSettings)}>
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {hasEthHealth && (
            <Badge variant="secondary" className={`text-[10px] font-semibold gap-1 ${healthBg} ${healthColor} border-0`}>
              {healthScore >= 80 ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {d ? '••••' : `${healthScore.toFixed(0)}%`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 space-y-4">
        {/* ── Allocation Pie ── */}
        <div className="flex items-center gap-5">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {allocationData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v, d)}
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
            {allocationData.map((item, i) => {
              const pct = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground text-xs">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-xs font-mono">{formatCurrency(item.value, d)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{d ? '••' : `${pct}%`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ETH Health Section ── */}
        {hasEthHealth && ethAsset && (
          <>
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Exposição ETH</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">No Cripto</p>
                  <p className={`text-lg font-bold font-mono tabular-nums ${isOverLimit ? 'text-destructive' : 'text-foreground'}`}>
                    {d ? '••••' : `${formatPct(ethExposure)}%`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">No Total</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                    {d ? '••••' : `${formatPct(ethExposureTotal)}%`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span className="font-mono">{d ? '••••' : `${formatCryptoVal(ethAsset.equity)} ETH`}</span>
                <span className="font-mono">{d ? '••••' : `$${ethAsset.priceUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</span>
              </div>

              {/* Progress bar */}
              <div className="relative mt-3">
                <div className="h-2.5 rounded-full bg-secondary/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isOverLimit ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${Math.min(ethExposure, 100)}%` }}
                  />
                </div>
                <div className="absolute top-0 h-2.5 w-0.5 bg-foreground/50 rounded-full" style={{ left: `${Math.min(ethLimit, 100)}%` }} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">0%</span>
                  <span className="text-[10px] text-muted-foreground font-medium">Limite: {ethLimit}%</span>
                  <span className="text-[10px] text-muted-foreground">100%</span>
                </div>
              </div>
            </div>

            {/* Settings */}
            {showSettings && (
              <div className="p-3 rounded-lg bg-secondary/10 space-y-3">
                <p className="text-xs font-medium text-foreground">Limite de Exposição ETH</p>
                <Slider value={[ethLimit]} onValueChange={(v) => setEthLimit(v[0])} min={5} max={80} step={5} className="w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>5%</span>
                  <span className="font-semibold text-foreground">{ethLimit}%</span>
                  <span>80%</span>
                </div>
              </div>
            )}

            {/* Alert */}
            {isOverLimit && (
              <Alert className="border-chart-2/30 bg-chart-2/5">
                <AlertTriangle className="h-4 w-4 text-chart-2" />
                <AlertDescription className="text-xs text-foreground">
                  <strong>Exposição em ETH acima do limite.</strong> Deseja rebalancear para proteger seu lucro?
                </AlertDescription>
              </Alert>
            )}

            {isOverLimit && onOpenConsultant && (
              <Button variant="outline" size="sm" className="text-xs w-full gap-2" onClick={onOpenConsultant}>
                <Bot className="h-3.5 w-3.5" />
                Consultar IA sobre estratégias de proteção
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(PortfolioHealthCard);
