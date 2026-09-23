/**
 * anomalyWatchdogService.ts
 * Motor Heurístico de Auditoria Financeira & Sentinela Proativo (FinMaster v1.4.0)
 * 100% Client-Side, Zero Latency, Zero Token Tax.
 */

export type AnomalyType = 'duplicate_charge' | 'expense_spike' | 'bank_fee' | 'silent_leak';
export type AnomalySeverity = 'high' | 'medium' | 'low';

export interface TransactionInput {
  id?: string;
  amount: number;
  type: string;
  description: string;
  date: string;
  category_id?: string | null;
  category_name?: string;
  is_paid?: boolean;
}

export interface AnomalyAlert {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  impactAmount: number;
  date: string;
  transactionIds: string[];
  categoryName?: string;
  aiPrompt: string;
  metadata?: {
    originalAmount?: number;
    baselineAverage?: number;
    percentageIncrease?: number;
    count?: number;
  };
}

export interface WatchdogSummary {
  alerts: AnomalyAlert[];
  totalAtRisk: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
}

export interface WatchdogRunParams {
  transactions: TransactionInput[];
  monthlyIncome?: number;
  monthExpense?: number;
  categoryMap?: Map<string, string>; // category_id -> name
}

const DISMISSED_KEY = 'finmaster_dismissed_anomalies';

/**
 * Retorna o conjunto de IDs de anomalias dispensadas pelo usuário
 */
export function getDismissedAnomalyIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

/**
 * Registra o descarte de uma anomalia específica para não re-alertar
 */
export function dismissAnomaly(id: string): void {
  try {
    const current = getDismissedAnomalyIds();
    current.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // Silently ignore storage quota/access errors
  }
}

/**
 * Limpa todos os descartes de anomalia (útil para resets e testes)
 */
export function clearDismissedAnomalies(): void {
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Normaliza descrições removendo pontuações, espaços duplos e numerações de parcelas
 */
export function normalizeDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s*\(\d+\/\d+\)/g, '') // remove (1/12)
    .replace(/\s*\d+\/\d+/g, '') // remove 1/12
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Algoritmo 1: Detecção de Cobranças Duplicadas
 * Identifica despesas com valores idênticos (ou delta < 0.05) e descrições idênticas em janela <= 72h.
 */
export function detectDuplicateCharges(
  transactions: TransactionInput[],
  dismissedIds: Set<string>
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const expenses = transactions
    .filter(t => t.type === 'expense' && Number(t.amount) > 0 && t.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const visitedPairs = new Set<string>();

  for (let i = 0; i < expenses.length; i++) {
    const t1 = expenses[i];
    const d1 = new Date(t1.date).getTime();
    const desc1 = normalizeDescription(t1.description);
    const amount1 = Number(t1.amount);

    for (let j = i + 1; j < expenses.length; j++) {
      const t2 = expenses[j];
      const d2 = new Date(t2.date).getTime();
      const deltaDays = (d2 - d1) / (1000 * 60 * 60 * 24);

      // Janela móvel de no máximo 3 dias (72 horas)
      if (deltaDays > 3) break;

      const desc2 = normalizeDescription(t2.description);
      const amount2 = Number(t2.amount);

      const isSameAmount = Math.abs(amount1 - amount2) <= 0.05;
      const isSameDesc = desc1 === desc2 || (desc1.length > 4 && (desc1.includes(desc2) || desc2.includes(desc1)));

      if (isSameAmount && isSameDesc) {
        const id1 = t1.id || `idx-${i}`;
        const id2 = t2.id || `idx-${j}`;
        const pairKey = [id1, id2].sort().join('_');

        if (!visitedPairs.has(pairKey)) {
          visitedPairs.add(pairKey);
          const alertId = `dup_${pairKey}`;

          if (!dismissedIds.has(alertId)) {
            const formattedAmount = amount2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            alerts.push({
              id: alertId,
              type: 'duplicate_charge',
              severity: 'high',
              title: 'Cobrança Duplicada Detectada',
              description: `Duas cobranças idênticas de ${formattedAmount} para "${t2.description}" em intervalo de ${Math.round(deltaDays)} dia(s).`,
              impactAmount: amount2,
              date: t2.date,
              transactionIds: [id1, id2],
              categoryName: t2.category_name,
              aiPrompt: `Identifiquei uma cobrança duplicada da despesa "${t2.description}" no valor de ${formattedAmount} em datas próximas (${t1.date} e ${t2.date}). Como posso contestar junto à instituição ou estabelecimento de forma rápida e solicitar estorno?`,
              metadata: {
                originalAmount: amount1,
                count: 2,
              },
            });
          }
        }
      }
    }
  }

  return alerts;
}

/**
 * Algoritmo 2: Salto Atípico de Despesas Fixas (>20% acima da média histórica)
 */
export function detectExpenseSpikes(
  transactions: TransactionInput[],
  dismissedIds: Set<string>,
  categoryMap?: Map<string, string>
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Agrupa despesas por chave (categoria ou descrição recorrente) e mês
  const monthlyTotals = new Map<string, Map<string, { total: number; txIds: string[]; sampleTx: TransactionInput }>>();

  const expenses = transactions.filter(t => t.type === 'expense' && Number(t.amount) > 0 && t.date);

  for (const t of expenses) {
    const txDate = new Date(t.date);
    if (isNaN(txDate.getTime())) continue;

    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    const categoryName = (t.category_id && categoryMap?.get(t.category_id)) || t.category_name || 'Outros';
    
    // Usamos descrição normalizada para serviços específicos (luz, condomínio, aluguel, internet) ou nome da categoria
    const normDesc = normalizeDescription(t.description);
    const key = normDesc.length >= 4 ? normDesc : categoryName;

    if (!monthlyTotals.has(key)) {
      monthlyTotals.set(key, new Map());
    }

    const monthMap = monthlyTotals.get(key)!;
    const existing = monthMap.get(monthKey) || { total: 0, txIds: [], sampleTx: t };
    existing.total += Number(t.amount);
    if (t.id) existing.txIds.push(t.id);
    monthMap.set(monthKey, existing);
  }

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  for (const [key, monthMap] of monthlyTotals.entries()) {
    const currentData = monthMap.get(currentMonthKey);
    if (!currentData || currentData.total < 30) continue; // Ignora valores irrisórios

    // Coleta meses anteriores (até 5 meses para média confiável)
    const pastTotals: number[] = [];
    for (const [mKey, data] of monthMap.entries()) {
      if (mKey !== currentMonthKey && data.total > 0) {
        pastTotals.push(data.total);
      }
    }

    // Exige ao menos 2 meses históricos para formar linha de base
    if (pastTotals.length >= 2) {
      const avg = pastTotals.reduce((a, b) => a + b, 0) / pastTotals.length;
      const increase = currentData.total - avg;
      const percentageIncrease = Math.round((increase / avg) * 100);

      // Salto superior a 20% com impacto absoluto de no mínimo R$ 25
      if (percentageIncrease >= 20 && increase >= 25) {
        const alertId = `spike_${key}_${currentMonthKey}`;
        if (!dismissedIds.has(alertId)) {
          const sampleName = currentData.sampleTx.description || key;
          const formattedCurrent = currentData.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const formattedAvg = avg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const formattedDiff = increase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          alerts.push({
            id: alertId,
            type: 'expense_spike',
            severity: 'medium',
            title: 'Salto Atípico de Despesa Recorrente',
            description: `Gastos com "${sampleName}" somaram ${formattedCurrent} este mês (+${percentageIncrease}% acima da média histórica de ${formattedAvg}). Excedente: ${formattedDiff}.`,
            impactAmount: Math.round(increase * 100) / 100,
            date: currentData.sampleTx.date,
            transactionIds: currentData.txIds,
            categoryName: currentData.sampleTx.category_name,
            aiPrompt: `Minha despesa recorrente com "${sampleName}" saltou de uma média de ${formattedAvg} para ${formattedCurrent} (+${percentageIncrease}%) este mês. Quais pontos devo auditar nesta fatura e como posso renegociar essa conta?`,
            metadata: {
              originalAmount: currentData.total,
              baselineAverage: Math.round(avg * 100) / 100,
              percentageIncrease,
            },
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Algoritmo 3: Sentinela de Tarifas Bancárias e Juros
 */
const BANK_FEE_REGEX = /(tarifa|tar\b|anuidade|iof|encargos|juros|rotativo|multa\s+atraso|taxa\s+manuten|ted\b|doc\b|cheque\s+especial)/i;

export function detectBankFeesAndInterest(
  transactions: TransactionInput[],
  dismissedIds: Set<string>
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35);

  const feeTxs = transactions.filter(t => {
    if (t.type !== 'expense' || Number(t.amount) <= 0 || !t.date) return false;
    const txDate = new Date(t.date);
    if (txDate < thirtyDaysAgo) return false;
    return BANK_FEE_REGEX.test(t.description || '');
  });

  if (feeTxs.length === 0) return alerts;

  const totalFeeAmount = feeTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const txIds = feeTxs.map(t => t.id).filter((id): id is string => Boolean(id));

  // Alerta consolidado mensal de tarifas bancárias
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const alertId = `bank_fees_${monthKey}`;

  if (totalFeeAmount >= 15 && !dismissedIds.has(alertId)) {
    const hasInterest = feeTxs.some(t => /(juros|rotativo|multa|cheque\s+especial)/i.test(t.description));
    const formattedTotal = totalFeeAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    alerts.push({
      id: alertId,
      type: 'bank_fee',
      severity: hasInterest ? 'high' : 'medium',
      title: hasInterest ? 'Juros ou Encargos Bancários Detectados' : 'Tarifas Bancárias Acumuladas',
      description: `Foram identificados ${formattedTotal} em tarifas, juros ou encargos bancários nos últimos 30 dias (${feeTxs.length} lançamento(s)).`,
      impactAmount: Math.round(totalFeeAmount * 100) / 100,
      date: feeTxs[feeTxs.length - 1].date,
      transactionIds: txIds,
      aiPrompt: `Detectei cobranças de tarifas bancárias e encargos no valor de ${formattedTotal} nos últimos 30 dias. Com base nas resoluções do Banco Central (como a Resolução 3.919 sobre conta essencial gratuita) e direitos do consumidor, quais argumentos e procedimentos práticos posso usar para solicitar o cancelamento e reembolso dessas cobranças?`,
      metadata: {
        originalAmount: totalFeeAmount,
        count: feeTxs.length,
      },
    });
  }

  return alerts;
}

/**
 * Algoritmo 4: Alerta de Vazamentos Silenciosos (Micro-gastos)
 * Analisa microtransações (<= R$ 35) no mês atual que somadas ultrapassam 15% das despesas totais.
 */
export function detectSilentLeaks(
  transactions: TransactionInput[],
  monthExpense: number = 0,
  dismissedIds: Set<string>
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthExpenses = transactions.filter(t => {
    return t.type === 'expense' && Number(t.amount) > 0 && t.date && t.date.startsWith(currentMonthPrefix);
  });

  const microExpenses = currentMonthExpenses.filter(t => Number(t.amount) <= 35);
  const microTotal = microExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = monthExpense > 0 ? monthExpense : currentMonthExpenses.reduce((s, t) => s + Number(t.amount), 0);

  if (totalExpenses <= 0 || microTotal < 120) return alerts;

  const microPercentage = Math.round((microTotal / totalExpenses) * 100);

  // Se microtransações representam 15% ou mais do custo de vida mensal
  if (microPercentage >= 15) {
    const alertId = `leak_${currentMonthPrefix}`;
    if (!dismissedIds.has(alertId)) {
      const formattedMicro = microTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const potentialHalf = (microTotal * 0.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      alerts.push({
        id: alertId,
        type: 'silent_leak',
        severity: 'low',
        title: 'Vazamento Silencioso (Micro-gastos)',
        description: `Pequenas despesas de até R$ 35 já somam ${formattedMicro} este mês (${microPercentage}% de todas as despesas em ${microExpenses.length} compras).`,
        impactAmount: Math.round(microTotal * 0.5 * 100) / 100, // Potencial de economia de 50%
        date: now.toISOString().split('T')[0],
        transactionIds: microExpenses.map(t => t.id).filter((id): id is string => Boolean(id)),
        aiPrompt: `Meus pequenos gastos de até R$ 35,00 somam ${formattedMicro} este mês (${microPercentage}% do total de despesas). Como posso reestruturar meus hábitos cotidianos para economizar cerca de ${potentialHalf} por mês sem sensação de privação extrema?`,
        metadata: {
          originalAmount: microTotal,
          baselineAverage: totalExpenses,
          percentageIncrease: microPercentage,
          count: microExpenses.length,
        },
      });
    }
  }

  return alerts;
}

/**
 * Executa o motor completo do Sentinela de Anomalias
 */
export function runAnomalyWatchdog(params: WatchdogRunParams): WatchdogSummary {
  const { transactions = [], monthExpense = 0, categoryMap } = params;
  const dismissedIds = getDismissedAnomalyIds();

  const duplicates = detectDuplicateCharges(transactions, dismissedIds);
  const spikes = detectExpenseSpikes(transactions, dismissedIds, categoryMap);
  const bankFees = detectBankFeesAndInterest(transactions, dismissedIds);
  const leaks = detectSilentLeaks(transactions, monthExpense, dismissedIds);

  const allAlerts = [...duplicates, ...spikes, ...bankFees, ...leaks];

  // Ordena por severidade (high -> medium -> low) e valor de impacto
  const severityOrder: Record<AnomalySeverity, number> = { high: 3, medium: 2, low: 1 };
  allAlerts.sort((a, b) => {
    const diff = severityOrder[b.severity] - severityOrder[a.severity];
    if (diff !== 0) return diff;
    return b.impactAmount - a.impactAmount;
  });

  const totalAtRisk = allAlerts.reduce((sum, a) => sum + a.impactAmount, 0);

  return {
    alerts: allAlerts,
    totalAtRisk: Math.round(totalAtRisk * 100) / 100,
    highSeverityCount: allAlerts.filter(a => a.severity === 'high').length,
    mediumSeverityCount: allAlerts.filter(a => a.severity === 'medium').length,
    lowSeverityCount: allAlerts.filter(a => a.severity === 'low').length,
  };
}
