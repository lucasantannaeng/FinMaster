import { describe, it, expect, beforeEach } from 'vitest';
import {
  SavingsGoal,
  calculateMonthlyRequirement,
  addContribution,
  getStoredGoals,
  saveGoals,
  addGoal,
  deleteGoal,
} from '@/services/sinkingFundsService';
import { generateCashFlowForecast } from '@/services/cashFlowForecastService';

describe('Potes de Metas & Projeção de Fluxo de Caixa (Fase 3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Sinking Funds (Potes de Metas & Reservas)', () => {
    it('deve calcular o aporte mensal necessário e o progresso percentual', () => {
      // Cria uma meta para daqui a aproximadamente 5 meses
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 5);

      const goal: SavingsGoal = {
        id: 'goal-viagem',
        name: 'Viagem de Férias',
        targetAmount: 5000,
        currentAmount: 2000,
        targetDate: futureDate.toISOString().split('T')[0],
        category: 'Lazer',
        createdAt: '2026-01-01',
      };

      const req = calculateMonthlyRequirement(goal);

      expect(req.isCompleted).toBe(false);
      expect(req.remainingAmount).toBe(3000);
      expect(req.progressPercent).toBe(40);
      expect(req.monthlyAmount).toBeGreaterThan(0);
      expect(req.monthsRemaining).toBeGreaterThanOrEqual(4);
    });

    it('deve marcar meta como concluída quando o valor atual atingir ou superar a meta', () => {
      const goal: SavingsGoal = {
        id: 'goal-carro',
        name: 'Entrada Carro',
        targetAmount: 15000,
        currentAmount: 15000,
        targetDate: '2026-12-31',
        createdAt: '2026-01-01',
      };

      const req = calculateMonthlyRequirement(goal);
      expect(req.isCompleted).toBe(true);
      expect(req.remainingAmount).toBe(0);
      expect(req.monthlyAmount).toBe(0);
      expect(req.progressPercent).toBe(100);
    });

    it('deve adicionar aportes com precisão e atualizar o saldo da meta', () => {
      const created = addGoal({
        name: 'Reserva Oportunidade',
        targetAmount: 10000,
        currentAmount: 1000,
        targetDate: '2027-01-01',
      });

      expect(created.id).toBeDefined();

      const updated = addContribution(created.id, 500);
      expect(updated?.currentAmount).toBe(1500);

      const updatedAgain = addContribution(created.id, 250);
      expect(updatedAgain?.currentAmount).toBe(1750);
    });
  });

  describe('Projeção de Fluxo de Caixa (Cash Flow Forecast)', () => {
    it('deve calcular a trajetória diária de saldo com base no saldo inicial e eventos futuros', () => {
      const initialBalance = 10000;
      const today = new Date();

      const in5Days = new Date(today);
      in5Days.setDate(in5Days.getDate() + 5);

      const in10Days = new Date(today);
      in10Days.setDate(in10Days.getDate() + 10);

      const futureTxs = [
        {
          date: in5Days.toISOString().split('T')[0],
          amount: 2500,
          type: 'expense' as const,
          description: 'Fatura Nubank',
        },
        {
          date: in10Days.toISOString().split('T')[0],
          amount: 6000,
          type: 'income' as const,
          description: 'Salário Consultoria',
        },
      ];

      const forecast = generateCashFlowForecast(initialBalance, futureTxs, 30);

      expect(forecast.currentBalance).toBe(10000);
      expect(forecast.days).toHaveLength(30);
      expect(forecast.totalProjectedExpense).toBe(2500);
      expect(forecast.totalProjectedIncome).toBe(6000);
      expect(forecast.netChange).toBe(3500);
      expect(forecast.finalBalance).toBe(13500);
      expect(forecast.lowestBalance).toBe(7500); // 10000 - 2500
      expect(forecast.isAtRisk).toBe(false);
    });

    it('deve alertar risco de liquidez caso alguma despesa torne o saldo negativo', () => {
      const initialBalance = 1000;
      const today = new Date();

      const in3Days = new Date(today);
      in3Days.setDate(in3Days.getDate() + 3);

      const futureTxs = [
        {
          date: in3Days.toISOString().split('T')[0],
          amount: 3500,
          type: 'expense' as const,
          description: 'Manutenção Urgente Carro',
        },
      ];

      const forecast = generateCashFlowForecast(initialBalance, futureTxs, 15);

      expect(forecast.lowestBalance).toBe(-2500);
      expect(forecast.isAtRisk).toBe(true);
    });

    it('deve projetar transações mensais e semanais recorrentes ao longo do horizonte', () => {
      const initialBalance = 5000;
      const today = new Date();

      const recurringTx = {
        date: today.toISOString().split('T')[0],
        amount: 200,
        type: 'expense' as const,
        description: 'Supermercado Semanal',
        recurrence: 'weekly' as const,
      };

      const forecast = generateCashFlowForecast(initialBalance, [recurringTx], 30);

      // Em 30 dias, uma despesa semanal deve ocorrer múltiplas vezes
      expect(forecast.totalProjectedExpense).toBeGreaterThanOrEqual(600);
      expect(forecast.finalBalance).toBeLessThan(initialBalance);
    });
  });
});
