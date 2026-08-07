import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/format';
import { Brain, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Deduction {
  transaction_id: string;
  description: string;
  amount: number;
  date: string;
  category_rf: string;
  confidence: string;
  rf_description: string;
}

interface DeductionAlert {
  transaction_id: string;
  description: string;
  amount: number;
  reason: string;
}

interface Props {
  year: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  saude: '🏥 Saúde',
  educacao: '📚 Educação',
  previdencia: '🏦 Previdência',
  pensao: '👨‍👩‍👧 Pensão Alimentícia',
  doacao: '🎁 Doações',
};

export default function AIDeductionsTab({ year }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [alerts, setAlerts] = useState<DeductionAlert[]>([]);
  const [summary, setSummary] = useState('');
  const [analyzed, setAnalyzed] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const runAnalysis = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-deductions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ year }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro de rede' }));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      setDeductions(data.deductions || []);
      setAlerts(data.alerts || []);
      setSummary(data.summary || '');
      setAnalyzed(true);
    } catch (e: any) {
      toast.error(e.message || 'Falha na análise');
    } finally {
      setLoading(false);
    }
  }, [user, year]);

  // Group deductions by RF category
  const grouped = useMemo(() => {
    const map = new Map<string, { items: Deduction[]; total: number }>();
    deductions.forEach(d => {
      const key = d.category_rf || 'outros';
      const g = map.get(key) || { items: [], total: 0 };
      g.items.push(d);
      g.total += d.amount;
      map.set(key, g);
    });
    return map;
  }, [deductions]);

  const totalDeductible = useMemo(() => deductions.reduce((s, d) => s + d.amount, 0), [deductions]);

  const copyForRF = () => {
    const lines = deductions.map(d => d.rf_description || `${d.date} - ${d.description} - R$ ${d.amount.toFixed(2)}`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Relatório copiado para a área de transferência!');
  };

  const formatDateBR = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  if (!analyzed) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Análise Inteligente de Deduções</h3>
            <p className="text-sm text-muted-foreground mt-1">
              A IA vai analisar todas as transações de {year} e identificar despesas dedutíveis para o IR.
            </p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analisando...' : 'Analisar Transações'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 px-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Resultado da Análise</span>
            </div>
            <Button variant="outline" size="sm" onClick={copyForRF} className="gap-1">
              <Copy className="h-3 w-3" /> Copiar para RF
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Total Dedutível</p>
              <p className="text-lg font-bold font-mono text-primary">{formatCurrency(totalDeductible)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Itens Encontrados</p>
              <p className="text-lg font-bold font-mono">{deductions.length}</p>
            </div>
          </div>
          {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
        </CardContent>
      </Card>

      {/* Grouped Deductions */}
      {Array.from(grouped.entries()).map(([cat, data]) => {
        const isOpen = openCategories[cat] ?? true;
        return (
          <Collapsible key={cat} open={isOpen} onOpenChange={() => setOpenCategories(p => ({ ...p, [cat]: !isOpen }))}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{CATEGORY_LABELS[cat] || cat}</span>
                      <Badge variant="secondary" className="text-[10px]">{data.items.length}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono">{formatCurrency(data.total)}</span>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pt-0 pb-3 space-y-1">
                  {data.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">{formatDateBR(item.date)}</span>
                        <span className="truncate">{item.description}</span>
                        <Badge variant={item.confidence === 'high' ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                          {item.confidence === 'high' ? '✓' : item.confidence === 'medium' ? '?' : '!'}
                        </Badge>
                      </div>
                      <span className="font-mono shrink-0 ml-2">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-chart-4/30">
          <CardHeader className="px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-chart-4" />
              <CardTitle className="text-sm font-semibold">Alertas de Dedução</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{alerts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-3 space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="text-xs p-2 rounded-lg bg-chart-4/5 border border-chart-4/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{alert.description}</span>
                  <span className="font-mono">{formatCurrency(alert.amount)}</span>
                </div>
                <p className="text-muted-foreground">{alert.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Reanalisar
      </Button>
    </div>
  );
}
