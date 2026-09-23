/**
 * Serviço de Gestão de Metas e Potes de Reserva (Sinking Funds).
 * Inspirado na metodologia do YNAB e Envelopes Virtuais.
 * Armazena metas localmente com persistência imediata e cálculo de aportes ideais.
 */

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  category?: string;
  color?: string;
  icon?: string;
  createdAt: string;
}

export const GOALS_STORAGE_KEY = 'finmaster_savings_goals';

export const DEFAULT_GOALS: SavingsGoal[] = [
  {
    id: 'goal-emergency-fund',
    name: 'Reserva de Emergência (6 Meses)',
    targetAmount: 30000,
    currentAmount: 12500,
    targetDate: '2026-12-31',
    category: 'Segurança',
    color: '#10b981', // emerald
    icon: 'Shield',
    createdAt: '2026-01-01',
  },
  {
    id: 'goal-vacation',
    name: 'Viagem de Férias',
    targetAmount: 8000,
    currentAmount: 3200,
    targetDate: '2026-11-15',
    category: 'Lazer',
    color: '#3b82f6', // blue
    icon: 'Plane',
    createdAt: '2026-02-01',
  },
  {
    id: 'goal-taxes-ipva',
    name: 'IPVA & IPTU Anual',
    targetAmount: 4500,
    currentAmount: 2250,
    targetDate: '2027-01-10',
    category: 'Obrigações',
    color: '#f59e0b', // amber
    icon: 'Car',
    createdAt: '2026-03-01',
  },
];

export function getStoredGoals(): SavingsGoal[] {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(DEFAULT_GOALS));
      return [...DEFAULT_GOALS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_GOALS];
  } catch (err) {
    console.error('Erro ao ler metas salvas:', err);
    return [...DEFAULT_GOALS];
  }
}

export function saveGoals(goals: SavingsGoal[]): void {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch (err) {
    console.error('Erro ao salvar metas no localStorage:', err);
  }
}

export function addGoal(goal: Omit<SavingsGoal, 'id' | 'createdAt'>): SavingsGoal {
  const newGoal: SavingsGoal = {
    ...goal,
    id: `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
  };

  const existing = getStoredGoals();
  const updated = [newGoal, ...existing];
  saveGoals(updated);
  return newGoal;
}

export function updateGoal(id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>): SavingsGoal | null {
  const existing = getStoredGoals();
  const index = existing.findIndex((g) => g.id === id);
  if (index === -1) return null;

  existing[index] = { ...existing[index], ...updates };
  saveGoals(existing);
  return existing[index];
}

export function deleteGoal(id: string): void {
  const existing = getStoredGoals();
  const filtered = existing.filter((g) => g.id !== id);
  saveGoals(filtered);
}

export function addContribution(id: string, amount: number): SavingsGoal | null {
  const existing = getStoredGoals();
  const target = existing.find((g) => g.id === id);
  if (!target) return null;

  target.currentAmount = Math.max(0, target.currentAmount + amount);
  saveGoals(existing);
  return target;
}

/**
 * Calcula o aporte mensal necessário para atingir o valor alvo até a data estipulada.
 */
export function calculateMonthlyRequirement(goal: SavingsGoal): {
  monthsRemaining: number;
  remainingAmount: number;
  monthlyAmount: number;
  isCompleted: boolean;
  progressPercent: number;
} {
  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  const progressPercent = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 100;

  if (remainingAmount <= 0) {
    return {
      monthsRemaining: 0,
      remainingAmount: 0,
      monthlyAmount: 0,
      isCompleted: true,
      progressPercent: 100,
    };
  }

  const now = new Date();
  const target = new Date(goal.targetDate);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(1, Math.round(diffDays / 30.4));

  const monthlyAmount = Math.round((remainingAmount / monthsRemaining) * 100) / 100;

  return {
    monthsRemaining,
    remainingAmount,
    monthlyAmount,
    isCompleted: false,
    progressPercent,
  };
}
