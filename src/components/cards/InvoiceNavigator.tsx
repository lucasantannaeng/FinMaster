import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface InvoiceNavigatorProps {
  label: string;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const InvoiceNavigator = ({
  label,
  isCurrentMonth,
  onPrev,
  onNext,
  onToday,
}: InvoiceNavigatorProps) => {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-2 py-2">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onPrev} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex flex-col items-center text-center">
        <span className="text-sm font-semibold leading-tight">{label}</span>
        {!isCurrentMonth && (
          <button
            onClick={onToday}
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <CalendarDays className="h-3 w-3" />
            Voltar para hoje
          </button>
        )}
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onNext} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default InvoiceNavigator;
