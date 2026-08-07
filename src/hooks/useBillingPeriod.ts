import { useCallback, useMemo, useState } from 'react';
import {
  addMonths,
  subMonths,
  setDate,
  endOfMonth,
  format,
  isAfter,
  startOfDay,
  min as minDate,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type InvoiceStatus = 'open' | 'closed' | 'overdue';

/**
 * Clamps a day to the last valid day of the given month.
 * Ex: setSafeDate(2026-02-15, 31) → 2026-02-28
 */
const setSafeDate = (base: Date, day: number): Date => {
  const lastDay = endOfMonth(base);
  return minDate([setDate(base, day), lastDay]);
};

export interface BillingPeriod {
  viewingDate: Date;
  /** Inclusive start date of the invoice window (day after previous closing) */
  startDate: Date;
  /** Inclusive end date of the invoice window (closing day of viewing month) */
  endDate: Date;
  /** Closing date for this invoice (== endDate) */
  closingDate: Date;
  /** Due date for this invoice */
  dueDate: Date;
  /** Status badge: open | closed | overdue */
  status: InvoiceStatus;
  /** Pretty label, ex: "Fatura de Junho 2026" */
  label: string;
  /** YYYY-MM-DD strings for Supabase queries */
  startDateStr: string;
  endDateStr: string;
  isCurrentMonth: boolean;
  goNext: () => void;
  goPrev: () => void;
  goToCurrentMonth: () => void;
}

/**
 * Computes the credit-card invoice window for a given month based on the
 * card's closing day. Navigates month-by-month (past and future).
 *
 * Window definition:
 *   endDate   = closingDay of viewingDate's month  (clamped to month length)
 *   startDate = closingDay of previous month + 1 day (clamped)
 *
 * Example: viewingDate=Jun/2026, closingDay=10 → 11/Mai/2026 — 10/Jun/2026
 */
export const useBillingPeriod = (closingDay: number, dueDay: number): BillingPeriod => {
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date());

  const goNext = useCallback(() => setViewingDate((d) => addMonths(d, 1)), []);
  const goPrev = useCallback(() => setViewingDate((d) => subMonths(d, 1)), []);
  const goToCurrentMonth = useCallback(() => setViewingDate(new Date()), []);

  return useMemo(() => {
    const safeClosing = Math.min(Math.max(closingDay, 1), 31);
    const safeDue = Math.min(Math.max(dueDay, 1), 31);

    const closingDate = startOfDay(setSafeDate(viewingDate, safeClosing));
    const prevMonth = subMonths(viewingDate, 1);
    const prevClosing = setSafeDate(prevMonth, safeClosing);
    const startDate = startOfDay(addMonths(prevClosing, 0));
    // start = day AFTER previous closing
    startDate.setDate(prevClosing.getDate() + 1);

    const dueDate = startOfDay(setSafeDate(viewingDate, safeDue));

    const today = startOfDay(new Date());
    let status: InvoiceStatus = 'open';
    if (isAfter(today, dueDate)) status = 'overdue';
    else if (isAfter(today, closingDate)) status = 'closed';

    const label = `Fatura de ${format(viewingDate, "MMMM 'de' yyyy", { locale: ptBR })}`;
    const now = new Date();
    const isCurrentMonth =
      viewingDate.getMonth() === now.getMonth() && viewingDate.getFullYear() === now.getFullYear();

    return {
      viewingDate,
      startDate,
      endDate: closingDate,
      closingDate,
      dueDate,
      status,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      startDateStr: format(startDate, 'yyyy-MM-dd'),
      endDateStr: format(closingDate, 'yyyy-MM-dd'),
      isCurrentMonth,
      goNext,
      goPrev,
      goToCurrentMonth,
    };
  }, [viewingDate, closingDay, dueDay, goNext, goPrev, goToCurrentMonth]);
};
