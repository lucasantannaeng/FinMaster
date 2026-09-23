/**
 * Serviço de importação e processamento de extratos bancários (OFX e CSV).
 * Suporta formatos padrão dos bancos brasileiros (Nubank, Inter, Itaú, Bradesco, Santander, etc.)
 * com geração de hash determinístico para deduplicação e conciliação em lote.
 */

export interface ParsedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // valor positivo
  type: 'income' | 'expense';
  description: string;
  fitid?: string;
  hash: string;
  isDuplicate?: boolean;
  category_id?: string;
  suggestedCategoryName?: string;
}

/**
 * Normaliza uma string de texto removendo caracteres invisíveis e espaços duplicados.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gera um hash determinístico simples (FNV-1a 32-bit em hexa) para execução síncrona sem overhead,
 * combinado com timestamp e dados normalizados da transação.
 */
export function generateTxHash(date: string, amount: number, description: string): string {
  const normalized = `${date}|${amount.toFixed(2)}|${normalizeText(description)}`;
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash.toString(16).padStart(12, '0');
}

/**
 * Converte data de formato OFX (YYYYMMDD... ou YYYYMMDD) para YYYY-MM-DD.
 */
function parseOFXDate(dateRaw: string): string {
  const clean = dateRaw.trim().replace(/\[.*\]/, '');
  if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Converte data genérica brasileira (DD/MM/YYYY) ou ISO para YYYY-MM-DD.
 */
function parseGenericDate(dateRaw: string): string {
  const s = dateRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const brMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0');
    const m = brMatch[2].padStart(2, '0');
    const y = brMatch[3];
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Converte valor numérico de strings em formatos variados (-120.50, -120,50, (120,50), 1.250,50).
 */
function parseAmount(valRaw: string): { amount: number; isNegative: boolean } {
  let s = valRaw.trim();
  let isNegative = false;

  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.substring(1, s.length - 1);
  } else if (s.startsWith('-')) {
    isNegative = true;
    s = s.substring(1);
  } else if (s.endsWith('-')) {
    isNegative = true;
    s = s.substring(0, s.length - 1);
  }

  // Remove R$, espaços e caracteres não numéricos exceto vírgula e ponto
  s = s.replace(/[^0-9,.-]/g, '');

  // Trata formato brasileiro (1.234,56) vs formato americano (1,234.56)
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56 -> ponto milhar, vírgula decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 -> vírgula milhar, ponto decimal
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // 1234,56
    s = s.replace(',', '.');
  }

  const num = Math.abs(parseFloat(s) || 0);
  return { amount: Math.round(num * 100) / 100, isNegative };
}

/**
 * Processa o conteúdo de um arquivo OFX bancário (v1 e v2).
 */
export function parseOFX(ofxContent: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Localiza todos os blocos <STMTTRN>...</STMTTRN> ou até o próximo <STMTTRN>
  const stmtMatches = ofxContent.split(/<STMTTRN>/i).slice(1);

  for (const block of stmtMatches) {
    const endIdx = block.search(/<\/STMTTRN>/i);
    const content = endIdx !== -1 ? block.substring(0, endIdx) : block;

    const trntypeMatch = content.match(/<TRNTYPE>([^<\r\n]+)/i);
    const dtpostedMatch = content.match(/<DTPOSTED>([^<\r\n]+)/i);
    const trnamtMatch = content.match(/<TRNAMT>([^<\r\n]+)/i);
    const fitidMatch = content.match(/<FITID>([^<\r\n]+)/i);
    const memoMatch = content.match(/<MEMO>([^<\r\n]+)/i);
    const nameMatch = content.match(/<NAME>([^<\r\n]+)/i);

    const rawAmt = trnamtMatch ? trnamtMatch[1].trim() : '0';
    const { amount, isNegative } = parseAmount(rawAmt);
    const date = dtpostedMatch ? parseOFXDate(dtpostedMatch[1]) : new Date().toISOString().split('T')[0];
    const fitid = fitidMatch ? fitidMatch[1].trim() : undefined;
    const description = (memoMatch ? memoMatch[1] : (nameMatch ? nameMatch[1] : 'Transação sem descrição')).trim();

    const trntype = trntypeMatch ? trntypeMatch[1].trim().toUpperCase() : '';
    let type: 'income' | 'expense' = 'expense';
    if (trntype === 'CREDIT' || (!isNegative && parseFloat(rawAmt) > 0)) {
      type = 'income';
    } else {
      type = 'expense';
    }

    if (amount > 0) {
      const hash = generateTxHash(date, amount, description);
      transactions.push({
        id: fitid || `ofx-${hash}-${transactions.length}`,
        date,
        amount,
        type,
        description,
        fitid,
        hash,
      });
    }
  }

  return transactions;
}

/**
 * Processa o conteúdo de um arquivo CSV de extrato bancário.
 */
export function parseCSV(csvContent: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = csvContent
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return transactions;

  // Detecta delimitador (, ou ; ou \t)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : tabCount > commaCount ? '\t' : ',';

  const headers = lines[0].split(delimiter).map(h => normalizeText(h));

  // Localiza colunas por palavras-chave comuns em bancos brasileiros
  let dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
  let descIdx = headers.findIndex(h => h.includes('descricao') || h.includes('historico') || h.includes('estabelecimento') || h.includes('memo') || h.includes('title'));
  let amountIdx = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('quantia'));
  let typeIdx = headers.findIndex(h => h.includes('tipo') || h.includes('type') || h.includes('operacao'));

  // Se não encontrar pelo cabeçalho, adota heurística posicional padrão
  if (dateIdx === -1) dateIdx = 0;
  if (amountIdx === -1) amountIdx = headers.length > 2 ? 2 : 1;
  if (descIdx === -1) descIdx = amountIdx === 1 ? 2 : 1;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length <= Math.max(dateIdx, amountIdx)) continue;

    const rawDate = cols[dateIdx] || '';
    const rawDesc = cols[descIdx] || 'Transação sem descrição';
    const rawVal = cols[amountIdx] || '0';

    const { amount, isNegative } = parseAmount(rawVal);
    if (amount <= 0) continue;

    const date = parseGenericDate(rawDate);
    const description = rawDesc.trim();

    let type: 'income' | 'expense' = isNegative ? 'expense' : 'income';
    if (typeIdx !== -1 && cols[typeIdx]) {
      const t = normalizeText(cols[typeIdx]);
      if (t.includes('debito') || t.includes('despesa') || t.includes('saida') || t.includes('debit')) {
        type = 'expense';
      } else if (t.includes('credito') || t.includes('receita') || t.includes('entrada') || t.includes('credit')) {
        type = 'income';
      }
    }

    const hash = generateTxHash(date, amount, description);
    transactions.push({
      id: `csv-${hash}-${transactions.length}`,
      date,
      amount,
      type,
      description,
      hash,
    });
  }

  return transactions;
}

/**
 * Marca como duplicatas transações que já existem no banco ou no histórico local.
 */
export function markDuplicates(
  importedList: ParsedTransaction[],
  existingList: Array<{ date: string; amount: number; description: string }>
): ParsedTransaction[] {
  const existingHashes = new Set(
    existingList.map(item => generateTxHash(item.date, Number(item.amount), item.description))
  );

  return importedList.map(tx => ({
    ...tx,
    isDuplicate: existingHashes.has(tx.hash),
  }));
}
