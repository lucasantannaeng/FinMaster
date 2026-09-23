/**
 * Serviço de Fila Offline (Outbox Pattern) para o FinMaster.
 * Permite que o usuário registre transações ou edições mesmo sem conexão à internet.
 * Assim que a rede é restabelecida, os itens enfileirados são sincronizados atomicamente com o Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OutboxOperation = 'insert' | 'update' | 'delete';
export type OutboxTable = 'transactions' | 'accounts' | 'categories' | 'credit_cards';

export interface OutboxItem {
  id: string;
  table: OutboxTable;
  operation: OutboxOperation;
  payload: any;
  matchField?: string;
  matchValue?: any;
  timestamp: string;
  retryCount: number;
}

export const OUTBOX_STORAGE_KEY = 'finmaster_offline_outbox';

export function getOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler outbox do localStorage:', err);
    return [];
  }
}

export function saveOutbox(items: OutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Erro ao salvar outbox no localStorage:', err);
  }
}

export function addToOutbox(
  table: OutboxTable,
  operation: OutboxOperation,
  payload: any,
  matchField?: string,
  matchValue?: any
): OutboxItem {
  const item: OutboxItem = {
    id: `outbox-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    table,
    operation,
    payload,
    matchField,
    matchValue,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  const current = getOutbox();
  const updated = [...current, item];
  saveOutbox(updated);

  toast.info('Item salvo na fila offline local. Será sincronizado assim que a rede retornar.');
  return item;
}

export function removeFromOutbox(id: string): void {
  const current = getOutbox();
  const updated = current.filter((i) => i.id !== id);
  saveOutbox(updated);
}

export function clearOutbox(): void {
  localStorage.removeItem(OUTBOX_STORAGE_KEY);
}

/**
 * Drena a fila offline, processando cada item no Supabase.
 */
export async function drainOutbox(): Promise<{ synced: number; failed: number }> {
  const items = getOutbox();
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: OutboxItem[] = [];

  for (const item of items) {
    try {
      if (item.operation === 'insert') {
        const { error } = await supabase.from(item.table as any).insert(item.payload);
        if (error) throw error;
        synced++;
      } else if (item.operation === 'update' && item.matchField && item.matchValue) {
        const { error } = await supabase
          .from(item.table as any)
          .update(item.payload)
          .eq(item.matchField, item.matchValue);
        if (error) throw error;
        synced++;
      } else if (item.operation === 'delete' && item.matchField && item.matchValue) {
        const { error } = await supabase
          .from(item.table as any)
          .delete()
          .eq(item.matchField, item.matchValue);
        if (error) throw error;
        synced++;
      }
    } catch (err: any) {
      console.warn(`Falha ao sincronizar item offline ${item.id}:`, err);
      failed++;
      // Aumenta contador de retentativa
      remaining.push({
        ...item,
        retryCount: item.retryCount + 1,
      });
    }
  }

  saveOutbox(remaining);

  if (synced > 0) {
    toast.success(`⚡ ${synced} operação(ões) offline sincronizada(s) com a nuvem!`);
  }

  return { synced, failed };
}
