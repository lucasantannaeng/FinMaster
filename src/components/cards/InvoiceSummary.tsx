import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InvoiceStatus } from '@/hooks/useBillingPeriod';

interface InvoiceSummaryProps {
  totalBill: number;
  cardLimit: number;
  startDate: Date;
  endDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  closingDay: number;
  dueDay: number;
}

const STATUS_META: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  open: { label: 'Aberta', variant: 'secondary' },
  closed: { label: 'Fechada', variant: 'default' },
  overdue: { label: 'Vencida', variant: 'destructive' },
};

const fmt = (d: Date) => format(d, "dd 'de' MMM", { locale: ptBR });

const InvoiceSummary = ({
  totalBill,
  cardLimit,
  startDate,
  endDate,
  dueDate,
  status,
  closingDay,
  dueDay,
}: InvoiceSummaryProps) => {
  const usagePercent = cardLimit > 0 ? (totalBill / cardLimit) * 100 : 0;
  const meta = STATUS_META[status];

  return (
    <Card className="border-0 bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm opacity-80">Total da fatura</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        <p className="text-3xl font-bold tracking-tight">{formatCurrency(totalBill)}</p>

        <div className="flex flex-wrap items-center justify-between gap-1 text-xs opacity-70">
          <span>{fmt(startDate)} — {fmt(endDate)}</span>
          <span>Fecha dia {closingDay} • Vence {format(dueDate, "dd/MM", { locale: ptBR })}</span>
        </div>

        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs opacity-70">
            <span>Limite usado</span>
            <span>{formatCurrency(totalBill)} / {formatCurrency(cardLimit)}</span>
          </div>
          <Progress value={Math.min(usagePercent, 100)} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceSummary;
