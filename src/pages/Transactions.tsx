import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatCurrency, formatDate, parseLocalDate } from '@/lib/format';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, Loader2, Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Receipt, Sparkles, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { transactionSchema, getUserFriendlyError } from '@/lib/validation';
import SmartTransactionInput, { SmartTransactionInputHandle, saveCategoryOverride } from '@/components/SmartTransactionInput';
import { uploadReceipt } from '@/services/receiptService';
import { StatementImportModal } from '@/components/transactions/StatementImportModal';

const emptyForm = {
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  type: 'expense' as 'income' | 'expense' | 'transfer',
  category_id: '',
  account_id: '',
  card_id: '',
  contact_id: '',
  is_paid: true,
  installments: 1,
  recurrence: '' as '' | 'weekly' | 'monthly' | 'yearly',
  split_enabled: false,
  split_contact_id: '',
  split_user_percent: '',
  receipt_url: '',
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const Transactions = () => {
  const { user } = useAuth();
  const { discreteMode } = useAppSettings();
  const d = discreteMode;
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === 'true');
  const [saving, setSaving] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<string[]>([]);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const smartInputRef = useRef<SmartTransactionInputHandle>(null);

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCard, setFilterCard] = useState<string>('all');
  const [filterPaid, setFilterPaid] = useState<string>('all');
  const [filterContact, setFilterContact] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [txRes, accRes, cardRes, contRes, catRes] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('accounts').select('*'),
      supabase.from('credit_cards').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('categories').select('*'),
    ]);
    setTransactions(txRes.data || []);
    setAccounts(accRes.data || []);
    setCards(cardRes.data || []);
    setContacts(contRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = parseLocalDate(tx.date);
      if (txDate.getMonth() !== filterMonth || txDate.getFullYear() !== filterYear) return false;
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.category_id !== filterCategory) return false;
      if (filterAccount !== 'all' && tx.account_id !== filterAccount) return false;
      if (filterCard !== 'all' && tx.card_id !== filterCard) return false;
      if (filterPaid === 'paid' && !tx.is_paid) return false;
      if (filterPaid === 'pending' && tx.is_paid) return false;
      if (filterContact === 'none' && tx.contact_id) return false;
      if (filterContact !== 'all' && filterContact !== 'none' && tx.contact_id !== filterContact) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!tx.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterMonth, filterYear, filterType, filterCategory, filterAccount, filterCard, filterPaid, filterContact, searchQuery]);

  // Summary totals for the filtered view
  const summary = useMemo(() => {
    let income = 0, expense = 0;
    filteredTransactions.forEach(tx => {
      if (tx.type === 'income') income += Number(tx.amount);
      else if (tx.type === 'expense') expense += Number(tx.amount);
    });
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const activeFilterCount = [filterCategory, filterAccount, filterCard, filterPaid, filterContact].filter(f => f !== 'all').length + (searchQuery ? 1 : 0);

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterAccount('all');
    setFilterCard('all');
    setFilterPaid('all');
    setFilterContact('all');
    setSearchQuery('');
  };

  const changeMonth = (delta: number) => {
    let m = filterMonth + delta;
    let y = filterYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setFilterMonth(m);
    setFilterYear(y);
  };

  const openEdit = (tx: any) => {
    setEditingTx(tx);
    setForm({
      description: tx.description,
      amount: tx.amount.toString(),
      date: tx.date,
      type: tx.type,
      category_id: tx.category_id || '',
      account_id: tx.account_id || '',
      card_id: tx.card_id || '',
      contact_id: tx.contact_id || '',
      is_paid: tx.is_paid,
      installments: 1,
      recurrence: (tx as any).recurrence || '',
      split_enabled: false,
      split_contact_id: '',
      split_user_percent: '',
      receipt_url: (tx as any).receipt_url || '',
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingTx(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const parsed = transactionSchema.parse({
        ...form,
        amount: parseFloat(form.amount),
        installments: form.installments,
        recurrence: form.recurrence,
      });
      const amount = parsed.amount;

      // ===== SPLIT BILL FLOW =====
      if (!editingTx && form.split_enabled) {
        if (!form.split_contact_id) {
          throw new Error('Selecione a pessoa para dividir a conta.');
        }
        const rawPct = form.split_user_percent.trim();
        const userPct = rawPct === '' ? 50 : parseFloat(rawPct);
        if (Number.isNaN(userPct) || userPct < 0 || userPct > 100) {
          throw new Error('Percentual de divisão deve estar entre 0 e 100.');
        }
        const contactPct = 100 - userPct;
        const userAmount = Math.round((amount * userPct) / 100 * 100) / 100;
        const contactAmount = Math.round((amount * contactPct) / 100 * 100) / 100;
        const contactName = contacts.find(c => c.id === form.split_contact_id)?.name || '';

        const baseShared: Record<string, any> = {
          user_id: user.id,
          date: form.date,
          type: form.type,
          category_id: form.category_id || null,
          account_id: form.account_id || null,
          card_id: form.card_id || null,
          is_paid: form.is_paid,
        };

        const txsToInsert = [
          {
            ...baseShared,
            description: `${form.description} (sua parte ${userPct}%)`,
            amount: userAmount,
            contact_id: null,
          },
          {
            ...baseShared,
            description: `${form.description} (${contactName} ${contactPct}%)`,
            amount: contactAmount,
            contact_id: form.split_contact_id,
          },
        ];

        const { error } = await supabase.from('transactions').insert(txsToInsert as any);
        if (error) throw error;

        if (form.account_id) {
          const delta = form.type === 'income' ? amount : -amount;
          await supabase.rpc('update_account_balance', { p_account_id: form.account_id, p_delta: delta });
        }
        if (contactAmount > 0 && form.is_paid) {
          const delta = form.type === 'expense' ? contactAmount : -contactAmount;
          await supabase.rpc('update_contact_balance', { p_contact_id: form.split_contact_id, p_delta: delta });
        }

        toast.success(`Conta dividida com ${contactName}!`);
        setDialogOpen(false);
        setEditingTx(null);
        setForm({ ...emptyForm });
        loadData();
        return;
      }
      // ===== END SPLIT FLOW =====


      if (editingTx) {
        const { error } = await supabase.from('transactions').update({
          description: form.description,
          amount,
          date: form.date,
          type: form.type,
          category_id: form.category_id || null,
          account_id: form.account_id || null,
          card_id: form.card_id || null,
          contact_id: form.contact_id || null,
          is_paid: form.is_paid,
          receipt_url: form.receipt_url || null,
        }).eq('id', editingTx.id);
        if (error) throw error;

        // Reconcile contact AND account balances based on transitions
        const oldContactId = editingTx.contact_id || null;
        const oldAccountId = editingTx.account_id || null;
        const oldAmount = Number(editingTx.amount);
        const oldType = editingTx.type;
        const oldPaid = !!editingTx.is_paid;
        const newContactId = form.contact_id || null;
        const newAccountId = form.account_id || null;
        const newPaid = !!form.is_paid;

        // Contact: only counts when paid
        if (oldContactId && oldPaid) {
          const revert = oldType === 'expense' ? -oldAmount : oldAmount;
          await supabase.rpc('update_contact_balance', { p_contact_id: oldContactId, p_delta: revert });
        }
        if (newContactId && newPaid) {
          const apply = form.type === 'expense' ? amount : -amount;
          await supabase.rpc('update_contact_balance', { p_contact_id: newContactId, p_delta: apply });
        }

        // Account: debited at creation regardless of is_paid (current convention).
        // On edit, revert old contribution and apply new.
        if (oldAccountId) {
          const revertAcc = oldType === 'income' ? -oldAmount : oldAmount;
          await supabase.rpc('update_account_balance', { p_account_id: oldAccountId, p_delta: revertAcc });
        }
        if (newAccountId) {
          const applyAcc = form.type === 'income' ? amount : -amount;
          await supabase.rpc('update_account_balance', { p_account_id: newAccountId, p_delta: applyAcc });
        }

        toast.success('Transação atualizada!');
      } else {
        const installments = Math.max(1, form.installments);
        const recurrence = form.recurrence || null;
        const count = recurrence ? 12 : installments;
        const recurringGroupId = (count > 1 || recurrence) ? crypto.randomUUID() : null;

        const baseTx: Record<string, any> = {
          user_id: user.id,
          description: form.description,
          amount: recurrence ? amount : amount / installments,
          type: form.type,
          category_id: form.category_id || null,
          account_id: form.account_id || null,
          card_id: form.card_id || null,
          contact_id: form.contact_id || null,
          is_paid: form.is_paid,
          recurring_group_id: recurringGroupId,
          recurrence: recurrence,
          receipt_url: form.receipt_url || null,
        };

        const txsToInsert = [];
        for (let i = 0; i < count; i++) {
          const date = new Date(form.date + 'T12:00:00');
          if (recurrence === 'weekly') {
            date.setDate(date.getDate() + i * 7);
          } else if (recurrence === 'yearly') {
            date.setFullYear(date.getFullYear() + i);
          } else {
            date.setMonth(date.getMonth() + i);
          }
          txsToInsert.push({
            ...baseTx,
            date: date.toISOString().split('T')[0],
            installment_number: !recurrence && installments > 1 ? i + 1 : null,
            total_installments: !recurrence && installments > 1 ? installments : null,
            is_paid: i === 0 ? form.is_paid : false,
          });
        }

        const { error } = await supabase.from('transactions').insert(txsToInsert);
        if (error) throw error;

        // For installments without recurrence, only the 1st parcel is_paid by default.
        // Recurrence: each row has full amount, only 1st is paid → debit full amount once.
        // Installments: each row has amount/installments; debit only the paid first parcel.
        const firstAmount = recurrence ? amount : amount / installments;

        if (form.account_id && form.is_paid) {
          const delta = form.type === 'income' ? firstAmount : -firstAmount;
          await supabase.rpc('update_account_balance', { p_account_id: form.account_id, p_delta: delta });
        }

        if (form.contact_id && form.is_paid) {
          const delta = form.type === 'expense' ? firstAmount : -firstAmount;
          await supabase.rpc('update_contact_balance', { p_contact_id: form.contact_id, p_delta: delta });
        }


        const label = recurrence
          ? `Recorrência ${recurrence} criada (12x)!`
          : `Transação${installments > 1 ? ` (${installments}x)` : ''} criada!`;
        toast.success(label);
      }

      // In batch mode, keep dialog open and advance; also learn category if changed
      if (isBatchMode && !editingTx) {
        if (form.category_id && form.description) {
          const catName = categories.find(c => c.id === form.category_id)?.name;
          if (catName) saveCategoryOverride(form.description, catName);
        }
        setForm({ ...emptyForm });
        loadData();
        smartInputRef.current?.handleConfirmCurrent();
        smartInputRef.current?.handleBatchNext();
      } else {
        setDialogOpen(false);
        setEditingTx(null);
        setForm({ ...emptyForm });
        loadData();
      }
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

  const handleDelete = async (tx: any) => {
    if (!confirm('Excluir esta transação?')) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (error) throw error;

      if (tx.account_id) {
        const delta = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount);
        await supabase.rpc('update_account_balance', { p_account_id: tx.account_id, p_delta: delta });
      }

      if (tx.contact_id && tx.is_paid) {
        const delta = tx.type === 'expense' ? -Number(tx.amount) : Number(tx.amount);
        await supabase.rpc('update_contact_balance', { p_contact_id: tx.contact_id, p_delta: delta });
      }

      toast.success('Transação excluída!');
      loadData();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const typeIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="h-4 w-4 text-primary" />;
    if (type === 'expense') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />;
  };

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '';
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '';
  const getCardName = (id: string) => cards.find(c => c.id === id)?.name || '';

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Transações</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
            <UploadCloud className="h-4 w-4 mr-1 text-primary" /> Importar Extrato
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold min-w-[100px] text-center">
          {MONTHS[filterMonth]} {filterYear}
        </span>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="py-2 px-3 text-center">
            <p className="text-[10px] text-muted-foreground">Receitas</p>
            <p className="text-sm font-semibold text-primary">{formatCurrency(summary.income, d)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2 px-3 text-center">
            <p className="text-[10px] text-muted-foreground">Despesas</p>
            <p className="text-sm font-semibold text-destructive">{formatCurrency(summary.expense, d)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2 px-3 text-center">
            <p className="text-[10px] text-muted-foreground">Saldo</p>
            <p className={`text-sm font-semibold ${summary.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(summary.balance, d)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Type Filter */}
      <ToggleGroup type="single" value={filterType} onValueChange={v => v && setFilterType(v)} className="justify-start">
        <ToggleGroupItem value="all" size="sm">Todos</ToggleGroupItem>
        <ToggleGroupItem value="expense" size="sm">Despesas</ToggleGroupItem>
        <ToggleGroupItem value="income" size="sm">Receitas</ToggleGroupItem>
        <ToggleGroupItem value="transfer" size="sm">Transf.</ToggleGroupItem>
      </ToggleGroup>

      {/* Search + Advanced Filters Toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" onClick={() => setSearchQuery('')}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant={showFilters || activeFilterCount > 0 ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Filtros avançados</span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearFilters}>Limpar</Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={filterPaid} onValueChange={setFilterPaid}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conta</Label>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cartão</Label>
                  <Select value={filterCard} onValueChange={setFilterCard}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {cards.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Pessoa</Label>
                  <Select value={filterContact} onValueChange={setFilterContact}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as pessoas</SelectItem>
                      <SelectItem value="none">Somente meus gastos</SelectItem>
                      {contacts.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transaction Form Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTx(null);
            setAiFilledFields([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
          </DialogHeader>

          {/* Smart Input - only for new transactions */}
          {!editingTx && (
            <SmartTransactionInput
              ref={smartInputRef}
              categories={categories}
              accounts={accounts}
              cards={cards}
              contacts={contacts}
              onParsed={(data) => {
                const detected: string[] = [];
                if (data.description) detected.push('description');
                if (data.amount) detected.push('amount');
                if (data.date) detected.push('date');
                if (data.category_name) detected.push('category_id');
                setAiFilledFields(detected);

                setForm(prev => ({
                  ...prev,
                  description: data.description || prev.description,
                  amount: data.amount?.toString() || prev.amount,
                  date: data.date || prev.date,
                  type: data.type || prev.type,
                  category_id: data.category_name
                    ? (categories.find(c => c.name.toLowerCase() === data.category_name!.toLowerCase())?.id || prev.category_id)
                    : prev.category_id,
                  account_id: data.account_name
                    ? (accounts.find(a => a.name.toLowerCase() === data.account_name!.toLowerCase())?.id || prev.account_id)
                    : prev.account_id,
                  card_id: data.card_name
                    ? (cards.find(c => c.name.toLowerCase() === data.card_name!.toLowerCase())?.id || prev.card_id)
                    : prev.card_id,
                  contact_id: data.contact_name
                    ? (contacts.find(c => c.name.toLowerCase() === data.contact_name!.toLowerCase())?.id || prev.contact_id)
                    : prev.contact_id,
                  recurrence: (data.recurrence as any) || prev.recurrence,
                  installments: data.installments || prev.installments,
                }));
              }}
              onBatchStart={() => setIsBatchMode(true)}
              onBatchEnd={() => {
                setIsBatchMode(false);
                setAiFilledFields([]);
                setForm({ ...emptyForm });
              }}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Descrição
                {aiFilledFields.includes('description') && (
                  <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5 py-0 px-1 font-normal">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5 inline" /> IA
                  </Badge>
                )}
              </Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Valor (R$)
                  {aiFilledFields.includes('amount') && (
                    <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5 py-0 px-1 font-normal">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5 inline" /> IA
                    </Badge>
                  )}
                </Label>
                <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Data
                  {aiFilledFields.includes('date') && (
                    <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5 py-0 px-1 font-normal">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5 inline" /> IA
                    </Badge>
                  )}
                </Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Categoria
                {aiFilledFields.includes('category_id') && (
                  <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5 py-0 px-1 font-normal">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5 inline" /> IA
                  </Badge>
                )}
              </Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.type === form.type || form.type === 'transfer').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select value={form.account_id || 'none'} onValueChange={v => setForm({ ...form, account_id: v === 'none' ? '' : v, card_id: v === 'none' ? form.card_id : '' })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cartão de Crédito</Label>
              <Select value={form.card_id || 'none'} onValueChange={v => setForm({ ...form, card_id: v === 'none' ? '' : v, account_id: v === 'none' ? form.account_id : '' })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cards.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contato (Dívida)</Label>
              <Select value={form.contact_id || 'none'} onValueChange={v => setForm({ ...form, contact_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingTx && (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.split_enabled}
                    onChange={e => setForm({ ...form, split_enabled: e.target.checked })}
                    className="rounded"
                  />
                  Dividir conta com alguém
                </label>
                {form.split_enabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Pessoa</Label>
                      <Select
                        value={form.split_contact_id || ''}
                        onValueChange={v => setForm({ ...form, split_contact_id: v })}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar contato" /></SelectTrigger>
                        <SelectContent>
                          {contacts.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sua parte (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="50"
                        value={form.split_user_percent}
                        onChange={e => setForm({ ...form, split_user_percent: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Parte do contato (%)</Label>
                      <Input
                        type="number"
                        disabled
                        value={
                          form.split_user_percent.trim() === ''
                            ? 50
                            : Math.max(0, Math.min(100, 100 - (parseFloat(form.split_user_percent) || 0)))
                        }
                        className="h-9 bg-muted"
                      />
                    </div>
                    <p className="col-span-2 text-[11px] text-muted-foreground">
                      Serão criados 2 lançamentos. Se deixar em branco, divide 50/50.
                    </p>
                  </div>
                )}
              </div>
            )}
            {!editingTx && (
              <>
                <div className="space-y-1.5">
                  <Label>Recorrência</Label>
                  <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v as any, installments: v ? 1 : form.installments })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma (avulsa)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (avulsa)</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!form.recurrence && (
                  <div className="space-y-1.5">
                    <Label>Parcelas</Label>
                    <Input type="number" min="1" max="48" value={form.installments} onChange={e => setForm({ ...form, installments: parseInt(e.target.value) || 1 })} />
                  </div>
                )}
                <div className="space-y-1.5 flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_paid} onChange={e => setForm({ ...form, is_paid: e.target.checked })} className="rounded" />
                    Pago
                  </label>
                </div>
              </>
            )}
            {editingTx && (
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_paid} onChange={e => setForm({ ...form, is_paid: e.target.checked })} className="rounded" />
                  Pago
                </label>
              </div>
            )}
            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  Comprovante Fiscal (Opcional)
                  {parsingReceipt && <Loader2 className="h-3 w-3 animate-spin text-primary inline" />}
                </Label>
                {form.receipt_url && (
                  <button
                    type="button"
                    className="text-primary hover:underline text-[11px] font-medium"
                    onClick={() => window.open(form.receipt_url, '_blank')}
                  >
                    Ver comprovante
                  </button>
                )}
              </div>
              <Input
                type="file"
                accept="image/*,application/pdf"
                disabled={parsingReceipt}
                className="text-xs h-9 cursor-pointer file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary/10 file:text-primary"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && user?.id) {
                    setParsingReceipt(true);
                    const toastId = toast.loading('Enviando comprovante e analisando com IA...');
                    try {
                      const { url, error: uploadError } = await uploadReceipt(file, user.id);
                      if (url) {
                        setForm(f => ({ ...f, receipt_url: url }));
                        toast.success('Comprovante anexado ao armazenamento!');
                      } else {
                        toast.error(uploadError || 'Erro ao enviar comprovante.');
                      }

                      // Extração de dados via IA (OCR + NLP)
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = reader.result as string;
                        if (base64) {
                          try {
                            const { data, error: parseErr } = await supabase.functions.invoke('parse-transaction', {
                              body: {
                                imageBase64: base64,
                                categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
                                accounts: accounts.map(a => ({ id: a.id, name: a.name })),
                                cards: cards.map(c => ({ id: c.id, name: c.name })),
                              },
                            });

                            if (!parseErr && data) {
                              const txData = data.transactions ? data.transactions[0] : data;
                              if (txData) {
                                const detected: string[] = [];
                                const catMatch = txData.category_name
                                  ? categories.find(c => c.name.toLowerCase() === txData.category_name.toLowerCase())
                                  : undefined;

                                setForm(prev => {
                                  const updated = { ...prev };
                                  if (txData.description) {
                                    updated.description = txData.description;
                                    detected.push('description');
                                  }
                                  if (txData.amount) {
                                    updated.amount = String(txData.amount);
                                    detected.push('amount');
                                  }
                                  if (txData.date) {
                                    updated.date = txData.date;
                                    detected.push('date');
                                  }
                                  if (catMatch) {
                                    updated.category_id = catMatch.id;
                                    detected.push('category_id');
                                  }
                                  return updated;
                                });

                                setAiFilledFields(detected);
                                toast.success('✨ IA extraiu dados do comprovante e preencheu o formulário!');
                              }
                            }
                          } catch (aiErr) {
                            console.warn('[Transactions] OCR da IA falhou:', aiErr);
                          }
                        }
                      };
                      reader.readAsDataURL(file);
                    } catch (err: any) {
                      console.error('[Transactions] Erro no processamento do comprovante:', err);
                    } finally {
                      setParsingReceipt(false);
                      toast.dismiss(toastId);
                    }
                  }
                }}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma transação encontrada.
            </CardContent>
          </Card>
        ) : (
          filteredTransactions.map(tx => (
            <Card key={tx.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                    {typeIcon(tx.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                      {tx.category_id && ` • ${getCategoryName(tx.category_id)}`}
                      {tx.total_installments && ` • ${tx.installment_number}/${tx.total_installments}`}
                      {(tx as any).recurrence && ` • ${(tx as any).recurrence === 'weekly' ? 'Semanal' : (tx as any).recurrence === 'monthly' ? 'Mensal' : 'Anual'}`}
                      {!tx.is_paid && ' • Pendente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                    {d ? '••••' : `${tx.type === 'income' ? '+' : '-'}${formatCurrency(Number(tx.amount))}`}
                  </span>
                  {(tx as any).receipt_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:text-primary/80"
                      title="Ver Comprovante Anexo"
                      onClick={() => window.open((tx as any).receipt_url, '_blank')}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(tx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <StatementImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        accounts={accounts}
        categories={categories}
        existingTransactions={transactions}
        onSuccess={loadData}
      />
    </div>
  );
};

export default Transactions;
