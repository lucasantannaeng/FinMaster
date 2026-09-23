import { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { parseOFX, parseCSV, markDuplicates, ParsedTransaction } from '@/services/statementParser';
import {
  applyRulesToTransactions,
  getStoredRules,
  saveRules,
  learnRuleFromUserAction,
  TransactionRule,
  DEFAULT_RULES,
} from '@/services/rulesEngine';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Wand2,
  Trash2,
  Plus,
  RotateCcw,
  Loader2,
  Filter,
} from 'lucide-react';

interface StatementImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
  existingTransactions: Array<{ date: string; amount: number; description: string }>;
  onSuccess: () => void;
}

export function StatementImportModal({
  open,
  onOpenChange,
  accounts,
  categories,
  existingTransactions,
  onSuccess,
}: StatementImportModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados da importação
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedList, setParsedList] = useState<ParsedTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoLearnRules, setAutoLearnRules] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Estados do gerenciador de regras
  const [rules, setRules] = useState<TransactionRule[]>(() => getStoredRules());
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('');
  const [newRuleName, setNewRuleName] = useState('');

  // Sincroniza regras quando abrir
  const reloadRules = () => {
    setRules(getStoredRules());
  };

  const handleFileProcess = (file: File) => {
    const isOfx = file.name.toLowerCase().endsWith('.ofx');
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (!isOfx && !isCsv) {
      toast.error('Formato não suportado. Por favor, envie um arquivo .OFX ou .CSV.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        toast.error('O arquivo está vazio.');
        return;
      }

      try {
        let rawTransactions: ParsedTransaction[] = [];
        if (isOfx) {
          rawTransactions = parseOFX(content);
        } else {
          rawTransactions = parseCSV(content);
        }

        if (rawTransactions.length === 0) {
          toast.warning('Nenhuma transação válida encontrada no arquivo.');
          return;
        }

        // Aplica deduplicação contra o histórico existente
        const withDuplicates = markDuplicates(rawTransactions, existingTransactions);

        // Aplica o motor de regras para categorização automática
        const withRules = applyRulesToTransactions(withDuplicates, categories, rules);

        setParsedList(withRules);

        // Por padrão, seleciona apenas as transações que NÃO são duplicadas
        const newIds = new Set<string>();
        withRules.forEach((tx) => {
          if (!tx.isDuplicate) {
            newIds.add(tx.id);
          }
        });
        setSelectedIds(newIds);

        const dupCount = withRules.filter((tx) => tx.isDuplicate).length;
        const autoCatCount = withRules.filter((tx) => tx.category_id).length;

        toast.success(
          `${withRules.length} transações processadas! (${autoCatCount} auto-categorizadas, ${dupCount} duplicatas detectadas)`
        );
      } catch (err: any) {
        console.error('Erro ao processar extrato:', err);
        toast.error('Erro ao ler o arquivo de extrato: ' + (err.message || 'Verifique o formato.'));
      }
    };

    reader.readAsText(file, 'utf-8');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const toggleSelectAll = (selectOnlyNew = true) => {
    if (selectOnlyNew) {
      const newIds = new Set<string>();
      parsedList.forEach((tx) => {
        if (!tx.isDuplicate) newIds.add(tx.id);
      });
      setSelectedIds(newIds);
    } else {
      if (selectedIds.size === parsedList.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(parsedList.map((tx) => tx.id)));
      }
    }
  };

  const toggleSelectTx = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleUpdateCategory = (txId: string, categoryId: string) => {
    setParsedList((prev) =>
      prev.map((tx) => {
        if (tx.id === txId) {
          const cat = categories.find((c) => c.id === categoryId);
          return {
            ...tx,
            category_id: categoryId,
            suggestedCategoryName: cat?.name,
          };
        }
        return tx;
      })
    );
  };

  const handleUpdateType = (txId: string, type: 'income' | 'expense') => {
    setParsedList((prev) =>
      prev.map((tx) => (tx.id === txId ? { ...tx, type } : tx))
    );
  };

  // Cálculos do lote selecionado
  const batchStats = useMemo(() => {
    const selected = parsedList.filter((tx) => selectedIds.has(tx.id));
    let totalIncome = 0;
    let totalExpense = 0;

    selected.forEach((tx) => {
      if (tx.type === 'income') totalIncome += tx.amount;
      else totalExpense += tx.amount;
    });

    return {
      count: selected.length,
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
    };
  }, [parsedList, selectedIds]);

  const handleConfirmImport = async () => {
    if (!user) {
      toast.error('Usuário não autenticado.');
      return;
    }

    if (!selectedAccountId) {
      toast.error('Selecione uma conta de destino antes de importar.');
      return;
    }

    const toImport = parsedList.filter((tx) => selectedIds.has(tx.id));
    if (toImport.length === 0) {
      toast.warning('Nenhuma transação selecionada para importação.');
      return;
    }

    setIsImporting(true);
    try {
      // 1. Prepara as linhas para inserção no Supabase
      const payload = toImport.map((tx) => ({
        user_id: user.id,
        account_id: selectedAccountId,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        category_id: tx.category_id || null,
        is_paid: true,
      }));

      const { error: insertError } = await supabase.from('transactions').insert(payload);
      if (insertError) throw insertError;

      // 2. Atualiza o saldo consolidado da conta selecionada
      const totalDelta = batchStats.net;
      if (totalDelta !== 0) {
        const { error: rpcError } = await supabase.rpc('update_account_balance', {
          p_account_id: selectedAccountId,
          p_delta: totalDelta,
        });
        if (rpcError) {
          console.warn('Aviso ao atualizar saldo via RPC:', rpcError);
        }
      }

      // 3. Auto-aprendizado de regras para as categorias atribuídas
      if (autoLearnRules) {
        toImport.forEach((tx) => {
          if (tx.category_id) {
            const cat = categories.find((c) => c.id === tx.category_id);
            if (cat) {
              learnRuleFromUserAction(tx.description, cat.id, cat.name);
            }
          }
        });
        reloadRules();
      }

      toast.success(`${toImport.length} transações importadas com sucesso!`);
      onSuccess();
      onOpenChange(false);

      // Limpa estado após importação
      setParsedList([]);
      setFileName('');
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Erro na importação em lote:', err);
      toast.error('Falha ao importar transações: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setIsImporting(false);
    }
  };

  // Gerenciamento de Regras
  const handleToggleRule = (ruleId: string, currentEnabled: boolean) => {
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, enabled: !currentEnabled } : r));
    setRules(updated);
    saveRules(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = rules.filter((r) => r.id !== ruleId);
    setRules(updated);
    saveRules(updated);
    toast.success('Regra removida.');
  };

  const handleResetRules = () => {
    setRules([...DEFAULT_RULES]);
    saveRules([...DEFAULT_RULES]);
    toast.success('Regras restauradas para o padrão do sistema.');
  };

  const handleAddManualRule = () => {
    if (!newRuleKeyword.trim() || !newRuleCategoryId) {
      toast.error('Preencha a palavra-chave e selecione a categoria.');
      return;
    }

    const cat = categories.find((c) => c.id === newRuleCategoryId);
    if (!cat) return;

    const newRule: TransactionRule = {
      id: `rule-custom-${Date.now()}`,
      name: newRuleName.trim() || `Regra: ${cat.name} (${newRuleKeyword.trim()})`,
      matchMode: 'any',
      conditions: [
        {
          field: 'description',
          operator: 'contains',
          value: newRuleKeyword.trim(),
        },
      ],
      action: {
        category_id: cat.id,
        category_name: cat.name,
      },
      enabled: true,
      priority: 15,
      isSystemDefault: false,
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    saveRules(updated);

    setNewRuleKeyword('');
    setNewRuleCategoryId('');
    setNewRuleName('');
    toast.success('Nova regra adicionada!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">Importação de Extratos Bancários</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Importe arquivos .OFX ou .CSV de bancos brasileiros com conciliação inteligente, descarte de duplicatas e regras automáticas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="import" className="flex-1 flex flex-col overflow-hidden pt-2">
          <TabsList className="grid w-full grid-cols-2 max-w-sm mb-3">
            <TabsTrigger value="import" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Importar Extrato
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs" onClick={reloadRules}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Regras de Automação ({rules.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: IMPORTAR EXTRATO */}
          <TabsContent value="import" className="flex-1 flex flex-col overflow-hidden space-y-3 m-0">
            {/* Controles de Topo: Conta e Arquivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-semibold">Conta de Destino *</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Selecione a conta bancária..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Arquivo de Extrato (.OFX ou .CSV)</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".ofx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1 h-9 justify-start text-xs font-normal truncate"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="h-4 w-4 mr-2 text-primary shrink-0" />
                  {fileName ? fileName : 'Selecionar arquivo do computador...'}
                </Button>
              </div>
            </div>

            {/* Zona de Drop quando vazio */}
            {parsedList.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/10'
                }`}
              >
                <UploadCloud className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Arraste e solte seu extrato bancário aqui</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Compatível com Nubank, Inter, Itaú, Bradesco, Santander, C6, BTG, Banco do Brasil e Caixa (.ofx e .csv)
                </p>
                <Button variant="secondary" size="sm" className="mt-4 text-xs">
                  Procurar Arquivo
                </Button>
              </div>
            ) : (
              // Tabela de Pré-visualização e Conferência
              <div className="flex-1 flex flex-col overflow-hidden border rounded-lg">
                {/* Barra de Ações Rápidas da Tabela */}
                <div className="p-2 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleSelectAll(true)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Selecionar Novas ({parsedList.filter(t => !t.isDuplicate).length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleSelectAll(false)}
                    >
                      {selectedIds.size === parsedList.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      Total: <strong className="text-foreground">{parsedList.length}</strong> | 
                      Novas: <strong className="text-emerald-500">{parsedList.filter(t => !t.isDuplicate).length}</strong> | 
                      Duplicadas: <strong className="text-amber-500">{parsedList.filter(t => t.isDuplicate).length}</strong>
                    </span>
                  </div>
                </div>

                {/* Tabela com Scroll */}
                <div className="flex-1 overflow-auto">
                  <Table className="text-xs">
                    <TableHeader className="sticky top-0 bg-background z-10 border-b shadow-sm">
                      <TableRow>
                        <TableHead className="w-10 text-center">Sel.</TableHead>
                        <TableHead className="w-24">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-24">Tipo</TableHead>
                        <TableHead className="w-48">Categoria</TableHead>
                        <TableHead className="w-28 text-right">Valor</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedList.map((tx) => {
                        const isSelected = selectedIds.has(tx.id);
                        return (
                          <TableRow
                            key={tx.id}
                            className={`hover:bg-muted/40 transition-colors ${
                              tx.isDuplicate ? 'opacity-60 bg-muted/20' : ''
                            } ${isSelected ? 'bg-primary/5' : ''}`}
                          >
                            <TableCell className="text-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectTx(tx.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-[11px]">
                              {formatDate(tx.date)}
                            </TableCell>
                            <TableCell className="font-medium max-w-[250px] truncate" title={tx.description}>
                              {tx.description}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={tx.type}
                                onValueChange={(val: 'income' | 'expense') => handleUpdateType(tx.id, val)}
                              >
                                <SelectTrigger className="h-7 text-[11px] px-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="expense" className="text-destructive text-xs">
                                    Despesa
                                  </SelectItem>
                                  <SelectItem value="income" className="text-emerald-500 text-xs">
                                    Receita
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={tx.category_id || ''}
                                onValueChange={(val) => handleUpdateCategory(tx.id, val)}
                              >
                                <SelectTrigger className="h-7 text-[11px] px-2">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className={`text-right font-mono font-semibold ${
                              tx.type === 'income' ? 'text-emerald-500' : 'text-destructive'
                            }`}>
                              {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              {tx.isDuplicate ? (
                                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10">
                                  Duplicada
                                </Badge>
                              ) : tx.category_id ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                                  Regra
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30 bg-blue-500/10">
                                  Nova
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Rodapé da Importação: Totais e Botão de Salvar */}
                <div className="p-3 border-t bg-muted/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Selecionadas:</span>{' '}
                      <strong>{batchStats.count}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Receitas:</span>{' '}
                      <span className="text-emerald-500 font-semibold">{formatCurrency(batchStats.income)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Despesas:</span>{' '}
                      <span className="text-destructive font-semibold">{formatCurrency(batchStats.expense)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mr-2">
                      <Checkbox
                        checked={autoLearnRules}
                        onCheckedChange={(checked) => setAutoLearnRules(!!checked)}
                      />
                      <span>Auto-aprender regras</span>
                    </label>

                    <Button
                      size="sm"
                      disabled={isImporting || batchStats.count === 0 || !selectedAccountId}
                      onClick={handleConfirmImport}
                      className="text-xs min-w-[140px]"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importando...
                        </>
                      ) : (
                        `Importar (${batchStats.count})`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ABA 2: REGRAS DE AUTOMAÇÃO */}
          <TabsContent value="rules" className="flex-1 flex flex-col overflow-hidden space-y-3 m-0">
            {/* Formulário de Nova Regra */}
            <div className="p-3 bg-muted/30 border rounded-lg space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" /> Adicionar Regra Declarativa
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[11px]">Nome da Regra (Opcional)</Label>
                  <Input
                    placeholder="Ex: Assinatura Spotify"
                    className="h-8 text-xs mt-1"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Se a descrição contiver *</Label>
                  <Input
                    placeholder="Ex: spotify, netflix, uber"
                    className="h-8 text-xs mt-1"
                    value={newRuleKeyword}
                    onChange={(e) => setNewRuleKeyword(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Atribuir Categoria *</Label>
                  <Select value={newRuleCategoryId} onValueChange={setNewRuleCategoryId}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Selecione a categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button size="sm" className="h-8 w-full text-xs" onClick={handleAddManualRule}>
                    Adicionar Regra
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Regras com Scroll */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 bg-background z-10 border-b">
                  <TableRow>
                    <TableHead className="w-16 text-center">Ativa</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Condições</TableHead>
                    <TableHead>Ação (Categoria / Tipo)</TableHead>
                    <TableHead className="w-20 text-center">Origem</TableHead>
                    <TableHead className="w-16 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const conditionsStr = rule.conditions
                      .map((c) => `[${c.field}] ${c.operator} "${c.value}"`)
                      .join(' ou ');

                    return (
                      <TableRow key={rule.id} className="hover:bg-muted/30">
                        <TableCell className="text-center">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggleRule(rule.id, rule.enabled)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground truncate max-w-[250px]" title={conditionsStr}>
                          {conditionsStr}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {rule.action.category_name || 'Sem categoria'}
                          </Badge>
                          {rule.action.type && (
                            <span className="text-[10px] ml-1.5 text-muted-foreground">
                              ({rule.action.type === 'income' ? 'Receita' : 'Despesa'})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.isSystemDefault ? (
                            <Badge variant="outline" className="text-[10px] border-muted-foreground/30">
                              Sistema
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                              Usuário
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {!rule.isSystemDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Botão de Restaurar Padrão */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                Regras são avaliadas em cascata por prioridade ao processar arquivos OFX e CSV.
              </span>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleResetRules}>
                <RotateCcw className="h-3 w-3 mr-1.5" /> Restaurar Padrões
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
