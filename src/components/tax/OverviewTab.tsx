import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/format';
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

interface GroupedSection {
  label: string;
  total: number;
  items: { description: string; date: string; amount: number; category: string }[];
}

const DEDUCTIBLE_KEYWORDS = [
  'saúde', 'médic', 'hospital', 'clínic', 'dentist', 'odonto', 'psicólog', 'terapia', 'fisioterapia', 'exame', 'laborat', 'farmácia',
  'educação', 'escola', 'faculdade', 'universidade', 'curso', 'mensalidade', 'matrícula',
  'previdência', 'pgbl', 'inss',
  'pensão', 'aliment',
  'doação', 'doaç',
];

const CAPITAL_GAIN_KEYWORDS = [
  'investimento', 'rendimento', 'dividend', 'juros', 'ações', 'fii', 'fundo', 'cdb', 'tesouro', 'lci', 'lca', 'cripto', 'bitcoin',
  'venda de imóvel', 'venda de veículo', 'ganho de capital', 'lucro',
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

interface Props {
  transactions: Transaction[];
  categories: CategoryInfo[];
  year: string;
}

export default function OverviewTab({ transactions, categories, year }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ deductible: true, capital: true, income: false, expense: false });

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const getCatName = useCallback(
    (id: string | null) => (id ? catMap.get(id)?.name || 'Sem categoria' : 'Sem categoria'),
    [catMap],
  );


  const report = useMemo(() => {
    const deductibleByCategory = new Map<string, GroupedSection>();
    const capitalGainsByCategory = new Map<string, GroupedSection>();
    let totalIncome = 0;
    let totalExpense = 0;
    const incomeByCategory = new Map<string, GroupedSection>();
    const expenseByCategory = new Map<string, GroupedSection>();

    transactions.forEach(tx => {
      const catName = getCatName(tx.category_id);
      const amount = Number(tx.amount);
      const item = { description: tx.description, date: tx.date, amount, category: catName };

      const isDeductible = tx.type === 'expense' && (matchesKeywords(catName, DEDUCTIBLE_KEYWORDS) || matchesKeywords(tx.description, DEDUCTIBLE_KEYWORDS));
      const isCapitalGain = tx.type === 'income' && (matchesKeywords(catName, CAPITAL_GAIN_KEYWORDS) || matchesKeywords(tx.description, CAPITAL_GAIN_KEYWORDS));

      if (isDeductible) {
        const existing = deductibleByCategory.get(catName) || { label: catName, total: 0, items: [] };
        existing.total += amount;
        existing.items.push(item);
        deductibleByCategory.set(catName, existing);
      }
      if (isCapitalGain) {
        const existing = capitalGainsByCategory.get(catName) || { label: catName, total: 0, items: [] };
        existing.total += amount;
        existing.items.push(item);
        capitalGainsByCategory.set(catName, existing);
      }
      if (tx.type === 'income') {
        totalIncome += amount;
        const existing = incomeByCategory.get(catName) || { label: catName, total: 0, items: [] };
        existing.total += amount;
        existing.items.push(item);
        incomeByCategory.set(catName, existing);
      } else if (tx.type === 'expense') {
        totalExpense += amount;
        const existing = expenseByCategory.get(catName) || { label: catName, total: 0, items: [] };
        existing.total += amount;
        existing.items.push(item);
        expenseByCategory.set(catName, existing);
      }
    });

    const sortByTotal = (a: GroupedSection, b: GroupedSection) => b.total - a.total;
    return {
      deductible: Array.from(deductibleByCategory.values()).sort(sortByTotal),
      totalDeductible: Array.from(deductibleByCategory.values()).reduce((s, g) => s + g.total, 0),
      capitalGains: Array.from(capitalGainsByCategory.values()).sort(sortByTotal),
      totalCapitalGains: Array.from(capitalGainsByCategory.values()).reduce((s, g) => s + g.total, 0),
      totalIncome,
      totalExpense,
      incomeByCategory: Array.from(incomeByCategory.values()).sort(sortByTotal),
      expenseByCategory: Array.from(expenseByCategory.values()).sort(sortByTotal),
      transactionCount: transactions.length,
    };
  }, [transactions, getCatName]);

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleExportCSV = () => {
    if (transactions.length === 0) { toast.error('Nenhuma transação para exportar.'); return; }
    const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
    const rows = transactions.map(tx => {
      const cat = getCatName(tx.category_id);
      const tipo = tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transferência';
      return `${tx.date},${tipo},"${cat}","${tx.description}",${Number(tx.amount).toFixed(2)}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ir-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  };

  const formatDateBR = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Agrupamento automático por palavras-chave. Para análise com IA mais precisa, use a aba "Deduções IA".
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="py-3 px-4 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Receitas</p><p className="text-lg font-bold font-mono text-primary">{formatCurrency(report.totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="py-3 px-4 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Despesas</p><p className="text-lg font-bold font-mono text-destructive">{formatCurrency(report.totalExpense)}</p></CardContent></Card>
        <Card className="border-primary/30"><CardContent className="py-3 px-4 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dedutíveis</p><p className="text-lg font-bold font-mono text-primary">{formatCurrency(report.totalDeductible)}</p><Badge variant="secondary" className="mt-1 text-[10px]">{report.deductible.reduce((s, g) => s + g.items.length, 0)} itens</Badge></CardContent></Card>
        <Card className="border-primary/30"><CardContent className="py-3 px-4 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ganhos de Capital</p><p className="text-lg font-bold font-mono text-primary">{formatCurrency(report.totalCapitalGains)}</p><Badge variant="secondary" className="mt-1 text-[10px]">{report.capitalGains.reduce((s, g) => s + g.items.length, 0)} itens</Badge></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{report.transactionCount} transações no período</p>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1"><Download className="h-3 w-3" /> CSV</Button>
      </div>

      <Separator />

      <ReportSection title="Despesas Dedutíveis" icon={<TrendingDown className="h-4 w-4 text-destructive" />} total={report.totalDeductible} groups={report.deductible} isOpen={openSections.deductible} onToggle={() => toggleSection('deductible')} formatDateBR={formatDateBR} emptyMessage="Nenhuma despesa dedutível identificada." />
      <ReportSection title="Ganhos de Capital / Rendimentos" icon={<TrendingUp className="h-4 w-4 text-primary" />} total={report.totalCapitalGains} groups={report.capitalGains} isOpen={openSections.capital} onToggle={() => toggleSection('capital')} formatDateBR={formatDateBR} emptyMessage="Nenhum rendimento de capital identificado." />
      <ReportSection title="Todas as Receitas" icon={<TrendingUp className="h-4 w-4 text-primary" />} total={report.totalIncome} groups={report.incomeByCategory} isOpen={openSections.income} onToggle={() => toggleSection('income')} formatDateBR={formatDateBR} emptyMessage="Nenhuma receita no período." />
      <ReportSection title="Todas as Despesas" icon={<TrendingDown className="h-4 w-4 text-destructive" />} total={report.totalExpense} groups={report.expenseByCategory} isOpen={openSections.expense} onToggle={() => toggleSection('expense')} formatDateBR={formatDateBR} emptyMessage="Nenhuma despesa no período." />
    </div>
  );
}

function ReportSection({ title, icon, total, groups, isOpen, onToggle, formatDateBR, emptyMessage }: {
  title: string; icon: React.ReactNode; total: number; groups: GroupedSection[]; isOpen: boolean; onToggle: () => void; formatDateBR: (d: string) => string; emptyMessage: string;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">{icon}<CardTitle className="text-sm font-semibold">{title}</CardTitle></div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono">{formatCurrency(total)}</span>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pt-0 pb-3">
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">{emptyMessage}</p>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{group.label}</span>
                      <span className="text-xs font-bold font-mono">{formatCurrency(group.total)}</span>
                    </div>
                    <div className="space-y-1 pl-2 border-l-2 border-border">
                      {group.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground shrink-0">{formatDateBR(item.date)}</span>
                            <span className="truncate">{item.description}</span>
                          </div>
                          <span className="font-mono shrink-0 ml-2">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
