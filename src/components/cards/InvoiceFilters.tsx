import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { InvoiceFiltersState, PaidFilter } from '@/hooks/useCardInvoice';

interface InvoiceFiltersProps {
  filters: InvoiceFiltersState;
  setFilters: (next: InvoiceFiltersState) => void;
  categories: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string }>;
  hasActiveFilters: boolean;
  onReset: () => void;
}

const InvoiceFilters = ({ filters, setFilters, categories, contacts, hasActiveFilters, onReset }: InvoiceFiltersProps) => {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Buscar por descrição..."
          className="pl-9 pr-9 h-9"
        />
        {filters.search && (
          <button
            onClick={() => setFilters({ ...filters, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={filters.categoryId}
          onValueChange={(v) => setFilters({ ...filters, categoryId: v })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.paid}
          onValueChange={(v) => setFilters({ ...filters, paid: v as PaidFilter })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="unpaid">Pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select
        value={filters.contactId}
        onValueChange={(v) => setFilters({ ...filters, contactId: v })}
      >
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="Pessoa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as pessoas</SelectItem>
          <SelectItem value="none">Somente meus gastos</SelectItem>
          {contacts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>


      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs w-full">
          <X className="h-3 w-3 mr-1" /> Limpar filtros
        </Button>
      )}
    </div>
  );
};

export default InvoiceFilters;
