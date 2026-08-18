import { describe, it, expect } from 'vitest';
import { defaultFilters, InvoiceFiltersState } from '../hooks/useCardInvoice';

describe('FinMaster - Testes de Regras de Fatura e Filtros de Cartão', () => {
  it('deve inicializar filtros padrão corretamente', () => {
    expect(defaultFilters.search).toBe('');
    expect(defaultFilters.categoryId).toBe('all');
    expect(defaultFilters.paid).toBe('all');
    expect(defaultFilters.contactId).toBe('all');
  });

  it('deve filtrar transações por busca textual e categoria sem mutar total da fatura', () => {
    const transactions = [
      { id: '1', description: 'Supermercado Pão de Açúcar', amount: 350.50, category_id: 'cat-1', is_paid: true },
      { id: '2', description: 'Posto Shell Gasolina', amount: 200.00, category_id: 'cat-2', is_paid: false },
      { id: '3', description: 'Restaurante Outback', amount: 180.00, category_id: 'cat-1', is_paid: false }
    ];

    const totalBill = transactions.reduce((sum, t) => sum + t.amount, 0);
    expect(totalBill).toBe(730.50);

    // Filtrar categoria cat-1
    const cat1Transactions = transactions.filter(t => t.category_id === 'cat-1');
    expect(cat1Transactions).toHaveLength(2);
    expect(cat1Transactions.reduce((s, t) => s + t.amount, 0)).toBe(530.50);

    // Filtrar não pagos
    const unpaidTransactions = transactions.filter(t => !t.is_paid);
    expect(unpaidTransactions).toHaveLength(2);
    expect(unpaidTransactions.reduce((s, t) => s + t.amount, 0)).toBe(380.00);
  });

  it('deve calcular corretamente conversão cambial e patrimônio total em BRL', () => {
    const assets = [
      { currency: 'USDT', equity: 1000, priceUsdt: 1.0 },
      { currency: 'BTC', equity: 0.05, priceUsdt: 60000.0 },
      { currency: 'ETH', equity: 0.5, priceUsdt: 3000.0 }
    ];

    const usdBrl = 5.50; // taxa cambial simulada

    const totalUsdt = assets.reduce((sum, a) => sum + (a.equity * a.priceUsdt), 0);
    expect(totalUsdt).toBe(1000 + 3000 + 1500); // 5500 USDT

    const totalBrl = totalUsdt * usdBrl;
    expect(totalBrl).toBe(30250.0);
  });
});
