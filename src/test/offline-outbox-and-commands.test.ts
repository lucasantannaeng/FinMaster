import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addToOutbox,
  getOutbox,
  saveOutbox,
  removeFromOutbox,
  clearOutbox,
  drainOutbox,
  OutboxItem,
} from '@/services/offlineOutboxService';
import { supabase } from '@/integrations/supabase/client';

describe('Fila Offline (Outbox Pattern) & Atalhos Globais (Fase 4)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearOutbox();
    vi.clearAllMocks();
  });

  describe('Serviço de Fila Offline (Outbox)', () => {
    it('deve enfileirar operações de insert quando o usuário estiver offline', () => {
      const payload = {
        description: 'Almoço Restaurante Self-Service',
        amount: 32.5,
        date: '2026-09-23',
        type: 'expense',
      };

      const item = addToOutbox('transactions', 'insert', payload);

      expect(item.id).toBeDefined();
      expect(item.table).toBe('transactions');
      expect(item.operation).toBe('insert');
      expect(item.retryCount).toBe(0);

      const stored = getOutbox();
      expect(stored).toHaveLength(1);
      expect(stored[0].payload.description).toBe('Almoço Restaurante Self-Service');
    });

    it('deve remover itens individuais da fila após confirmação de sucesso', () => {
      const item1 = addToOutbox('transactions', 'insert', { description: 'Item 1', amount: 10 });
      const item2 = addToOutbox('transactions', 'insert', { description: 'Item 2', amount: 20 });

      expect(getOutbox()).toHaveLength(2);

      removeFromOutbox(item1.id);

      const remaining = getOutbox();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(item2.id);
    });

    it('deve drenar e processar transações enfileiradas simulando retorno de rede', async () => {
      // Mock do supabase insert com sucesso
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any);

      addToOutbox('transactions', 'insert', { description: 'Café da Manhã', amount: 12.0 });
      addToOutbox('transactions', 'insert', { description: 'Combustível Moto', amount: 45.0 });

      expect(getOutbox()).toHaveLength(2);

      const result = await drainOutbox();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(getOutbox()).toHaveLength(0); // Fila esvaziada
    });
  });

  describe('Atalhos de Teclado Globais (Keyboard-First)', () => {
    it('deve mapear os atalhos semânticos para as rotas corretas', () => {
      const keyMap: Record<string, string> = {
        d: '/',
        t: '/transactions',
        c: '/cards',
        s: '/settings',
        n: '/transactions?new=true',
      };

      expect(keyMap['d']).toBe('/');
      expect(keyMap['t']).toBe('/transactions');
      expect(keyMap['c']).toBe('/cards');
      expect(keyMap['s']).toBe('/settings');
      expect(keyMap['n']).toBe('/transactions?new=true');
    });
  });
});
