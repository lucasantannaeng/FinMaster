/**
 * Serviço de Projeção de Fluxo de Caixa (13-Week / 90-Day Cash Flow Forecast).
 * Modela a trajetória futura de liquidez com base no saldo atual,
 * parcelas futuras, proventos esperados e despesas recorrentes.
 */

export interface CashFlowDay {
  date: string; // YYYY-MM-DD
  dayLabel: string; // DD/MM
  projectedBalance: number;
  income: number;
  expense: number;
  events: Array<{ description: string; amount: number; type: 'income' | 'expense' }>;
}

export interface CashFlowForecastSummary {
  days: CashFlowDay[];
  currentBalance: number;
  finalBalance: number;
  lowestBalance: number;
  lowestBalanceDate: string;
  highestBalance: number;
  isAtRisk: boolean;
  totalProjectedIncome: number;
  totalProjectedExpense: number;
  netChange: number;
}

export function generateCashFlowForecast(
  initialBalance: number,
  futureTransactions: Array<{
    date: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    description: string;
    is_paid?: boolean;
    recurrence?: string | null;
  }>,
  daysToProject = 60
): CashFlowForecastSummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysMap = new Map<string, { income: number; expense: number; events: CashFlowDay['events'] }>();

  // Inicializa o mapa com todos os dias do horizonte
  for (let i = 0; i < daysToProject; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    daysMap.set(dateStr, { income: 0, expense: 0, events: [] });
  }

  // 1. Processa transações pontuais futuras ou a pagar
  for (const tx of futureTransactions) {
    if (tx.is_paid && tx.date < today.toISOString().split('T')[0]) {
      continue; // Já foi pago no passado
    }

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    // Transações pontuais dentro do horizonte
    if (daysMap.has(tx.date)) {
      const dayData = daysMap.get(tx.date)!;
      if (tx.type === 'income') {
        dayData.income += amt;
        dayData.events.push({ description: tx.description, amount: amt, type: 'income' });
      } else if (tx.type === 'expense') {
        dayData.expense += amt;
        dayData.events.push({ description: tx.description, amount: amt, type: 'expense' });
      }
    }

    // 2. Projeta recorrências (mensais e semanais)
    if (tx.recurrence === 'monthly' || tx.recurrence === 'weekly') {
      const origDate = new Date(tx.date);
      let nextDate = new Date(origDate);

      // Avança a data da recorrência até o horizonte projetado
      for (let cycle = 1; cycle <= (tx.recurrence === 'weekly' ? 12 : 3); cycle++) {
        if (tx.recurrence === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const nextDateStr = nextDate.toISOString().split('T')[0];
        if (daysMap.has(nextDateStr)) {
          const dayData = daysMap.get(nextDateStr)!;
          if (tx.type === 'income') {
            dayData.income += amt;
            dayData.events.push({ description: `(Recorrência) ${tx.description}`, amount: amt, type: 'income' });
          } else if (tx.type === 'expense') {
            dayData.expense += amt;
            dayData.events.push({ description: `(Recorrência) ${tx.description}`, amount: amt, type: 'expense' });
          }
        }
      }
    }
  }

  // 3. Constrói a curva de saldo acumulado
  let runningBalance = initialBalance;
  let lowestBalance = initialBalance;
  let lowestBalanceDate = today.toISOString().split('T')[0];
  let highestBalance = initialBalance;
  let totalIncome = 0;
  let totalExpense = 0;

  const resultDays: CashFlowDay[] = [];

  for (const [dateStr, dayData] of daysMap.entries()) {
    runningBalance += dayData.income - dayData.expense;
    totalIncome += dayData.income;
    totalExpense += dayData.expense;

    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance;
      lowestBalanceDate = dateStr;
    }
    if (runningBalance > highestBalance) {
      highestBalance = runningBalance;
    }

    const parts = dateStr.split('-');
    const dayLabel = `${parts[2]}/${parts[1]}`;

    resultDays.push({
      date: dateStr,
      dayLabel,
      projectedBalance: Math.round(runningBalance * 100) / 100,
      income: Math.round(dayData.income * 100) / 100,
      expense: Math.round(dayData.expense * 100) / 100,
      events: dayData.events,
    });
  }

  return {
    days: resultDays,
    currentBalance: initialBalance,
    finalBalance: runningBalance,
    lowestBalance,
    lowestBalanceDate,
    highestBalance,
    isAtRisk: lowestBalance < 0,
    totalProjectedIncome: totalIncome,
    totalProjectedExpense: totalExpense,
    netChange: runningBalance - initialBalance,
  };
}
