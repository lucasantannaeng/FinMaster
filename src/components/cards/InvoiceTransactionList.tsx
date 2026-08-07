import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, SearchX, Users, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/lib/validation';

interface Tx {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  type?: string;
  category_id?: string | null;
  contact_id?: string | null;
  is_paid?: boolean;
  installment_number?: number | null;
  total_installments?: number | null;
}

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface Contact {
  id: string;
  name: string;
}

interface InvoiceTransactionListProps {
  transactions: Tx[];
  categories: Category[];
  contacts: Contact[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  totalTransactions: number;
}

const EmptyState = ({ icon: Icon, title }: { icon: typeof Receipt; title: string }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
    <Icon className="h-10 w-10 mb-2 opacity-50" />
    <p className="text-sm">{title}</p>
  </div>
);

const InvoiceTransactionList = ({
  transactions,
  categories,
  contacts,
  isLoading,
  hasActiveFilters,
  totalTransactions,
}: InvoiceTransactionListProps) => {
  const queryClient = useQueryClient();
  const [togglingTxId, setTogglingTxId] = useState<string | null>(null);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const markPaid = async (tx: Tx) => {
    setTogglingTxId(tx.id);
    try {
      const { error } = await supabase.from('transactions').update({ is_paid: true }).eq('id', tx.id);
      if (error) throw error;

      // Contact balance only counts paid transactions → apply contribution now.
      if (tx.contact_id) {
        const amount = Number(tx.amount);
        const delta = tx.type === 'expense' ? amount : -amount;
        await supabase.rpc('update_contact_balance', { p_contact_id: tx.contact_id, p_delta: delta });
      }

      toast.success('Lançamento marcado como pago!');
      await queryClient.invalidateQueries({ queryKey: ['card-invoice'] });
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setTogglingTxId(null);
    }
  };

  const contactGroups = useMemo(() => {
    const groups = new Map<string, { name: string; total: number; txs: Tx[] }>();
    transactions.forEach((tx) => {
      if (!tx.contact_id) return;
      const name = contactMap.get(tx.contact_id)?.name || 'Desconhecido';
      const g = groups.get(tx.contact_id) || { name, total: 0, txs: [] };
      g.total += Number(tx.amount);
      g.txs.push(tx);
      groups.set(tx.contact_id, g);
    });
    return groups;
  }, [transactions, contactMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const renderEmpty = () => {
    if (totalTransactions === 0) {
      return <EmptyState icon={Receipt} title="Nenhuma transação nesta fatura" />;
    }
    if (hasActiveFilters) {
      return <EmptyState icon={SearchX} title="Nenhum resultado para os filtros aplicados" />;
    }
    return <EmptyState icon={Receipt} title="Nenhuma transação para exibir" />;
  };

  const renderPayCheckbox = (tx: Tx) => {
    if (tx.is_paid !== false) return null;
    return (
      <Checkbox
        checked={false}
        disabled={togglingTxId === tx.id}
        onCheckedChange={(v) => v === true && markPaid(tx)}
        aria-label="Marcar como pago"
        className="shrink-0"
      />
    );
  };

  return (
    <Tabs defaultValue="all">
      <TabsList className="w-full">
        <TabsTrigger value="all" className="flex-1">
          Todas {transactions.length > 0 && `(${transactions.length})`}
        </TabsTrigger>
        <TabsTrigger value="contacts" className="flex-1">
          Terceiros {contactGroups.size > 0 && `(${contactGroups.size})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-2 mt-2">
        {transactions.length === 0 ? (
          renderEmpty()
        ) : (
          transactions.map((tx) => {
            const category = tx.category_id ? categoryMap.get(tx.category_id) : null;
            const installmentLabel =
              tx.installment_number && tx.total_installments
                ? ` • ${tx.installment_number}/${tx.total_installments}`
                : '';
            return (
              <Card key={tx.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  {renderPayCheckbox(tx)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      {tx.is_paid === false && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      {category && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: category.color || 'currentColor' }}
                          />
                          {category.name}
                        </span>
                      )}
                      <span>• {formatDate(tx.date)}{installmentLabel}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-destructive shrink-0">
                    -{formatCurrency(Number(tx.amount))}
                  </span>
                </CardContent>
              </Card>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="contacts" className="space-y-3 mt-2">
        <h2 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> Gastos de Terceiros na Fatura
        </h2>
        {contactGroups.size === 0 ? (
          <EmptyState icon={Users} title="Nenhum gasto de terceiro nesta fatura" />
        ) : (
          Array.from(contactGroups.entries()).map(([contactId, group]) => (
            <Card key={contactId}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{group.name}</span>
                  <span className="font-semibold text-sm text-destructive">
                    -{formatCurrency(group.total)}
                  </span>
                </div>
                <div className="space-y-1 pl-2 border-l-2 border-border">
                  {group.txs.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {renderPayCheckbox(tx)}
                        <span className="truncate">{tx.description} • {formatDate(tx.date)}</span>
                        {tx.is_paid === false && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 shrink-0">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <span className="shrink-0 ml-2">-{formatCurrency(Number(tx.amount))}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
};

export default InvoiceTransactionList;
