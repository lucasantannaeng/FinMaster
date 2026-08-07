import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { formatCurrency } from '@/lib/format';
import { ShieldCheck } from 'lucide-react';
import InfoButton from '@/components/InfoButton';

interface SafeToSpendCardProps {
  monthlyIncome: number;
  monthExpense: number;
  cryptoMonthlyDca?: number;
}

const SafeToSpendCard = ({ monthlyIncome, monthExpense, cryptoMonthlyDca = 0 }: SafeToSpendCardProps) => {
  const { user } = useAuth();
  const { discreteMode } = useAppSettings();
  const [budgetGoals, setBudgetGoals] = useState(0);

  useEffect(() => {
    if (!user) return;
    const loadBudgets = async () => {
      const { data: budgets } = await supabase
        .from('category_budgets')
        .select('percentage');
      const totalPct = budgets?.reduce((s, b) => s + Number(b.percentage), 0) || 0;
      setBudgetGoals((totalPct / 100) * monthlyIncome);
    };
    loadBudgets();
  }, [user, monthlyIncome]);

  const safeToSpend = Math.max(0, monthlyIncome - budgetGoals - cryptoMonthlyDca);
  const spent = monthExpense;
  const remaining = Math.max(0, safeToSpend - spent);
  const pct = safeToSpend > 0 ? Math.min(100, (spent / safeToSpend) * 100) : 0;
  const remainingPct = 100 - pct;

  // Gauge colors
  const gaugeColor = pct > 80 ? 'hsl(var(--destructive))' : pct > 50 ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))';

  // SVG gauge
  const radius = 70;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - remainingPct / 100);

  return (
    <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Disponível para Gastar
          </span>
          <InfoButton helpId="safe-to-spend" />
        </div>

        <div className="flex items-center gap-5">
          {/* Gauge */}
          <div className="relative shrink-0">
            <svg width="120" height="70" viewBox="0 0 160 90">
              {/* Background arc */}
              <path
                d="M 10 80 A 70 70 0 0 1 150 80"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Filled arc */}
              <path
                d="M 10 80 A 70 70 0 0 1 150 80"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={offset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-end justify-center pb-1">
              <span className="text-lg font-bold font-mono text-foreground">
                {discreteMode ? '••••' : `${Math.round(remainingPct)}%`}
              </span>
            </div>
          </div>

          {/* Values */}
          <div className="flex-1 space-y-1.5">
            <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {formatCurrency(remaining, discreteMode)}
            </p>
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">
                Orçamento: {formatCurrency(safeToSpend, discreteMode)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Gasto: {formatCurrency(spent, discreteMode)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(SafeToSpendCard);
