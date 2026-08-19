import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { fetchOkxBalance } from '@/lib/okx';
import { Coins, AlertTriangle, Copy, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface CryptoAsset {
  currency: string;
  equity: number;
  priceUsdt: number;
  valueBrl: number;
  change24h: number;
}

interface OkxData {
  totalEquity: number;
  totalBrl: number;
  usdBrl: number;
  assets: CryptoAsset[];
}

interface Props {
  year: string;
}

const MONTHLY_EXEMPTION_LIMIT = 35000; // R$ 35.000 de isenção mensal para vendas de cripto

export default function CryptoAssetsTab({ year }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cryptoData, setCryptoData] = useState<OkxData | null>(null);

  const loadCrypto = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await fetchOkxBalance();
      if (error) throw error;
      if (!data || typeof data !== 'object' || data.error) {
        setCryptoData(null);
      } else {
        setCryptoData({
          totalEquity: Number(data.totalEquity) || 0,
          totalBrl: Number(data.totalBrl) || 0,
          usdBrl: Number(data.usdBrl) || 0,
          assets: Array.isArray(data.assets) ? data.assets : [],
        });
      }
    } catch (err) {
      console.error('[CryptoAssetsTab] OKX load failed:', err);
      setCryptoData(null);
      toast.error('Erro ao carregar dados OKX');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadCrypto(); }, [loadCrypto]);

  const generateRFDescription = (asset: CryptoAsset, usdBrl: number) => {
    const valueBrl = asset.equity * asset.priceUsdt * usdBrl;
    return `${asset.equity.toFixed(5)} unidades de ${asset.currency} custodiadas na exchange OKX (www.okx.com), adquiridas pelo custo médio aproximado de R$ ${(valueBrl / asset.equity).toFixed(2)} por unidade. Valor total em 31/12/${year}: R$ ${valueBrl.toFixed(2)}.`;
  };

  const copyAllDescriptions = () => {
    if (!cryptoData) return;
    const lines = cryptoData.assets
      .filter(a => a.valueBrl >= 1)
      .map(a => generateRFDescription(a, cryptoData.usdBrl));
    navigator.clipboard.writeText(lines.join('\n\n'));
    toast.success('Fichas copiadas para a área de transferência!');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!cryptoData || cryptoData.assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Coins className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum criptoativo encontrado na OKX.</p>
        </CardContent>
      </Card>
    );
  }

  const reportableAssets = cryptoData.assets.filter(a => a.valueBrl >= 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-1">Obrigatoriedade de Declaração</p>
            <p>Criptoativos com valor ≥ R$ 5.000 devem ser declarados na ficha "Bens e Direitos" (Grupo 08 - Criptoativos). Vendas mensais ≥ R$ {MONTHLY_EXEMPTION_LIMIT.toLocaleString('pt-BR')} estão sujeitas a GCAP.</p>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Patrimônio Cripto</p>
            <p className="text-lg font-bold font-mono text-primary">{formatCurrency(cryptoData.totalBrl)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ativos</p>
            <p className="text-lg font-bold font-mono">{reportableAssets.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Copy all */}
      <Button variant="outline" size="sm" onClick={copyAllDescriptions} className="w-full gap-2">
        <Copy className="h-4 w-4" /> Copiar Todas as Fichas para RF
      </Button>

      {/* Asset cards */}
      {reportableAssets.map(asset => {
        const needsDeclaration = asset.valueBrl >= 5000;
        return (
          <Card key={asset.currency} className={needsDeclaration ? 'border-primary/30' : ''}>
            <CardHeader className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{asset.currency}</span>
                  {needsDeclaration && <Badge className="text-[9px]">Declarar</Badge>}
                </div>
                <span className="text-sm font-bold font-mono">{formatCurrency(asset.valueBrl)}</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Quantidade:</span>
                  <span className="font-mono ml-1">{asset.equity.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço (USDT):</span>
                  <span className="font-mono ml-1">${asset.priceUsdt.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Custo médio aprox.:</span>
                  <span className="font-mono ml-1">{formatCurrency(asset.valueBrl / asset.equity)}/un</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Var. 24h:</span>
                  <span className={`font-mono ml-1 ${asset.change24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* RF Description */}
              <div className="bg-muted/30 rounded-lg p-2.5 text-xs">
                <p className="font-semibold mb-1 text-[10px] uppercase text-muted-foreground">Descrição para Bens e Direitos:</p>
                <p className="leading-relaxed">{generateRFDescription(asset, cryptoData.usdBrl)}</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(generateRFDescription(asset, cryptoData.usdBrl));
                  toast.success(`Ficha ${asset.currency} copiada!`);
                }}
              >
                <Copy className="h-3 w-3" /> Copiar Ficha
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* GCAP Alert */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-destructive">Alerta GCAP - Ganho de Capital</p>
              <p className="text-muted-foreground mt-1">
                Se o total de vendas de criptoativos em qualquer mês ultrapassar R$ {MONTHLY_EXEMPTION_LIMIT.toLocaleString('pt-BR')},
                o ganho de capital é tributável (15% a 22,5%). Use o programa GCAP da Receita Federal para calcular.
              </p>
              <p className="text-muted-foreground mt-1">
                <strong>Nota:</strong> O cálculo preciso do custo médio ponderado requer o histórico completo de compras.
                Os valores aqui mostrados usam o preço de mercado atual como aproximação.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" onClick={loadCrypto} disabled={loading} className="w-full gap-2">
        <RefreshCw className="h-4 w-4" /> Atualizar Saldos
      </Button>
    </div>
  );
}
