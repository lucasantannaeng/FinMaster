import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PaidFilter = 'all' | 'paid' | 'unpaid';

export interface InvoiceFiltersState {
  search: string;
  categoryId: string; // 'all' or category uuid
  paid: PaidFilter;
  contactId: string; // 'all' | 'none' | contact uuid
}

export const defaultFilters: InvoiceFiltersState = {
  search: '',
  categoryId: 'all',
  paid: 'all',
  contactId: 'all',
};

interface UseCardInvoiceParams {
  cardId: string | null;
  startDateStr: string;
  endDateStr: string;
}

const fetchInvoiceTransactions = async (cardId: string, start: string, end: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('card_id', cardId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchCategories = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
};

export const useCardInvoice = ({ cardId, startDateStr, endDateStr }: UseCardInvoiceParams) => {
  const [filters, setFilters] = useState<InvoiceFiltersState>(defaultFilters);

  const transactionsQuery = useQuery({
    queryKey: ['card-invoice', cardId, startDateStr, endDateStr],
    queryFn: () => fetchInvoiceTransactions(cardId!, startDateStr, endDateStr),
    enabled: !!cardId,
    staleTime: 30_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const transactions = useMemo(() => transactionsQuery.data || [], [transactionsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);


  // Total bill = ALL transactions in window (filters don't shrink the invoice total)
  const totalBill = useMemo(
    () => transactions.reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions],
  );

  const filteredTransactions = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (search && !String(tx.description ?? '').toLowerCase().includes(search)) return false;
      if (filters.categoryId !== 'all' && tx.category_id !== filters.categoryId) return false;
      if (filters.paid === 'paid' && !tx.is_paid) return false;
      if (filters.paid === 'unpaid' && tx.is_paid) return false;
      if (filters.contactId === 'none' && tx.contact_id) return false;
      if (filters.contactId !== 'all' && filters.contactId !== 'none' && tx.contact_id !== filters.contactId) return false;
      return true;
    });
  }, [transactions, filters]);

  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
    [filteredTransactions],
  );

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.categoryId !== 'all' ||
    filters.paid !== 'all' ||
    filters.contactId !== 'all';

  return {
    transactions,
    filteredTransactions,
    categories,
    totalBill,
    filteredTotal,
    isLoading: transactionsQuery.isLoading || categoriesQuery.isLoading,
    filters,
    setFilters,
    hasActiveFilters,
    resetFilters: () => setFilters(defaultFilters),
  };
};
