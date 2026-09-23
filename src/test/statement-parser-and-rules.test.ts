import { describe, it, expect, beforeEach } from 'vitest';
import { parseOFX, parseCSV, generateTxHash, markDuplicates, ParsedTransaction } from '@/services/statementParser';
import {
  evaluateCondition,
  evaluateRule,
  applyRulesToTransactions,
  learnRuleFromUserAction,
  normalizeRuleString,
  TransactionRule,
  DEFAULT_RULES,
} from '@/services/rulesEngine';

describe('Extratos Bancários & Motor de Regras Automáticas (Fase 1)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockCategories = [
    { id: 'cat-alimentacao', name: 'Alimentação' },
    { id: 'cat-transporte', name: 'Transporte' },
    { id: 'cat-lazer', name: 'Lazer' },
    { id: 'cat-saude', name: 'Saúde' },
    { id: 'cat-moradia', name: 'Moradia' },
    { id: 'cat-salario', name: 'Salário' },
  ];

  describe('Parser de OFX Bancário', () => {
    it('deve extrair transações de débito e crédito de um extrato OFX no padrão bancário brasileiro', () => {
      const mockOfx = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260920120000[-3:BRT]
            <TRNAMT>-45.90
            <FITID>NUBANK-TX-001
            <MEMO>iFood *Restaurante Bom Sabor
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20260921100000[-3:BRT]
            <TRNAMT>5000.00
            <FITID>NUBANK-TX-002
            <MEMO>TED Recebida - Pro-Labore Empreendimentos
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
      `;

      const result = parseOFX(mockOfx);
      expect(result).toHaveLength(2);

      // Transação 1: Débito
      expect(result[0].amount).toBe(45.9);
      expect(result[0].type).toBe('expense');
      expect(result[0].date).toBe('2026-09-20');
      expect(result[0].description).toBe('iFood *Restaurante Bom Sabor');
      expect(result[0].fitid).toBe('NUBANK-TX-001');

      // Transação 2: Crédito
      expect(result[1].amount).toBe(5000);
      expect(result[1].type).toBe('income');
      expect(result[1].date).toBe('2026-09-21');
      expect(result[1].description).toContain('TED Recebida');
      expect(result[1].fitid).toBe('NUBANK-TX-002');
    });
  });

  describe('Parser de CSV Bancário Brasileiro', () => {
    it('deve processar CSV com separador ponto-e-vírgula e números com vírgula decimal', () => {
      const mockCsv = `Data;Descricao;Valor;Tipo
20/09/2026;Uber *Viagem Aeroporto;-38,50;Debito
21/09/2026;Posto Ipiranga Combustivel;-150,00;Debito
22/09/2026;Pix Recebido Maria;250,00;Credito`;

      const result = parseCSV(mockCsv);
      expect(result).toHaveLength(3);

      expect(result[0].date).toBe('2026-09-20');
      expect(result[0].description).toBe('Uber *Viagem Aeroporto');
      expect(result[0].amount).toBe(38.5);
      expect(result[0].type).toBe('expense');

      expect(result[1].amount).toBe(150.0);
      expect(result[1].type).toBe('expense');

      expect(result[2].amount).toBe(250.0);
      expect(result[2].type).toBe('income');
    });
  });

  describe('Deduplicação Determinística', () => {
    it('deve gerar hashes consistentes e marcar duplicatas com base no histórico', () => {
      const h1 = generateTxHash('2026-09-20', 45.9, 'iFood *Restaurante');
      const h2 = generateTxHash('2026-09-20', 45.9, 'ifood *restaurante'); // case insensitive
      expect(h1).toBe(h2);

      const parsed: ParsedTransaction[] = [
        {
          id: '1',
          date: '2026-09-20',
          amount: 45.9,
          type: 'expense',
          description: 'iFood *Restaurante',
          hash: h1,
        },
        {
          id: '2',
          date: '2026-09-21',
          amount: 80.0,
          type: 'expense',
          description: 'Droga Raia Farmacia',
          hash: generateTxHash('2026-09-21', 80.0, 'Droga Raia Farmacia'),
        },
      ];

      const existingInDb = [
        { date: '2026-09-20', amount: 45.9, description: 'iFood *Restaurante' },
      ];

      const withDups = markDuplicates(parsed, existingInDb);
      expect(withDups[0].isDuplicate).toBe(true);
      expect(withDups[1].isDuplicate).toBe(false);
    });
  });

  describe('Motor de Regras Automáticas (Rules Engine)', () => {
    it('deve categorizar automaticamente transações com base nas regras do sistema', () => {
      const transactions: ParsedTransaction[] = [
        {
          id: '1',
          date: '2026-09-20',
          amount: 55.4,
          type: 'expense',
          description: 'Supermercado Carrefour Bairro',
          hash: 'h1',
        },
        {
          id: '2',
          date: '2026-09-21',
          amount: 25.0,
          type: 'expense',
          description: 'Uber BR *Trip',
          hash: 'h2',
        },
        {
          id: '3',
          date: '2026-09-22',
          amount: 39.9,
          type: 'expense',
          description: 'Netflix Entretenimento Mensal',
          hash: 'h3',
        },
      ];

      const categorized = applyRulesToTransactions(transactions, mockCategories, DEFAULT_RULES);

      expect(categorized[0].category_id).toBe('cat-alimentacao');
      expect(categorized[0].suggestedCategoryName).toBe('Alimentação');

      expect(categorized[1].category_id).toBe('cat-transporte');
      expect(categorized[1].suggestedCategoryName).toBe('Transporte');

      expect(categorized[2].category_id).toBe('cat-lazer');
      expect(categorized[2].suggestedCategoryName).toBe('Lazer');
    });

    it('deve aprender novas regras do usuário a partir de ações manuais e aplicá-las com prioridade', () => {
      const learned = learnRuleFromUserAction('Gympass Mensalidade', 'cat-saude', 'Saúde');
      expect(learned).toBeDefined();
      expect(learned.conditions[0].value).toContain('gympass');
      expect(learned.action.category_name).toBe('Saúde');

      const newTx: ParsedTransaction = {
        id: '4',
        date: '2026-09-23',
        amount: 119.9,
        type: 'expense',
        description: 'Gympass *Wellhub Academia',
        hash: 'h4',
      };

      const result = applyRulesToTransactions([newTx], mockCategories);
      expect(result[0].category_id).toBe('cat-saude');
      expect(result[0].suggestedCategoryName).toBe('Saúde');
    });

    it('deve avaliar operadores numéricos e literais corretamente', () => {
      const txHighValue = { description: 'Boleto Grande', amount: 5500, type: 'expense' };

      const conditionGreater = { field: 'amount' as const, operator: 'greater_than' as const, value: 5000 };
      expect(evaluateCondition(txHighValue, conditionGreater)).toBe(true);

      const conditionLess = { field: 'amount' as const, operator: 'less_than' as const, value: 1000 };
      expect(evaluateCondition(txHighValue, conditionLess)).toBe(false);
    });
  });
});
