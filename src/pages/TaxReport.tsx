import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Brain, Coins, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/lib/validation';
import InfoButton from '@/components/InfoButton';
import OverviewTab from '@/components/tax/OverviewTab';
import AIDeductionsTab from '@/components/tax/AIDeductionsTab';
import CryptoAssetsTab from '@/components/tax/CryptoAssetsTab';
import OCRScannerTab from '@/components/tax/OCRScannerTab';

type CategoryInfo = { id: string; name: string; color: string | null; type: string };
type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  category_id: string | null;
  is_paid: boolean;
};

const TaxReport = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear - 1));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const years = useMemo(() => {
    const ys: string[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) ys.push(String(y));
    return ys;
  }, [currentYear]);

  const loadData = useCallback(async (signal: { cancelled: boolean }) => {
    setLoading(true);
    try {
      const [txRes, catRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, description, amount, date, type, category_id, is_paid')
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31`)
          .order('date', { ascending: true }),
        supabase.from('categories').select('id, name, color, type'),
      ]);
      if (signal.cancelled) return;
      setTransactions(txRes.data || []);
      setCategories(catRes.data || []);
    } catch (err: any) {
      if (!signal.cancelled) toast.error(getUserFriendlyError(err));
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (!user) return;
    const signal = { cancelled: false };
    loadData(signal);
    return () => { signal.cancelled = true; };
  }, [user, loadData]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Imposto de Renda</h1>
          <InfoButton helpId="tax-overview" />
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Ano-calendário:</span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="text-xs gap-1 py-2 flex-col sm:flex-row">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Visão Geral</span>
            <span className="sm:hidden">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="ai-deductions" className="text-xs gap-1 py-2 flex-col sm:flex-row">
            <Brain className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Deduções IA</span>
            <span className="sm:hidden">IA</span>
          </TabsTrigger>
          <TabsTrigger value="crypto" className="text-xs gap-1 py-2 flex-col sm:flex-row">
            <Coins className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criptoativos</span>
            <span className="sm:hidden">Cripto</span>
          </TabsTrigger>
          <TabsTrigger value="ocr" className="text-xs gap-1 py-2 flex-col sm:flex-row">
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Scanner OCR</span>
            <span className="sm:hidden">OCR</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab transactions={transactions} categories={categories} year={year} />
        </TabsContent>

        <TabsContent value="ai-deductions">
          <AIDeductionsTab year={year} />
        </TabsContent>

        <TabsContent value="crypto">
          <CryptoAssetsTab year={year} />
        </TabsContent>

        <TabsContent value="ocr">
          <OCRScannerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaxReport;
