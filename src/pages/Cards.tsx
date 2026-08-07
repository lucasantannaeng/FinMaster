import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import { Plus, CreditCard as CreditCardIcon, ChevronRight, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { creditCardSchema, getUserFriendlyError } from '@/lib/validation';
import { useBillingPeriod } from '@/hooks/useBillingPeriod';
import { useCardInvoice } from '@/hooks/useCardInvoice';
import InvoiceNavigator from '@/components/cards/InvoiceNavigator';
import InvoiceSummary from '@/components/cards/InvoiceSummary';
import InvoiceFilters from '@/components/cards/InvoiceFilters';
import InvoiceTransactionList from '@/components/cards/InvoiceTransactionList';

interface CreditCardRow {
  id: string;
  name: string;
  card_limit: number | string;
  closing_day: number;
  due_day: number;
}

interface CardDetailViewProps {
  card: CreditCardRow;
  contacts: any[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const CardDetailView = ({ card, contacts, onBack, onEdit, onDelete }: CardDetailViewProps) => {
  const period = useBillingPeriod(card.closing_day, card.due_day);
  const {
    transactions,
    filteredTransactions,
    categories,
    totalBill,
    isLoading,
    filters,
    setFilters,
    hasActiveFilters,
    resetFilters,
  } = useCardInvoice({
    cardId: card.id,
    startDateStr: period.startDateStr,
    endDateStr: period.endDateStr,
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack}>← Voltar</Button>
          <h1 className="text-xl font-bold truncate">{card.name}</h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar cartão">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} aria-label="Excluir cartão">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <InvoiceNavigator
        label={period.label}
        isCurrentMonth={period.isCurrentMonth}
        onPrev={period.goPrev}
        onNext={period.goNext}
        onToday={period.goToCurrentMonth}
      />

      <InvoiceSummary
        totalBill={totalBill}
        cardLimit={Number(card.card_limit)}
        startDate={period.startDate}
        endDate={period.endDate}
        dueDate={period.dueDate}
        status={period.status}
        closingDay={card.closing_day}
        dueDay={card.due_day}
      />

      <InvoiceFilters
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        contacts={contacts}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      <InvoiceTransactionList
        transactions={filteredTransactions}
        categories={categories}
        contacts={contacts}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        totalTransactions={transactions.length}
      />
    </div>
  );
};

const Cards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCardRow[]>([]);
  const [selectedCard, setSelectedCard] = useState<CreditCardRow | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', card_limit: '', closing_day: '', due_day: '' });

  useEffect(() => {
    if (!user) return;
    loadCards();
  }, [user]);

  const loadCards = async () => {
    const [cardsRes, contactsRes] = await Promise.all([
      supabase.from('credit_cards').select('*').order('name'),
      supabase.from('contacts').select('*').order('name'),
    ]);
    setCards((cardsRes.data as CreditCardRow[]) || []);
    setContacts(contactsRes.data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditingCard(null);
    setForm({ name: '', card_limit: '', closing_day: '', due_day: '' });
    setDialogOpen(true);
  };

  const openEdit = (card: CreditCardRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCard(card);
    setForm({
      name: card.name,
      card_limit: String(card.card_limit),
      closing_day: String(card.closing_day),
      due_day: String(card.due_day),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsed = creditCardSchema.parse({
        name: form.name,
        card_limit: parseFloat(form.card_limit),
        closing_day: parseInt(form.closing_day),
        due_day: parseInt(form.due_day),
      });

      if (editingCard) {
        const { error } = await supabase.from('credit_cards').update({
          name: parsed.name,
          card_limit: parsed.card_limit,
          closing_day: parsed.closing_day,
          due_day: parsed.due_day,
        }).eq('id', editingCard.id);
        if (error) throw error;
        toast.success('Cartão atualizado!');
        if (selectedCard?.id === editingCard.id) {
          setSelectedCard({ ...selectedCard, ...parsed } as CreditCardRow);
        }
      } else {
        const { error } = await supabase.from('credit_cards').insert({
          user_id: user.id,
          name: parsed.name,
          card_limit: parsed.card_limit,
          closing_day: parsed.closing_day,
          due_day: parsed.due_day,
        });
        if (error) throw error;
        toast.success('Cartão criado!');
      }

      setDialogOpen(false);
      setEditingCard(null);
      setForm({ name: '', card_limit: '', closing_day: '', due_day: '' });
      loadCards();
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

  const handleDelete = async (card: CreditCardRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Excluir o cartão "${card.name}"?`)) return;
    try {
      const { error } = await supabase.from('credit_cards').delete().eq('id', card.id);
      if (error) throw error;
      toast.success('Cartão excluído!');
      if (selectedCard?.id === card.id) setSelectedCard(null);
      loadCards();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingCard(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank" required />
          </div>
          <div className="space-y-1.5">
            <Label>Limite (R$)</Label>
            <Input type="number" step="0.01" value={form.card_limit} onChange={e => setForm({ ...form, card_limit: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dia de Fechamento</Label>
              <Input type="number" min="1" max="31" value={form.closing_day} onChange={e => setForm({ ...form, closing_day: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Dia de Vencimento</Label>
              <Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm({ ...form, due_day: e.target.value })} required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCard ? 'Salvar' : 'Criar Cartão'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }

  if (selectedCard) {
    return (
      <>
        {dialog}
        <CardDetailView
          card={selectedCard}
          contacts={contacts}
          onBack={() => setSelectedCard(null)}
          onEdit={() => openEdit(selectedCard)}
          onDelete={() => handleDelete(selectedCard)}
        />
      </>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Cartões</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      {dialog}

      {cards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum cartão cadastrado
          </CardContent>
        </Card>
      ) : (
        cards.map(card => (
          <Card key={card.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedCard(card)}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCardIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{card.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Fecha dia {card.closing_day} • Limite {formatCurrency(Number(card.card_limit))}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(card, e)} aria-label="Editar cartão">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => handleDelete(card, e)} aria-label="Excluir cartão">
                  <Trash2 className="h-3 w-3" />
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default Cards;
