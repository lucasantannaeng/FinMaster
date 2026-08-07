import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Zap, ArrowRight, TrendingDown, FlaskConical } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { formatCurrency } from '@/lib/format';

interface SavingsOpportunity {
  categoryName: string;
  categoryColor: string;
  budgetBrl: number;
  spentBrl: number;
  savedBrl: number;
  percentage: number;
  proportionalBudget: number;
}

interface Props {
  monthlyIncome: number;
  monthExpense: number;
  onSimulateDCA?: (amount: number) => void;
}

const SavingsChallengeCard = ({ monthlyIncome, monthExpense, onSimulateDCA }: Props) => {
  const { user } = useAuth();
  const { discreteMode } = useAppSettings();
  const [opportunities, setOpportunities] = useState<SavingsOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || monthlyIncome <= 0) {
      setLoading(false);
      return;
    }

    try {
      // Get categories with budgets
      const { data: budgets } = await supabase
        .from('category_budgets')
        .select('category_id, percentage');

      if (!budgets || budgets.length === 0) {
        setLoading(false);
        return;
      }

      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, color, type')
        .eq('type', 'expense');

      const catMap = new Map(categories?.map(c => [c.id, c]) || []);

      // Get current month transactions
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: txs } = await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('type', 'expense')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      // Calculate spend per category
      const spendMap = new Map<string, number>();
      txs?.forEach(tx => {
        if (tx.category_id) {
          spendMap.set(tx.category_id, (spendMap.get(tx.category_id) || 0) + Number(tx.amount));
        }
      });

      // Day of month progress
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthProgress = dayOfMonth / daysInMonth;

      const opps: SavingsOpportunity[] = [];

      for (const budget of budgets) {
        const cat = catMap.get(budget.category_id);
        if (!cat) continue;

        const budgetBrl = (budget.percentage / 100) * monthlyIncome;
        const proportionalBudget = budgetBrl * monthProgress;
        const spent = spendMap.get(budget.category_id) || 0;
        const saved = proportionalBudget - spent;
        const savingsPct = proportionalBudget > 0 ? (saved / proportionalBudget) * 100 : 0;

        // Only show if saving >= 15% of proportional budget
        if (savingsPct >= 15 && saved > 0) {
          opps.push({
            categoryName: cat.name,
            categoryColor: cat.color || '#6366F1',
            budgetBrl,
            spentBrl: spent,
            savedBrl: saved,
            percentage: savingsPct,
            proportionalBudget,
          });
        }
      }

      setOpportunities(opps.sort((a, b) => b.savedBrl - a.savedBrl).slice(0, 3));
    } catch (err) {
      console.error('SavingsChallenge error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, monthlyIncome]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || opportunities.length === 0 || monthlyIncome <= 0) return null;

  const totalSavings = opportunities.reduce((s, o) => s + o.savedBrl, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-chart-2" />
          Desafio de Aporte
          <InfoButton helpId="savings-challenge" />
        </CardTitle>
        <Badge variant="secondary" className="text-[10px] font-medium bg-chart-2/10 text-chart-2 border-0">
          <Zap className="h-3 w-3 mr-0.5" />
          AI Coach
        </Badge>
      </CardHeader>
      <CardContent className="px-5 space-y-3">
        {opportunities.map((opp, i) => (
          <div key={i} className="p-3 rounded-lg bg-secondary/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: opp.categoryColor }}
                />
                <span className="text-xs font-medium text-foreground">{opp.categoryName}</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30">
                <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                {discreteMode ? '••••' : `-${opp.percentage.toFixed(0)}%`}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {discreteMode ? (
                'Economia detectada! ••••'
              ) : (
                <>
                  Economia detectada! Você gastou{' '}
                  <strong className="text-primary">{formatCurrency(opp.savedBrl)}</strong>{' '}
                  a menos do que o planejado em <strong>{opp.categoryName}</strong>.
                </>
              )}
            </p>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>Meta proporcional: {discreteMode ? '••••' : formatCurrency(opp.proportionalBudget)}</span>
              <span>Gasto: {discreteMode ? '••••' : formatCurrency(opp.spentBrl)}</span>
            </div>
          </div>
        ))}

        {/* Total savings + CTA */}
        <Alert className="border-primary/20 bg-primary/5">
          <Zap className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs text-foreground">
            {discreteMode ? (
              'Economia total detectada: ••••'
            ) : (
              <>
                Economia total detectada:{' '}
                <strong className="text-primary">{formatCurrency(totalSavings)}</strong>.
                Deseja transferir este valor para sua estratégia de DCA na OKX?
              </>
            )}
          </AlertDescription>
        </Alert>

        {onSimulateDCA && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-2"
            onClick={() => onSimulateDCA(totalSavings)}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Sim, simular aporte de {discreteMode ? '••••' : formatCurrency(totalSavings)}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default SavingsChallengeCard;
