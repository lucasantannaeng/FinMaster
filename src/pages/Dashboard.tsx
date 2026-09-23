import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate, getBillingPeriod, getAssetConcentration } from '@/lib/format';
import { Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import CryptoCard from '@/components/CryptoCard';
import { fetchOkxBalance } from '@/lib/okx';

import ExpenseByCategoryChart from '@/components/dashboard/ExpenseByCategoryChart';
import AssetAllocationChart from '@/components/dashboard/AssetAllocationChart';
import BurnRateChart from '@/components/dashboard/BurnRateChart';
import PortfolioHealthCard from '@/components/dashboard/PortfolioHealthCard';
import ScenarioSimulator from '@/components/dashboard/ScenarioSimulator';
import SavingsChallengeCard from '@/components/dashboard/SavingsChallengeCard';
import AIConsultantDialog from '@/components/dashboard/AIConsultantDialog';
import SafeToSpendCard from '@/components/dashboard/SafeToSpendCard';
import CryptoRetirementSimulator from '@/components/dashboard/CryptoRetirementSimulator';
import { CashFlowForecastCard } from '@/components/dashboard/CashFlowForecastCard';
import { SinkingFundsCard } from '@/components/dashboard/SinkingFundsCard';
import { SubscriptionsCalendarCard } from '@/components/dashboard/SubscriptionsCalendarCard';

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

const Dashboard = () => {
  const { user } = useAuth();
  const { discreteMode } = useAppSettings();
  const navigate = useNavigate();

  // Simulator & Consultant UI state
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorSavings, setSimulatorSavings] = useState(0);
  const [consultantOpen, setConsultantOpen] = useState(false);
  const [consultantInitialMsg, setConsultantInitialMsg] = useState<string | undefined>();

  const d = discreteMode;

  const { data: dashboardData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-data', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Não autenticado');

      const [accountsRes, cardsRes, profileRes] = await Promise.all([
        supabase.from('accounts').select('balance'),
        supabase.from('credit_cards').select('id, closing_day'),
        supabase.from('profiles').select('monthly_income').eq('user_id', user.id).single(),
      ]);

      const totalBalance = accountsRes.data?.reduce((sum, a) => sum + Number(a.balance), 0) || 0;
      const monthlyIncome = Number(profileRes.data?.monthly_income || 0);

      let totalBill = 0;
      const cards = cardsRes.data || [];
      if (cards.length > 0) {
        // Query em lote único para eliminar padrão N+1
        const periods = cards.map(c => ({ id: c.id, ...getBillingPeriod(c.closing_day) }));
        const minStartDate = periods.reduce((min, p) => p.startDate < min ? p.startDate : min, periods[0].startDate);
        const maxEndDate = periods.reduce((max, p) => p.endDate > max ? p.endDate : max, periods[0].endDate);

        const { data: allCardTxs } = await supabase
          .from('transactions')
          .select('card_id, amount, date')
          .in('card_id', cards.map(c => c.id))
          .eq('type', 'expense')
          .gte('date', minStartDate.toISOString().split('T')[0])
          .lte('date', maxEndDate.toISOString().split('T')[0]);

        if (allCardTxs) {
          for (const p of periods) {
            const startStr = p.startDate.toISOString().split('T')[0];
            const endStr = p.endDate.toISOString().split('T')[0];
            const cardTotal = allCardTxs
              .filter(t => t.card_id === p.id && t.date >= startStr && t.date <= endStr)
              .reduce((sum, t) => sum + Number(t.amount), 0);
            totalBill += cardTotal;
          }
        }
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: monthTxs } = await supabase
        .from('transactions')
        .select('amount, type, category_id')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      const monthIncome = monthTxs?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0;
      const monthExpense = monthTxs?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) || 0;

      const { data: categories } = await supabase.from('categories').select('id, name, color');
      const catMap = new Map(categories?.map(c => [c.id, c]) || []);
      const catTotals = new Map<string, { name: string; value: number; color: string }>();
      monthTxs?.filter(t => t.type === 'expense' && t.category_id).forEach(t => {
        const cat = catMap.get(t.category_id);
        if (cat) {
          const existing = catTotals.get(cat.id) || { name: cat.name, value: 0, color: cat.color };
          existing.value += Number(t.amount);
          catTotals.set(cat.id, existing);
        }
      });
      const expensesByCategory = Array.from(catTotals.values()).sort((a, b) => b.value - a.value).slice(0, 6);

      const { data: recent } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);

      const { data: allTxs } = await supabase
        .from('transactions')
        .select('date, amount, type, description, is_paid, recurrence')
        .order('date', { ascending: true });

      let cryptoBrl = 0;
      let cryptoData: OkxData | null = null;
      try {
        const { data: cryptoResult } = await fetchOkxBalance();
        if (cryptoResult?.totalBrl) {
          cryptoBrl = cryptoResult.totalBrl;
          cryptoData = cryptoResult;
        }
      } catch { /* ignore */ }

      return {
        totalBalance,
        currentBill: totalBill,
        monthIncome,
        monthExpense,
        monthlyIncome,
        expensesByCategory,
        recentTransactions: recent || [],
        allTransactions: allTxs || [],
        cryptoBrl,
        cryptoData,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutos de cache
  });

  const totalBalance = dashboardData?.totalBalance || 0;
  const currentBill = dashboardData?.currentBill || 0;
  const monthIncome = dashboardData?.monthIncome || 0;
  const monthExpense = dashboardData?.monthExpense || 0;
  const monthlyIncome = dashboardData?.monthlyIncome || 0;
  const recentTransactions = dashboardData?.recentTransactions || [];
  const allTransactions = dashboardData?.allTransactions || [];
  const expensesByCategory = dashboardData?.expensesByCategory || [];
  const cryptoBrl = dashboardData?.cryptoBrl || 0;
  const cryptoData = dashboardData?.cryptoData || null;

  const handleSimulateDCA = (amount: number) => {
    setSimulatorSavings(amount);
    setSimulatorOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-pulse text-muted-foreground font-medium">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-3 pb-1">
        <div>
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Visão Geral</p>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="rounded-full h-10 w-10"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="icon"
            className="rounded-full h-10 w-10 shadow-md"
            onClick={() => navigate('/transactions?new=true')}
            aria-label="Nova transação"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Safe-to-Spend */}
      <SafeToSpendCard
        monthlyIncome={monthlyIncome}
        monthExpense={monthExpense}
        cryptoMonthlyDca={0}
      />

      {/* Balance Card */}
      <Card className="bg-primary text-primary-foreground border-0 shadow-lg overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <CardContent className="pt-6 pb-6 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 opacity-70" />
           <span className="text-xs font-medium opacity-70 uppercase tracking-wider">Saldo Total</span>
           <InfoButton helpId="total-balance" className="opacity-70 hover:opacity-100" />
          </div>
          <p className="text-4xl font-bold tracking-tight font-mono">{formatCurrency(totalBalance, d)}</p>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="flex items-center gap-2.5 bg-primary-foreground/10 rounded-xl px-3 py-2.5">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium opacity-60 uppercase tracking-wider">Receitas</p>
                <p className="text-sm font-bold font-mono">{formatCurrency(monthIncome, d)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-primary-foreground/10 rounded-xl px-3 py-2.5">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <ArrowDownRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium opacity-60 uppercase tracking-wider">Despesas</p>
                <p className="text-sm font-bold font-mono">{formatCurrency(monthExpense, d)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Card Bill */}
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-between py-4 px-5">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">Fatura Atual <InfoButton helpId="credit-card-bill" /></p>
              <p className="font-bold text-lg font-mono tracking-tight">{formatCurrency(currentBill, d)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs font-medium" onClick={() => navigate('/cards')}>
            Ver →
          </Button>
        </CardContent>
      </Card>

      {/* Expenses by Category */}
      <ExpenseByCategoryChart data={expensesByCategory} />

      {/* Burn Rate */}
      <BurnRateChart
        monthlyIncome={monthlyIncome}
        totalExpense={monthExpense}
        topCategories={expensesByCategory}
      />

      {/* Projeção de Fluxo de Caixa (13 Semanas / 60 Dias) */}
      <CashFlowForecastCard
        initialBalance={totalBalance}
        transactions={allTransactions}
      />

      {/* Crypto Investments */}
      <CryptoCard />

      {/* Portfolio Health & Rebalancing (merged with Asset Allocation) */}
      <PortfolioHealthCard
        fiatBalance={totalBalance}
        cryptoData={cryptoData}
        cryptoBalanceBrl={cryptoBrl}
        onOpenConsultant={() => {
          setConsultantInitialMsg('Minha exposição em ETH está acima do limite que defini. Quais estratégias de proteção você sugere para o meu portfólio atual?');
          setConsultantOpen(true);
        }}
      />

      {/* AI Consultant Dialog */}
      <AIConsultantDialog
        open={consultantOpen}
        onOpenChange={setConsultantOpen}
        initialMessage={consultantInitialMsg}
        portfolioContext={{
          fiatBalance: totalBalance,
          totalEquityUsdt: cryptoData?.totalEquity || 0,
          totalCryptoBrl: cryptoBrl,
          totalPatrimonyBrl: totalBalance + cryptoBrl,
          assets: cryptoData?.assets.map(a => ({
            currency: a.currency,
            equity: a.equity,
            priceUsdt: a.priceUsdt,
            valueBrl: a.valueBrl,
            change24h: a.change24h,
          })) || [],
          ethExposure: (() => {
            const eth = cryptoData?.assets.find(a => a.currency === 'ETH');
            if (!eth || !cryptoData?.totalEquity) return 0;
            return ((eth.equity * eth.priceUsdt) / cryptoData.totalEquity) * 100;
          })(),
          ethExposureTotal: (() => {
            const total = totalBalance + cryptoBrl;
            if (total <= 0) return 0;
            const eth = cryptoData?.assets.find(a => a.currency === 'ETH');
            return eth ? (eth.valueBrl / total) * 100 : 0;
          })(),
          ethLimit: Number(localStorage.getItem('eth_exposure_limit') || '30'),
          isOverLimit: (() => {
            const exposure = getAssetConcentration(cryptoData?.assets, 'ETH', cryptoData?.totalEquity || 0);
            return exposure > Number(localStorage.getItem('eth_exposure_limit') || '30');
          })(),
          monthlyIncome,
          monthExpense,
          totalCardDebt: totalBill,
          burnRateMonths: monthExpense > 0 ? Math.round((totalBalance / monthExpense) * 10) / 10 : null,
          topExpenseCategories: expensesByCategory.map(c => ({
            category: c.name,
            amount: c.value,
            percent: monthExpense > 0 ? Math.round((c.value / monthExpense) * 100) : 0,
          })),
        }}
      />

      {/* Scenario Simulator Modal & Trigger */}
      <ScenarioSimulator
        cryptoData={cryptoData}
        fiatBalance={totalBalance}
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        initialSavings={simulatorSavings}
      />

      {/* Savings Challenge (AI Coach) */}
      <SavingsChallengeCard
        monthlyIncome={monthlyIncome}
        monthExpense={monthExpense}
        onSimulateDCA={handleSimulateDCA}
      />

      {/* Crypto Retirement Simulator */}
      <CryptoRetirementSimulator
        currentBalanceUsdt={cryptoData?.totalEquity || 0}
        assets={cryptoData?.assets || []}
        monthlyDcaUsdt={50}
        usdBrl={cryptoData?.usdBrl || 5}
      />

      {/* Potes de Metas & Reservas (Sinking Funds) */}
      <SinkingFundsCard />

      {/* Calendário de Assinaturas & Recorrências */}
      <SubscriptionsCalendarCard />

      {/* Recent Transactions */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">Últimas Transações <InfoButton helpId="recent-transactions" /></CardTitle>
          <Button variant="ghost" size="sm" className="text-xs font-medium" onClick={() => navigate('/transactions')}>
            Ver todas →
          </Button>
        </CardHeader>
        <CardContent className="px-5 divide-y divide-border">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma transação ainda
            </p>
          ) : (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.type === 'income' ? 'bg-primary/10' : 'bg-destructive/10'
                  }`}>
                    {tx.type === 'income'
                      ? <ArrowUpRight className="h-4 w-4 text-primary" />
                      : <ArrowDownRight className="h-4 w-4 text-destructive" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(tx.date)}</p>
                  </div>
                </div>
                <span
                  className={`text-sm font-bold font-mono tabular-nums ${
                    tx.type === 'income' ? 'text-primary' : 'text-destructive'
                  }`}
                >
                  {d ? '••••' : `${tx.type === 'income' ? '+' : '-'}${formatCurrency(Number(tx.amount))}`}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
