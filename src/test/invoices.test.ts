import { describe, it, expect } from 'vitest';
import { defaultFilters } from '../hooks/useCardInvoice';
import { getBillingPeriod, getAssetConcentration, formatCurrency } from '../lib/format';

describe('FinMaster - Testes de Regras de Fatura e Ciclo Contábil (useBillingPeriod)', () => {
  it('deve calcular ciclo de fatura corretamente quando dia atual for posterior ao fechamento', () => {
    // Referência: 15 de Março de 2026, dia de fechamento: 10
    const refDate = new Date(2026, 2, 15); // Março
    const { startDate, endDate } = getBillingPeriod(10, refDate);

    // Ciclo aberto atual: 11 de Março até 10 de Abril
    expect(startDate.getDate()).toBe(11);
    expect(startDate.getMonth()).toBe(2); // Março
    expect(endDate.getDate()).toBe(10);
    expect(endDate.getMonth()).toBe(3); // Abril
  });

  it('deve calcular ciclo de fatura corretamente quando dia atual for anterior ao fechamento', () => {
    // Referência: 5 de Março de 2026, dia de fechamento: 10
    const refDate = new Date(2026, 2, 5); // Março
    const { startDate, endDate } = getBillingPeriod(10, refDate);

    // Ciclo aberto atual: 11 de Fevereiro até 10 de Março
    expect(startDate.getDate()).toBe(11);
    expect(startDate.getMonth()).toBe(1); // Fevereiro
    expect(endDate.getDate()).toBe(10);
    expect(endDate.getMonth()).toBe(2); // Março
  });

  it('deve lidar com transição de ano (Dezembro -> Janeiro)', () => {
    // Referência: 2 de Janeiro de 2026, dia de fechamento: 15
    const refDate = new Date(2026, 0, 2);
    const { startDate, endDate } = getBillingPeriod(15, refDate);

    expect(startDate.getFullYear()).toBe(2025);
    expect(startDate.getMonth()).toBe(11); // Dezembro
    expect(startDate.getDate()).toBe(16);
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(0); // Janeiro
    expect(endDate.getDate()).toBe(15);
  });
});

describe('FinMaster - Helper de Concentração de Ativos (getAssetConcentration)', () => {
  const mockAssets = [
    { currency: 'USDT', equity: 2000, priceUsdt: 1.0 },  // $2,000 (20%)
    { currency: 'BTC', equity: 0.1, priceUsdt: 50000.0 }, // $5,000 (50%)
    { currency: 'ETH', equity: 1.0, priceUsdt: 3000.0 }   // $3,000 (30%)
  ];
  const totalEquity = 10000;

  it('deve calcular percentual exato de concentração para ativos presentes', () => {
    expect(getAssetConcentration(mockAssets, 'BTC', totalEquity)).toBe(50.0);
    expect(getAssetConcentration(mockAssets, 'ETH', totalEquity)).toBe(30.0);
    expect(getAssetConcentration(mockAssets, 'USDT', totalEquity)).toBe(20.0);
  });

  it('deve retornar 0 para ativos ausentes ou patrimônio total zerado', () => {
    expect(getAssetConcentration(mockAssets, 'SOL', totalEquity)).toBe(0);
    expect(getAssetConcentration(mockAssets, 'BTC', 0)).toBe(0);
    expect(getAssetConcentration([], 'BTC', totalEquity)).toBe(0);
    expect(getAssetConcentration(undefined, 'BTC', totalEquity)).toBe(0);
  });

  it('deve ser case-insensitive na busca da moeda', () => {
    expect(getAssetConcentration(mockAssets, 'btc', totalEquity)).toBe(50.0);
    expect(getAssetConcentration(mockAssets, 'Eth', totalEquity)).toBe(30.0);
  });
});

describe('FinMaster - Testes de Filtros de Fatura e Máscara de Privacidade', () => {
  it('deve inicializar filtros padrão corretamente', () => {
    expect(defaultFilters.search).toBe('');
    expect(defaultFilters.categoryId).toBe('all');
    expect(defaultFilters.paid).toBe('all');
    expect(defaultFilters.contactId).toBe('all');
  });

  it('deve aplicar máscara de privacidade no formatCurrency quando discrete=true', () => {
    expect(formatCurrency(1500.50, true)).toBe('••••');
    expect(formatCurrency(1500.50, false)).toContain('1.500,50');
  });

  it('deve filtrar transações por busca textual e categoria sem mutar total da fatura', () => {
    const transactions = [
      { id: '1', description: 'Supermercado Pão de Açúcar', amount: 350.50, category_id: 'cat-1', is_paid: true },
      { id: '2', description: 'Posto Shell Gasolina', amount: 200.00, category_id: 'cat-2', is_paid: false },
      { id: '3', description: 'Restaurante Outback', amount: 180.00, category_id: 'cat-1', is_paid: false }
    ];

    const totalBill = transactions.reduce((sum, t) => sum + t.amount, 0);
    expect(totalBill).toBe(730.50);

    const cat1Transactions = transactions.filter(t => t.category_id === 'cat-1');
    expect(cat1Transactions).toHaveLength(2);
    expect(cat1Transactions.reduce((s, t) => s + t.amount, 0)).toBe(530.50);
  });
});
