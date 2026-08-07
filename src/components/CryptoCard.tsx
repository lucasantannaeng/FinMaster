import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { formatCurrency } from '@/lib/format';

interface CryptoAsset {
  currency: string;
  equity: number;
  availableBalance: number;
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

const formatCrypto = (value: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(value);

const formatUsdt = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

const CryptoCard = () => {
  const { discreteMode } = useAppSettings();
  const [data, setData] = useState<OkxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const d = discreteMode;

  const fetchBalance = useCallback(async (isSync = false) => {
    if (isSync) setSyncing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('get-okx-balance');
      if (fnError) throw fnError;
      if (!result || typeof result !== 'object') {
        throw new Error('Saldo indisponível no momento');
      }
      if (result.error) throw new Error(result.details || result.error);

      // Defensive normalization — never trust remote shape
      const safe: OkxData = {
        totalEquity: Number(result.totalEquity) || 0,
        totalBrl: Number(result.totalBrl) || 0,
        usdBrl: Number(result.usdBrl) || 0,
        assets: Array.isArray(result.assets)
          ? result.assets.map((a: any) => ({
              currency: String(a?.currency ?? '—'),
              equity: Number(a?.equity) || 0,
              availableBalance: Number(a?.availableBalance) || 0,
              priceUsdt: Number(a?.priceUsdt) || 0,
              change24h: Number(a?.change24h) || 0,
              valueBrl: Number(a?.valueBrl) || 0,
            }))
          : [],
      };
      setData(safe);
    } catch (err: any) {
      console.error('[CryptoCard] Falha ao carregar saldo OKX:', err);
      setError('Saldo cripto indisponível no momento');
      setData(null);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5"><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent className="px-5 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
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
          <Button variant="outline" size="sm" onClick={() => fetchBalance()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-6 px-5 flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Saldo indisponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          Investimentos em Cripto
          <InfoButton helpId="crypto-portfolio" />
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchBalance(true)} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Badge variant="secondary" className="text-[10px] font-medium gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            OKX
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-5">
        <div className="mb-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Patrimônio Total
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight">{d ? '••••' : formatUsdt(data.totalEquity)}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            ≈ {formatCurrency(data.totalBrl, d)}
          </p>
        </div>

        {data.assets.length > 0 && (
          <div className="space-y-0 divide-y divide-border">
            {data.assets.slice(0, 5).map((asset) => {
              const isPositive = asset.change24h > 0;
              const isNegative = asset.change24h < 0;
              return (
                <div key={asset.currency} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-secondary-foreground">
                        {asset.currency.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{asset.currency}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {d ? '••••' : `${formatCrypto(asset.equity)} · $${asset.priceUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold font-mono tabular-nums">
                      {formatCurrency(asset.valueBrl, d)}
                    </p>
                    <div className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${
                      isPositive ? 'text-primary' : isNegative ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      <span className="font-mono tabular-nums">{Math.abs(asset.change24h).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CryptoCard;
