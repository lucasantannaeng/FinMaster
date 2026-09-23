/**
 * Motor de Regras Automáticas e Categorização Inteligente para o FinMaster.
 * Inspirado nas melhores práticas do Firefly III e Actual Budget,
 * permitindo regras declarativas condicionais (AND/OR) para categorização,
 * definição de contas e ajuste de tipo de transações.
 */

import { ParsedTransaction } from './statementParser';

export type RuleField = 'description' | 'amount' | 'type';
export type RuleOperator = 'contains' | 'starts_with' | 'ends_with' | 'equals' | 'greater_than' | 'less_than';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string | number;
}

export interface RuleAction {
  category_id?: string;
  category_name?: string;
  account_id?: string;
  type?: 'income' | 'expense';
}

export interface TransactionRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  matchMode: 'all' | 'any';
  action: RuleAction;
  enabled: boolean;
  priority: number; // Menor valor = maior prioridade de execução
  isSystemDefault?: boolean;
}

export const RULES_STORAGE_KEY = 'finmaster_transaction_rules';

/**
 * Normaliza strings para comparações insensíveis a acentos e maiúsculas.
 */
export function normalizeRuleString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Regras padrão de alta precisão para o mercado e bancos brasileiros.
 */
export const DEFAULT_RULES: TransactionRule[] = [
  {
    id: 'default-rule-alimentacao',
    name: 'Alimentação & Restaurantes',
    matchMode: 'any',
    conditions: [
      { field: 'description', operator: 'contains', value: 'ifood' },
      { field: 'description', operator: 'contains', value: 'restaurante' },
      { field: 'description', operator: 'contains', value: 'padaria' },
      { field: 'description', operator: 'contains', value: 'lanchonete' },
      { field: 'description', operator: 'contains', value: 'mercado' },
      { field: 'description', operator: 'contains', value: 'supermercado' },
      { field: 'description', operator: 'contains', value: 'carrefour' },
      { field: 'description', operator: 'contains', value: 'pao de acucar' },
      { field: 'description', operator: 'contains', value: 'mcdonald' },
      { field: 'description', operator: 'contains', value: 'burger king' },
    ],
    action: { category_name: 'Alimentação', type: 'expense' },
    enabled: true,
    priority: 10,
    isSystemDefault: true,
  },
  {
    id: 'default-rule-transporte',
    name: 'Transporte & Combustível',
    matchMode: 'any',
    conditions: [
      { field: 'description', operator: 'contains', value: 'uber' },
      { field: 'description', operator: 'contains', value: '99app' },
      { field: 'description', operator: 'contains', value: 'posto' },
      { field: 'description', operator: 'contains', value: 'combustivel' },
      { field: 'description', operator: 'contains', value: 'gasolina' },
      { field: 'description', operator: 'contains', value: 'ipiranga' },
      { field: 'description', operator: 'contains', value: 'shell' },
      { field: 'description', operator: 'contains', value: 'sem parar' },
      { field: 'description', operator: 'contains', value: 'veloe' },
      { field: 'description', operator: 'contains', value: 'estacionamento' },
    ],
    action: { category_name: 'Transporte', type: 'expense' },
    enabled: true,
    priority: 20,
    isSystemDefault: true,
  },
  {
    id: 'default-rule-lazer-streamings',
    name: 'Lazer & Assinaturas',
    matchMode: 'any',
    conditions: [
      { field: 'description', operator: 'contains', value: 'netflix' },
      { field: 'description', operator: 'contains', value: 'spotify' },
      { field: 'description', operator: 'contains', value: 'amazon prime' },
      { field: 'description', operator: 'contains', value: 'disney' },
      { field: 'description', operator: 'contains', value: 'hbo' },
      { field: 'description', operator: 'contains', value: 'max.com' },
      { field: 'description', operator: 'contains', value: 'youtube premium' },
      { field: 'description', operator: 'contains', value: 'cinema' },
      { field: 'description', operator: 'contains', value: 'ingresso' },
    ],
    action: { category_name: 'Lazer', type: 'expense' },
    enabled: true,
    priority: 30,
    isSystemDefault: true,
  },
  {
    id: 'default-rule-saude',
    name: 'Saúde & Farmácia',
    matchMode: 'any',
    conditions: [
      { field: 'description', operator: 'contains', value: 'farmacia' },
      { field: 'description', operator: 'contains', value: 'drogaria' },
      { field: 'description', operator: 'contains', value: 'drogasil' },
      { field: 'description', operator: 'contains', value: 'droga raia' },
      { field: 'description', operator: 'contains', value: 'pacheco' },
      { field: 'description', operator: 'contains', value: 'laboratorio' },
      { field: 'description', operator: 'contains', value: 'consulta' },
      { field: 'description', operator: 'contains', value: 'clinica' },
    ],
    action: { category_name: 'Saúde', type: 'expense' },
    enabled: true,
    priority: 40,
    isSystemDefault: true,
  },
  {
    id: 'default-rule-moradia',
    name: 'Moradia & Contas de Consumo',
    matchMode: 'any',
    conditions: [
      { field: 'description', operator: 'contains', value: 'enel' },
      { field: 'description', operator: 'contains', value: 'light' },
      { field: 'description', operator: 'contains', value: 'sabesp' },
      { field: 'description', operator: 'contains', value: 'copasa' },
      { field: 'description', operator: 'contains', value: 'energia' },
      { field: 'description', operator: 'contains', value: 'aluguel' },
      { field: 'description', operator: 'contains', value: 'condominio' },
      { field: 'description', operator: 'contains', value: 'vivo' },
      { field: 'description', operator: 'contains', value: 'claro' },
      { field: 'description', operator: 'contains', value: 'tim' },
    ],
    action: { category_name: 'Moradia', type: 'expense' },
    enabled: true,
    priority: 50,
    isSystemDefault: true,
  },
  {
    id: 'default-rule-salario',
    name: 'Salário & Proventos',
    matchMode: 'any',
    conditions: [
      { field: 'description', operator: 'contains', value: 'salario' },
      { field: 'description', operator: 'contains', value: 'folha de pagto' },
      { field: 'description', operator: 'contains', value: 'remuneracao' },
      { field: 'description', operator: 'contains', value: 'pro-labore' },
      { field: 'description', operator: 'contains', value: 'ted recebida' },
    ],
    action: { category_name: 'Salário', type: 'income' },
    enabled: true,
    priority: 60,
    isSystemDefault: true,
  },
];

/**
 * Obtém as regras salvas pelo usuário ou as regras padrão com mesclagem.
 */
export function getStoredRules(): TransactionRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_RULES];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...DEFAULT_RULES];
    }
    return parsed;
  } catch (err) {
    console.error('Erro ao ler regras salvas do localStorage:', err);
    return [...DEFAULT_RULES];
  }
}

/**
 * Persiste a lista de regras no localStorage.
 */
export function saveRules(rules: TransactionRule[]): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error('Erro ao salvar regras no localStorage:', err);
  }
}

/**
 * Avalia se uma única condição é atendida para uma transação.
 */
export function evaluateCondition(
  tx: { description: string; amount: number; type?: string },
  condition: RuleCondition
): boolean {
  if (condition.field === 'description') {
    const normDesc = normalizeRuleString(tx.description);
    const condVal = normalizeRuleString(String(condition.value));

    switch (condition.operator) {
      case 'contains':
        return normDesc.includes(condVal);
      case 'starts_with':
        return normDesc.startsWith(condVal);
      case 'ends_with':
        return normDesc.endsWith(condVal);
      case 'equals':
        return normDesc === condVal;
      default:
        return false;
    }
  }

  if (condition.field === 'amount') {
    const txAmt = Number(tx.amount) || 0;
    const condAmt = Number(condition.value) || 0;

    switch (condition.operator) {
      case 'equals':
        return Math.abs(txAmt - condAmt) < 0.01;
      case 'greater_than':
        return txAmt > condAmt;
      case 'less_than':
        return txAmt < condAmt;
      default:
        return false;
    }
  }

  if (condition.field === 'type') {
    return tx.type === condition.value;
  }

  return false;
}

/**
 * Avalia uma regra completa com base no seu matchMode ('all' ou 'any').
 */
export function evaluateRule(
  tx: { description: string; amount: number; type?: string },
  rule: TransactionRule
): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  if (rule.matchMode === 'all') {
    return rule.conditions.every(cond => evaluateCondition(tx, cond));
  } else {
    return rule.conditions.some(cond => evaluateCondition(tx, cond));
  }
}

/**
 * Encontra a categoria correspondente a partir do nome ou ID.
 */
function findCategoryMatch(
  categoryNameOrId: string | undefined,
  categories: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  if (!categoryNameOrId) return null;

  // Busca por ID exato
  const byId = categories.find(c => c.id === categoryNameOrId);
  if (byId) return byId;

  // Busca por nome normalizado
  const normTarget = normalizeRuleString(categoryNameOrId);
  const byName = categories.find(c => normalizeRuleString(c.name) === normTarget);
  if (byName) return byName;

  // Busca por aproximação/contém
  const byContains = categories.find(c =>
    normalizeRuleString(c.name).includes(normTarget) || normTarget.includes(normalizeRuleString(c.name))
  );
  if (byContains) return byContains;

  return null;
}

/**
 * Executa as regras sobre uma lista de transações importadas,
 * enriquecendo-as com categorias, tipo e sugestões automáticas.
 */
export function applyRulesToTransactions(
  transactions: ParsedTransaction[],
  categories: Array<{ id: string; name: string }>,
  rules?: TransactionRule[]
): ParsedTransaction[] {
  const activeRules = (rules || getStoredRules())
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  return transactions.map(tx => {
    // Se a transação já tem categoria definida, não sobrescreve a menos que precise
    let matchedCategoryId = tx.category_id;
    let matchedCategoryName = tx.suggestedCategoryName;
    let matchedType = tx.type;

    for (const rule of activeRules) {
      if (evaluateRule(tx, rule)) {
        if (rule.action.type) {
          matchedType = rule.action.type;
        }

        const cat = findCategoryMatch(rule.action.category_name || rule.action.category_id, categories);
        if (cat) {
          matchedCategoryId = cat.id;
          matchedCategoryName = cat.name;
        } else if (rule.action.category_name) {
          matchedCategoryName = rule.action.category_name;
        }

        // Interrompe na primeira regra de maior prioridade encontrada
        break;
      }
    }

    return {
      ...tx,
      type: matchedType,
      category_id: matchedCategoryId,
      suggestedCategoryName: matchedCategoryName,
    };
  });
}

/**
 * Aprende uma nova regra a partir de uma ação do usuário e a adiciona à lista.
 */
export function learnRuleFromUserAction(
  description: string,
  categoryId: string,
  categoryName: string
): TransactionRule {
  const cleanKeyword = normalizeRuleString(description)
    .replace(/[0-9\.\-\_\*\/\\\#\@\$\%\&]/g, ' ')
    .split(' ')
    .filter(w => w.length >= 3)[0] || normalizeRuleString(description).slice(0, 20);

  const existingRules = getStoredRules();
  const newRule: TransactionRule = {
    id: `learned-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: `Auto: ${categoryName} (${cleanKeyword})`,
    matchMode: 'any',
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: cleanKeyword,
      },
    ],
    action: {
      category_id: categoryId,
      category_name: categoryName,
    },
    enabled: true,
    priority: 5, // Alta prioridade para regras aprendidas pelo usuário
    isSystemDefault: false,
  };

  const updatedRules = [newRule, ...existingRules];
  saveRules(updatedRules);
  return newRule;
}
