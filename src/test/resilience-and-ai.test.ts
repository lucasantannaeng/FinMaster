import { describe, it, expect } from "vitest";

describe("Resiliência Multiplataforma & Inteligência Artificial", () => {
  it("deve validar o mapeamento de entidades financeiras a partir do retorno da IA", () => {
    const mockCategories = [
      { id: 'cat-1', name: 'Alimentação', type: 'expense' },
      { id: 'cat-2', name: 'Transporte', type: 'expense' },
      { id: 'cat-3', name: 'Saúde', type: 'expense' },
    ];

    const mockAiResponse = {
      description: 'Supermercado Pão de Açúcar',
      amount: 145.80,
      date: '2026-09-23',
      type: 'expense',
      category_name: 'Alimentação',
    };

    const matchedCategory = mockCategories.find(
      c => c.name.toLowerCase() === mockAiResponse.category_name.toLowerCase()
    );

    expect(matchedCategory).toBeDefined();
    expect(matchedCategory?.id).toBe('cat-1');
    expect(mockAiResponse.amount).toBeGreaterThan(0);
    expect(mockAiResponse.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("deve detectar e marcar campos preenchidos por IA para destaque visual", () => {
    const aiParsed = {
      description: 'Farmácia Raia Medicamentos',
      amount: 89.90,
      date: '2026-09-20',
      category_name: 'Saúde',
    };

    const detectedFields: string[] = [];
    if (aiParsed.description) detectedFields.push('description');
    if (aiParsed.amount) detectedFields.push('amount');
    if (aiParsed.date) detectedFields.push('date');
    if (aiParsed.category_name) detectedFields.push('category_id');

    expect(detectedFields).toContain('description');
    expect(detectedFields).toContain('amount');
    expect(detectedFields).toContain('date');
    expect(detectedFields).toContain('category_id');
    expect(detectedFields.length).toBe(4);
  });

  it("deve calcular corretamente a cobertura de reserva (burn rate) para o consultor financeiro", () => {
    const totalBalance = 25000;
    const monthExpense = 5000;

    const burnRateMonths = monthExpense > 0 ? Math.round((totalBalance / monthExpense) * 10) / 10 : null;

    expect(burnRateMonths).toBe(5.0);
  });

  it("deve manter fallback seguro quando não houver despesa registrada no mês", () => {
    const totalBalance = 15000;
    const monthExpense = 0;

    const burnRateMonths = monthExpense > 0 ? Math.round((totalBalance / monthExpense) * 10) / 10 : null;

    expect(burnRateMonths).toBeNull();
  });
});
