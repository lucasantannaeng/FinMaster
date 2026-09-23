import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ParsedTx {
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category_id?: string;
  account_id?: string;
  card_id?: string;
}

export default function GlobalVoiceInput() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedTx, setParsedTx] = useState<ParsedTx>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
  });

  const recognitionRef = useRef<any>(null);

  // Queries para mapear IDs das entidades
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name, type');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, name');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('credit_cards').select('id, name');
      return data || [];
    },
    enabled: !!user,
  });

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setListening(false);
  };

  const processVoiceText = async (rawText: string) => {
    if (!rawText.trim()) return;
    setProcessing(true);
    const toastId = toast.loading('Processando fala com IA...');

    try {
      const { data, error } = await supabase.functions.invoke('parse-transaction', {
        body: {
          text: rawText,
          categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
          accounts: accounts.map(a => ({ id: a.id, name: a.name })),
          cards: cards.map(c => ({ id: c.id, name: c.name })),
        },
      });

      toast.dismiss(toastId);

      if (error) throw error;
      if (!data) throw new Error('Não foi possível interpretar a fala');

      const txData = data.transactions ? data.transactions[0] : data;
      if (!txData || (!txData.amount && !txData.description)) {
        throw new Error('Nenhum dado financeiro compreendido na frase');
      }

      // Encontra IDs correspondentes
      const catMatch = txData.category_name
        ? categories.find(c => c.name.toLowerCase() === txData.category_name.toLowerCase())
        : undefined;
      const accMatch = txData.account_name
        ? accounts.find(a => a.name.toLowerCase() === txData.account_name.toLowerCase())
        : undefined;
      const cardMatch = txData.card_name
        ? cards.find(c => c.name.toLowerCase() === txData.card_name.toLowerCase())
        : undefined;

      setParsedTx({
        description: txData.description || 'Gasto registrado por voz',
        amount: Number(txData.amount) || 0,
        date: txData.date || new Date().toISOString().split('T')[0],
        type: (txData.type as any) || 'expense',
        category_id: catMatch?.id || '',
        account_id: accMatch?.id || '',
        card_id: cardMatch?.id || '',
      });

      setReviewOpen(true);
      toast.success('Gasto interpretado! Confira e confirme.');
    } catch (err: any) {
      toast.dismiss(toastId);
      console.warn('[GlobalVoiceInput] Falha ao processar voz:', err);
      toast.error(err.message || 'Erro ao processar fala.');
    } finally {
      setProcessing(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Reconhecimento de voz não suportado neste navegador/ambiente.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setListening(true);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (e: any) => {
        console.warn('[GlobalVoiceInput] Erro reconhecimento:', e);
        setListening(false);
        if (e.error !== 'no-speech') {
          toast.error('Não foi possível capturar o áudio. Verifique as permissões de microfone.');
        }
      };

      recognition.onend = () => {
        setListening(false);
        if (transcript.trim()) {
          processVoiceText(transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('[GlobalVoiceInput] Exceção ao iniciar áudio:', err);
      setListening(false);
      toast.error('Erro ao acessar microfone.');
    }
  };

  const handleSaveTransaction = async () => {
    if (!user?.id) return;
    if (!parsedTx.description.trim() || parsedTx.amount <= 0) {
      toast.error('Informe uma descrição válida e um valor maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        user_id: user.id,
        description: parsedTx.description,
        amount: parsedTx.amount,
        date: parsedTx.date,
        type: parsedTx.type,
        category_id: parsedTx.category_id || null,
        account_id: parsedTx.account_id || null,
        card_id: parsedTx.card_id || null,
        is_paid: true,
      };

      const { error } = await supabase.from('transactions').insert(payload as any);
      if (error) throw error;

      if (parsedTx.account_id) {
        const delta = parsedTx.type === 'income' ? parsedTx.amount : -parsedTx.amount;
        await supabase.rpc('update_account_balance', {
          p_account_id: parsedTx.account_id,
          p_delta: delta,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      await queryClient.invalidateQueries({ queryKey: ['burn-rate'] });

      toast.success('Transação lançada com sucesso!');
      setReviewOpen(false);
      setTranscript('');
    } catch (err: any) {
      console.error('[GlobalVoiceInput] Falha ao salvar:', err);
      toast.error(err.message || 'Erro ao salvar transação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Botão no Header */}
      <Button
        variant="ghost"
        size="sm"
        onClick={listening ? stopListening : startListening}
        disabled={processing}
        className={`h-8 px-2.5 text-xs font-medium gap-1.5 transition-all ${
          listening
            ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25 animate-pulse'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Lançamento Rápido por Voz"
      >
        {processing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : listening ? (
          <MicOff className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
        <span className="hidden md:inline">
          {processing ? 'Processando...' : listening ? 'Ouvindo...' : 'Voz'}
        </span>
      </Button>

      {/* Floating Action Button exclusivo para Mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <Button
          size="icon"
          onClick={listening ? stopListening : startListening}
          disabled={processing}
          className={`h-13 w-13 rounded-full shadow-lg transition-all ${
            listening
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-4 ring-red-500/30'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
          title="Falar Gasto"
        >
          {processing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : listening ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Overlay de Escuta Ativa */}
      {listening && (
        <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-background/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-2xl p-4 max-w-md w-full pointer-events-auto flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="h-10 w-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
              <Mic className="h-5 w-5 text-red-500 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Ouvindo sua fala...</p>
              <p className="text-xs text-muted-foreground truncate">
                {transcript || "Fale algo como: 'Almoço 45 reais no cartão'"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              onClick={() => {
                stopListening();
                if (transcript.trim()) processVoiceText(transcript);
              }}
            >
              Concluir
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Revisão da Transação por Voz */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Confirmar Lançamento por Voz
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A IA interpretou a sua fala. Ajuste os detalhes se necessário antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={parsedTx.description}
                onChange={e => setParsedTx({ ...parsedTx, description: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={parsedTx.amount || ''}
                  onChange={e => setParsedTx({ ...parsedTx, amount: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={parsedTx.date}
                  onChange={e => setParsedTx({ ...parsedTx, date: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={parsedTx.category_id || 'none'}
                onValueChange={v => setParsedTx({ ...parsedTx, category_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Conta</Label>
                <Select
                  value={parsedTx.account_id || 'none'}
                  onValueChange={v => setParsedTx({ ...parsedTx, account_id: v === 'none' ? '' : v, card_id: v !== 'none' ? '' : parsedTx.card_id })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cartão de Crédito</Label>
                <Select
                  value={parsedTx.card_id || 'none'}
                  onValueChange={v => setParsedTx({ ...parsedTx, card_id: v === 'none' ? '' : v, account_id: v !== 'none' ? '' : parsedTx.account_id })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {cards.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTransaction}
              disabled={saving || !parsedTx.description.trim() || parsedTx.amount <= 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Salvar Transação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
