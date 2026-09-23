import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectDuplicateCharges,
  detectExpenseSpikes,
  detectBankFeesAndInterest,
  detectSilentLeaks,
  runAnomalyWatchdog,
  dismissAnomaly,
  clearDismissedAnomalies,
  getDismissedAnomalyIds,
  normalizeDescription,
  TransactionInput,
} from '@/services/anomalyWatchdogService';

describe('Watchdog Proativo de Anomalias & Cobranças Duplicadas (FinMaster v1.4.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDismissedAnomalies();
  });

  describe('normalizeDescription', () => {
    it('deve remover acentos, pontuações e numerações de parcelas', () => {
      expect(normalizeDescription('Farmácia São Paulo (02/12)')).toBe('farmacia sao paulo');
      expect(normalizeDescription('MERCADO EXTRA LTDA - PARC 1/3')).toBe('mercado extra ltda parc');
      expect(normalizeDescription('NETFLIX.COM* 1234')).toBe('netflixcom 1234');
    });
  });

  describe('detectDuplicateCharges (Cobranças Duplicadas)', () => {
    it('deve detectar duas cobranças idênticas em janela de até 72 horas', () => {
      const txs: TransactionInput[] = [
        {
          id: 'tx-1',
          description: 'Padaria Bella Vista',
          amount: 48.50,
          type: 'expense',
          date: '2026-09-20',
        },
        {
          id: 'tx-2',
          description: 'Padaria Bella Vista',
          amount: 48.50,
          type: 'expense',
          date: '2026-09-21',
        },
      ];

      const alerts = detectDuplicateCharges(txs, new Set());
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('duplicate_charge');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].impactAmount).toBe(48.50);
      expect(alerts[0].transactionIds).toContain('tx-1');
      expect(alerts[0].transactionIds).toContain('tx-2');
    });

    it('não deve alertar para cobranças com intervalo maior que 3 dias (legítimas)', () => {
      const txs: TransactionInput[] = [
        {
          id: 'tx-1',
          description: 'Supermercado Pão de Açúcar',
          amount: 150.00,
          type: 'expense',
          date: '2026-09-01',
        },
        {
          id: 'tx-2',
          description: 'Supermercado Pão de Açúcar',
          amount: 150.00,
          type: 'expense',
          date: '2026-09-15',
        },
      ];

      const alerts = detectDuplicateCharges(txs, new Set());
      expect(alerts.length).toBe(0);
    });

    it('não deve alertar se os valores forem substancialmente diferentes', () => {
      const txs: TransactionInput[] = [
        {
          id: 'tx-1',
          description: 'Restaurante Sabor',
          amount: 60.00,
          type: 'expense',
          date: '2026-09-20',
        },
        {
          id: 'tx-2',
          description: 'Restaurante Sabor',
          amount: 95.00,
          type: 'expense',
          date: '2026-09-20',
        },
      ];

      const alerts = detectDuplicateCharges(txs, new Set());
      expect(alerts.length).toBe(0);
    });
  });

  describe('detectExpenseSpikes (Salto Atípico de Despesas Fixas)', () => {
    it('deve alertar quando uma despesa recorrente subir > 20% acima da média histórica', () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

      // 3 meses anteriores com média de R$ 100
      const txs: TransactionInput[] = [
        { id: 'm1', description: 'Conta de Luz Enel', amount: 100, type: 'expense', date: `${currentYear}-06-10` },
        { id: 'm2', description: 'Conta de Luz Enel', amount: 105, type: 'expense', date: `${currentYear}-07-10` },
        { id: 'm3', description: 'Conta de Luz Enel', amount: 95, type: 'expense', date: `${currentYear}-08-10` },
        // Mês atual saltou para R$ 160 (+60%)
        { id: 'm4', description: 'Conta de Luz Enel', amount: 160, type: 'expense', date: `${currentYear}-${currentMonth}-05` },
      ];

      const alerts = detectExpenseSpikes(txs, new Set());
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('expense_spike');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].impactAmount).toBe(60);
      expect(alerts[0].metadata?.percentageIncrease).toBeGreaterThanOrEqual(50);
    });

    it('não deve alertar se o aumento for moderado (ex: menor que 20%)', () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

      const txs: TransactionInput[] = [
        { id: 'm1', description: 'Plano Celular Vivo', amount: 80, type: 'expense', date: `${currentYear}-06-10` },
        { id: 'm2', description: 'Plano Celular Vivo', amount: 80, type: 'expense', date: `${currentYear}-07-10` },
        { id: 'm3', description: 'Plano Celular Vivo', amount: 80, type: 'expense', date: `${currentYear}-08-10` },
        { id: 'm4', description: 'Plano Celular Vivo', amount: 88, type: 'expense', date: `${currentYear}-${currentMonth}-05` }, // +10%
      ];

      const alerts = detectExpenseSpikes(txs, new Set());
      expect(alerts.length).toBe(0);
    });
  });

  describe('detectBankFeesAndInterest (Tarifas e Juros)', () => {
    it('deve identificar tarifas bancárias e sinalizar alta severidade quando envolver juros/rotativo', () => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];

      const txs: TransactionInput[] = [
        { id: 'f1', description: 'Tarifa Pacote Serviços Itaú', amount: 49.90, type: 'expense', date: currentDate },
        { id: 'f2', description: 'Juros de Cartão de Crédito', amount: 85.00, type: 'expense', date: currentDate },
      ];

      const alerts = detectBankFeesAndInterest(txs, new Set());
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('bank_fee');
      expect(alerts[0].severity).toBe('high'); // Contém juros
      expect(alerts[0].impactAmount).toBe(134.90);
      expect(alerts[0].transactionIds).toContain('f1');
      expect(alerts[0].transactionIds).toContain('f2');
    });

    it('não deve alertar se o montante total de tarifas for irrisório (< R$ 15)', () => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];

      const txs: TransactionInput[] = [
        { id: 'f1', description: 'IOF Transação Exterior', amount: 2.50, type: 'expense', date: currentDate },
      ];

      const alerts = detectBankFeesAndInterest(txs, new Set());
      expect(alerts.length).toBe(0);
    });
  });

  describe('detectSilentLeaks (Vazamentos Silenciosos)', () => {
    it('deve alertar se micro-gastos (<= R$ 35) somarem mais de 15% do orçamento do mês', () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const date = `${currentYear}-${currentMonth}-15`;

      // 10 micro-despesas de R$ 25 = R$ 250
      const microTxs: TransactionInput[] = Array.from({ length: 10 }).map((_, i) => ({
        id: `micro-${i}`,
        description: `Lanche / Café ${i}`,
        amount: 25,
        type: 'expense',
        date,
      }));

      // Total mensal: R$ 1000 (R$ 250 = 25% > 15%)
      const alerts = detectSilentLeaks(microTxs, 1000, new Set());
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('silent_leak');
      expect(alerts[0].severity).toBe('low');
      expect(alerts[0].impactAmount).toBe(125); // 50% de R$ 250
      expect(alerts[0].metadata?.percentageIncrease).toBe(25);
    });
  });

  describe('Persistência de Descarte e Execução Geral (runAnomalyWatchdog)', () => {
    it('deve respeitar anomalias ignoradas salvas no localStorage', () => {
      const txs: TransactionInput[] = [
        { id: 'tx-1', description: 'Spotify Brasil', amount: 34.90, type: 'expense', date: '2026-09-20' },
        { id: 'tx-2', description: 'Spotify Brasil', amount: 34.90, type: 'expense', date: '2026-09-20' },
      ];

      const initialSummary = runAnomalyWatchdog({ transactions: txs });
      expect(initialSummary.alerts.length).toBe(1);

      const alertId = initialSummary.alerts[0].id;
      dismissAnomaly(alertId);

      expect(getDismissedAnomalyIds().has(alertId)).toBe(true);

      const updatedSummary = runAnomalyWatchdog({ transactions: txs });
      expect(updatedSummary.alerts.length).toBe(0);
      expect(updatedSummary.totalAtRisk).toBe(0);
    });
  });
});
