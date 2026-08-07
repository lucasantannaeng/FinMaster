import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Tag, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import { categorySchema, incomeSchema, getUserFriendlyError } from '@/lib/validation';
import { Progress } from '@/components/ui/progress';

const Categories = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<Map<string, any>>(new Map());
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [incomeDialog, setIncomeDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [incomeValue, setIncomeValue] = useState('');
  const [monthExpenses, setMonthExpenses] = useState<Map<string, number>>(new Map());

  const [form, setForm] = useState({
    name: '',
    type: 'expense' as string,
    icon: 'tag',
    color: '#6366F1',
    percentage: '',
  });

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!user) return;
    try {
      const [catRes, profileRes, budgetRes] = await Promise.all([
        supabase.from('categories').select('*').order('type').order('name'),
        supabase.from('profiles').select('monthly_income').eq('user_id', user.id).single(),
        supabase.from('category_budgets').select('*'),
      ]);
      if (signal?.cancelled) return;

      setCategories(catRes.data || []);
      const income = Number(profileRes.data?.monthly_income || 0);
      setMonthlyIncome(income);
      setIncomeValue(income.toString());

      const bMap = new Map<string, any>();
      (budgetRes.data || []).forEach((b: any) => bMap.set(b.category_id, b));
      setBudgets(bMap);

      // Load current month expenses per category
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const { data: txs } = await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('type', 'expense')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (signal?.cancelled) return;

      const expMap = new Map<string, number>();
      (txs || []).forEach((t: any) => {
        if (t.category_id) {
          expMap.set(t.category_id, (expMap.get(t.category_id) || 0) + Number(t.amount));
        }
      });
      setMonthExpenses(expMap);
    } catch (err: any) {
      if (!signal?.cancelled) toast.error(getUserFriendlyError(err));
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const signal = { cancelled: false };
    loadData(signal);
    return () => { signal.cancelled = true; };
  }, [loadData]);


  const openEdit = (cat: any) => {
    setEditing(cat);
    const budget = budgets.get(cat.id);
    setForm({
      name: cat.name,
      type: cat.type,
      icon: cat.icon || 'tag',
      color: cat.color || '#6366F1',
      percentage: budget ? budget.percentage.toString() : '',
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: 'expense', icon: 'tag', color: '#6366F1', percentage: '' });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsed = categorySchema.parse({
        name: form.name,
        type: form.type,
        icon: form.icon,
        color: form.color,
        percentage: form.percentage ? parseFloat(form.percentage) : undefined,
      });
      if (editing) {
        const { error } = await supabase.from('categories').update({
          name: form.name,
          type: form.type,
          icon: form.icon,
          color: form.color,
        }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('categories').insert({
          user_id: user.id,
          name: form.name,
          type: form.type,
          icon: form.icon,
          color: form.color,
        }).select().single();
        if (error) throw error;
        // Use returned id for budget
        if (form.percentage && data) {
          await supabase.from('category_budgets').upsert({
            user_id: user.id,
            category_id: data.id,
            percentage: parseFloat(form.percentage) || 0,
          }, { onConflict: 'user_id,category_id' });
        }
      }

      // Update budget if editing
      if (editing) {
        if (form.percentage) {
          await supabase.from('category_budgets').upsert({
            user_id: user.id,
            category_id: editing.id,
            percentage: parseFloat(form.percentage) || 0,
          }, { onConflict: 'user_id,category_id' });
        } else {
          // Remove budget if cleared
          const existing = budgets.get(editing.id);
          if (existing) {
            await supabase.from('category_budgets').delete().eq('id', existing.id);
          }
        }
      }

      toast.success(editing ? 'Categoria atualizada!' : 'Categoria criada!');
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      if (err?.errors?.[0]?.message) {
        toast.error(err.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Categoria excluída!');
      loadData();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const saveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsed = incomeSchema.parse({
        monthly_income: parseFloat(incomeValue) || 0,
      });
      const { error } = await supabase.from('profiles').update({
        monthly_income: parsed.monthly_income,
      }).eq('user_id', user.id);
      if (error) throw error;
      toast.success('Renda mensal atualizada!');
      setIncomeDialog(false);
      loadData();
    } catch (err: any) {
      if (err?.errors?.[0]?.message) {
        toast.error(err.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const totalAllocated = Array.from(budgets.values()).reduce((s, b) => s + Number(b.percentage), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Categorias</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      {/* Monthly Income & Budget */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Renda Mensal</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIncomeDialog(true)}>
              {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : 'Definir'}
            </Button>
          </div>
          {monthlyIncome > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Alocado em categorias</span>
                <span>{totalAllocated.toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(totalAllocated, 100)} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Categories */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Despesas</h2>
        {expenseCategories.map(cat => {
          const budget = budgets.get(cat.id);
          const budgetAmount = budget && monthlyIncome > 0 ? (monthlyIncome * Number(budget.percentage)) / 100 : 0;
          const spent = monthExpenses.get(cat.id) || 0;
          const spentPercent = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

          return (
            <Card key={cat.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                      <Tag className="h-3 w-3" style={{ color: cat.color }} />
                    </div>
                    <span className="text-sm font-medium">{cat.name}</span>
                    {budget && <span className="text-xs text-muted-foreground">{budget.percentage}%</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {budgetAmount > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(spent)}</span>
                      <span>{formatCurrency(budgetAmount)}</span>
                    </div>
                    <Progress value={Math.min(spentPercent, 100)} className={`h-1.5 ${spentPercent > 100 ? '[&>div]:bg-destructive' : ''}`} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Income Categories */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Receitas</h2>
        {incomeCategories.map(cat => (
          <Card key={cat.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                  <Tag className="h-3 w-3" style={{ color: cat.color }} />
                </div>
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-10 p-1" />
              </div>
            </div>
            {form.type === 'expense' && (
              <div className="space-y-1.5">
                <Label>% da Renda Mensal</Label>
                <Input type="number" step="0.1" min="0" max="100" placeholder="Ex: 30" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Monthly Income Dialog */}
      <Dialog open={incomeDialog} onOpenChange={setIncomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renda Mensal</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveIncome} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={incomeValue} onChange={e => setIncomeValue(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Categories;
