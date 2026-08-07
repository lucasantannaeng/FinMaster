import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Camera, Image as ImageIcon, Sparkles, Loader2, X, Check, SkipForward, AlertTriangle, DollarSign, Copy, Calendar, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';

interface TransactionData {
  description?: string;
  amount?: number;
  date?: string;
  type?: 'income' | 'expense' | 'transfer';
  category_name?: string;
  account_name?: string;
  card_name?: string;
  payment_method?: string;
  contact_name?: string;
  recurrence?: string;
  installments?: number;
  is_anomaly?: boolean;
  anomaly_reason?: string;
  is_duplicate?: boolean;
  duplicate_reason?: string;
  is_future?: boolean;
  schedule_suggestion?: string;
  original_currency?: string;
}

type QueueItemStatus = 'pending' | 'confirmed' | 'ignored';

interface QueueItem {
  data: TransactionData;
  status: QueueItemStatus;
}

interface SmartTransactionInputProps {
  categories: Array<{ id: string; name: string; type: string }>;
  accounts?: Array<{ id: string; name: string }>;
  cards?: Array<{ id: string; name: string }>;
  contacts?: Array<{ id: string; name: string }>;
  onParsed: (data: TransactionData) => void;
  onBatchStart?: () => void;
  onBatchEnd?: () => void;
  onConfirm?: () => void;
  onIgnore?: () => void;
}

export interface SmartTransactionInputHandle {
  handleBatchNext: () => void;
  handleConfirmCurrent: () => void;
  handleIgnoreCurrent: () => void;
}

// Category overrides stored in localStorage for auto-learning
const OVERRIDES_KEY = 'ai_category_overrides';

function getCategoryOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
  } catch { return {}; }
}

export function saveCategoryOverride(description: string, categoryName: string) {
  const overrides = getCategoryOverrides();
  const key = description.toLowerCase().trim().slice(0, 50);
  overrides[key] = categoryName;
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

const SmartTransactionInput = forwardRef<SmartTransactionInputHandle, SmartTransactionInputProps>(
  ({ categories, accounts, cards, contacts, onParsed, onBatchStart, onBatchEnd, onConfirm, onIgnore }, ref) => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // Queue state
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [queueIndex, setQueueIndex] = useState(0);
    const [batchMode, setBatchMode] = useState(false);

    useImperativeHandle(ref, () => ({
      handleBatchNext,
      handleConfirmCurrent,
      handleIgnoreCurrent,
    }));

    const currentItem = batchMode ? queue[queueIndex] : null;
    const totalItems = queue.length;
    const confirmedCount = queue.filter(q => q.status === 'confirmed').length;
    const processedCount = queue.filter(q => q.status !== 'pending').length;
    const progressPercent = totalItems > 0 ? (processedCount / totalItems) * 100 : 0;

    const parseWithAI = async (inputText?: string, imgBase64?: string) => {
      const finalText = inputText || text;
      if (!finalText && !imgBase64 && !imageBase64) {
        toast.error('Digite, fale, ou envie uma foto/PDF');
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('parse-transaction', {
          body: {
            text: finalText,
            imageBase64: imgBase64 || imageBase64,
            categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
            accounts: accounts?.map(a => ({ id: a.id, name: a.name })),
            cards: cards?.map(c => ({ id: c.id, name: c.name })),
            contacts: contacts?.map(c => ({ id: c.id, name: c.name })),
            categoryOverrides: getCategoryOverrides(),
          },
        });

        if (error) { console.error('[parseWithAI] invoke error:', error); throw error; }
        if (!data) throw new Error('Resposta vazia da IA');
        if (data?.error) throw new Error(data.error);

        const transactions: TransactionData[] = data.transactions || [data];

        if (transactions.length > 1) {
          const items: QueueItem[] = transactions.map(t => ({ data: t, status: 'pending' as QueueItemStatus }));
          setQueue(items);
          setQueueIndex(0);
          setBatchMode(true);
          onBatchStart?.();
          onParsed(items[0].data);
          toast.success(`${transactions.length} transações encontradas! Revisando 1/${transactions.length}`);
        } else if (transactions.length === 1) {
          const tx = transactions[0];
          showAlerts(tx);
          onParsed(tx);
          toast.success('Dados extraídos com sucesso!');
        }

        setText('');
        setPreview(null);
        setImageBase64(null);
      } catch (err: any) {
        console.error('[parseWithAI] falhou:', err);
        toast.error(err?.message || 'Erro ao processar com IA');
      } finally {
        setLoading(false);
      }
    };

    // Invoca a IA em paralelo para múltiplos arquivos e agrega resultados em um único lote.
    const parseMultipleWithAI = async (base64List: string[]) => {
      setLoading(true);
      try {
        const payloadBase = {
          categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
          accounts: accounts?.map(a => ({ id: a.id, name: a.name })),
          cards: cards?.map(c => ({ id: c.id, name: c.name })),
          contacts: contacts?.map(c => ({ id: c.id, name: c.name })),
          categoryOverrides: getCategoryOverrides(),
        };

        const results = await Promise.allSettled(
          base64List.map((b64) =>
            supabase.functions
              .invoke('parse-transaction', { body: { ...payloadBase, imageBase64: b64 } })
              .then(({ data, error }) => {
                if (error) throw error;
                if (!data) throw new Error('Resposta vazia');
                if (data?.error) throw new Error(data.error);
                const txs: TransactionData[] = data.transactions || [data];
                return txs;
              })
          )
        );

        const aggregated: TransactionData[] = [];
        let failures = 0;
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            aggregated.push(...r.value);
          } else {
            failures++;
            console.error(`[parseMultipleWithAI] arquivo ${i + 1} falhou:`, r.reason);
            toast.error(`Arquivo ${i + 1}: ${r.reason?.message || 'falha na IA'}`);
          }
        });

        if (aggregated.length === 0) {
          toast.error('Nenhuma transação extraída');
          return;
        }

        const items: QueueItem[] = aggregated.map(t => ({ data: t, status: 'pending' as QueueItemStatus }));
        setQueue(items);
        setQueueIndex(0);
        setBatchMode(true);
        onBatchStart?.();
        onParsed(items[0].data);
        const okFiles = base64List.length - failures;
        toast.success(`${aggregated.length} transação(ões) em ${okFiles} arquivo(s). Revisando 1/${aggregated.length}`);

        setText('');
        setPreview(null);
        setImageBase64(null);
      } catch (err: any) {
        console.error('[parseMultipleWithAI] falhou:', err);
        toast.error(err?.message || 'Erro ao processar lote');
      } finally {
        setLoading(false);
      }
    };

    const showAlerts = (tx: TransactionData) => {
      if (tx.is_anomaly) {
        toast.warning(`⚠️ Anomalia: ${tx.description} — ${tx.anomaly_reason}`, { duration: 6000 });
      }
      if (tx.is_duplicate) {
        toast.warning(`🔁 Possível duplicata: ${tx.duplicate_reason}`, { duration: 6000 });
      }
      if (tx.original_currency === 'USD') {
        toast.info(`💱 Convertido de USD para BRL`, { duration: 4000 });
      }
      if (tx.is_future) {
        toast.info(`📅 ${tx.schedule_suggestion || 'Data futura detectada — considere agendar'}`, { duration: 5000 });
      }
    };

    // Navigate to next pending item in queue
    const findNextPending = (fromIndex: number): number => {
      for (let i = fromIndex; i < queue.length; i++) {
        if (queue[i].status === 'pending') return i;
      }
      return -1;
    };

    const handleConfirmCurrent = () => {
      if (!batchMode) return;
      setQueue(prevQueue => {
        const mutated = prevQueue.map((item, i) =>
          i === queueIndex ? { ...item, status: 'confirmed' as QueueItemStatus } : item
        );
        onConfirm?.();
        return mutated;
      });
    };

    const handleIgnoreCurrent = () => {
      if (!batchMode) return;
      setQueue(prevQueue => {
        const mutated = prevQueue.map((item, i) =>
          i === queueIndex ? { ...item, status: 'ignored' as QueueItemStatus } : item
        );
        onIgnore?.();
        advanceQueueFromSnapshot(mutated);
        return mutated;
      });
    };

    const handleBatchNext = () => {
      setQueue(prevQueue => {
        const mutated = prevQueue.map((item, i) =>
          i === queueIndex && item.status === 'pending'
            ? { ...item, status: 'confirmed' as QueueItemStatus }
            : item
        );
        advanceQueueFromSnapshot(mutated);
        return mutated;
      });
    };

    // Advances using the freshest snapshot to avoid stale closures.
    const advanceQueueFromSnapshot = (snapshot: QueueItem[]) => {
      setQueueIndex(prevIdx => {
        let nextIdx = -1;
        for (let i = prevIdx + 1; i < snapshot.length; i++) {
          if (snapshot[i].status === 'pending') { nextIdx = i; break; }
        }
        if (nextIdx >= 0) {
          const tx = snapshot[nextIdx].data;
          queueMicrotask(() => {
            showAlerts(tx);
            onParsed(tx);
            toast.info(`Revisando ${nextIdx + 1}/${snapshot.length}`);
          });
          return nextIdx;
        }
        queueMicrotask(() => finishBatchFromSnapshot(snapshot));
        return prevIdx;
      });
    };

    const advanceQueue = () => {
      setQueue(prevQueue => {
        advanceQueueFromSnapshot(prevQueue);
        return prevQueue;
      });
    };

    const finishBatchFromSnapshot = (snapshot: QueueItem[]) => {
      const confirmed = snapshot.filter(q => q.status === 'confirmed').length;
      setBatchMode(false);
      setQueue([]);
      setQueueIndex(0);
      onBatchEnd?.();
      toast.success(`Lote finalizado! ${confirmed} transação(ões) salva(s).`);
    };

    const handleBatchStop = () => {
      setBatchMode(false);
      setQueue([]);
      setQueueIndex(0);
      onBatchEnd?.();
      toast.success('Importação interrompida.');
    };

    // Effect: when queueIndex changes and item data is available, show alerts
    useEffect(() => {
      if (batchMode && currentItem) {
        showAlerts(currentItem.data);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queueIndex, batchMode]);

    const startVoice = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error('Reconhecimento de voz não suportado neste navegador');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setText(transcript);
        setListening(false);
        parseWithAI(transcript);
      };
      recognition.onerror = () => { setListening(false); toast.error('Erro no reconhecimento de voz'); };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    };

    const stopVoice = () => { recognitionRef.current?.stop(); setListening(false); };

    // Promisifica FileReader, lançando erros explícitos em vez de calar.
    const readFileAsDataURL = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string' || !result.startsWith('data:')) {
            reject(new Error('Falha ao ler arquivo (resultado inválido)'));
            return;
          }
          resolve(result);
        };
        reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
        reader.onabort = () => reject(new Error('Leitura abortada'));
        try {
          reader.readAsDataURL(file);
        } catch (err: any) {
          reject(err);
        }
      });

    // Comprime imagem via canvas (data URL JPEG). Fallback: retorna o original.
    const compressImage = async (
      file: File,
      maxDim = 1600,
      quality = 0.8
    ): Promise<string> => {
      try {
        const originalDataUrl = await readFileAsDataURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Imagem não pôde ser decodificada'));
          image.src = originalDataUrl;
        });

        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas indisponível');
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        if (!compressed || !compressed.startsWith('data:image/')) {
          throw new Error('Compressão produziu resultado inválido');
        }
        return compressed;
      } catch (err) {
        console.warn('[compressImage] fallback p/ original:', err);
        return readFileAsDataURL(file);
      }
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.target;
      const files = inputEl.files ? Array.from(inputEl.files) : [];
      if (files.length === 0) return;

      setLoading(true);
      try {
        // Processa cada arquivo em paralelo, isolando falhas individuais.
        const processed = await Promise.allSettled(
          files.map(async (file) => {
            const isPDF = file.type === 'application/pdf';
            const isImage = file.type.startsWith('image/');
            if (!isPDF && !isImage) throw new Error('Tipo não suportado (envie imagem ou PDF)');

            const maxSize = isPDF ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
            if (file.size > maxSize) {
              throw new Error(`Muito grande (máx ${isPDF ? 10 : 5}MB)`);
            }

            const base64 =
              isImage && file.size > 1 * 1024 * 1024
                ? await compressImage(file)
                : await readFileAsDataURL(file);

            if (!base64 || !base64.startsWith('data:')) {
              throw new Error('Base64 inválido');
            }
            return { file, base64, isImage, isPDF };
          })
        );

        const ok: Array<{ file: File; base64: string; isImage: boolean; isPDF: boolean }> = [];
        processed.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            ok.push(r.value);
          } else {
            const name = files[i]?.name || `arquivo ${i + 1}`;
            console.error(`[handleFile] ${name}:`, r.reason);
            toast.error(`Falha em ${name}: ${r.reason?.message || 'erro desconhecido'}`);
          }
        });

        if (ok.length === 0) {
          toast.error('Nenhum arquivo pôde ser processado');
          return;
        }

        // Preview da 1ª imagem (feedback visual durante o processamento da IA).
        const firstImage = ok.find(o => o.isImage);
        if (firstImage) {
          setPreview(firstImage.base64);
          setImageBase64(firstImage.base64);
        }

        // AUTO-INVOKE: dispara IA imediatamente, sem clique extra.
        if (ok.length === 1) {
          await parseWithAI(undefined, ok[0].base64);
        } else {
          await parseMultipleWithAI(ok.map(o => o.base64));
        }
      } catch (err: any) {
        console.error('[handleFile] falha global:', err);
        toast.error(err?.message || 'Erro ao processar arquivo(s)');
      } finally {
        setLoading(false);
        // Permite reupload do mesmo arquivo.
        try { inputEl.value = ''; } catch { /* noop */ }
      }
    };

    const clearPreview = () => { setPreview(null); setImageBase64(null); };

    return (
      <div className="space-y-2">
        {/* Review Queue */}
        {batchMode && currentItem && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4 space-y-3">
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Processando {queueIndex + 1} de {totalItems} transações</span>
                  <span>{confirmedCount} salva(s)</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>

              {/* Current transaction preview */}
              <div className="bg-background/50 rounded-md p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate flex-1">{currentItem.data.description || 'Sem descrição'}</span>
                  <span className={`text-sm font-bold ml-2 ${currentItem.data.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(currentItem.data.amount || 0)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentItem.data.date && (
                    <Badge variant="outline" className="text-[10px] h-5">{currentItem.data.date}</Badge>
                  )}
                  {currentItem.data.category_name && (
                    <Badge variant="secondary" className="text-[10px] h-5">{currentItem.data.category_name}</Badge>
                  )}
                  {currentItem.data.payment_method && (
                    <Badge variant="outline" className="text-[10px] h-5">{currentItem.data.payment_method}</Badge>
                  )}
                  {currentItem.data.installments && currentItem.data.installments > 1 && (
                    <Badge variant="outline" className="text-[10px] h-5">{currentItem.data.installments}x</Badge>
                  )}
                </div>
              </div>

              {/* Alerts */}
              {currentItem.data.is_anomaly && (
                <p className="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {currentItem.data.anomaly_reason}
                </p>
              )}
              {currentItem.data.is_duplicate && (
                <p className="text-[11px] text-warning bg-warning/10 rounded px-2 py-1 flex items-center gap-1">
                  <Copy className="h-3 w-3 shrink-0" />
                  {currentItem.data.duplicate_reason}
                </p>
              )}
              {currentItem.data.is_future && (
                <p className="text-[11px] text-accent-foreground bg-accent rounded px-2 py-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {currentItem.data.schedule_suggestion || 'Data futura — considere agendar'}
                </p>
              )}
              {currentItem.data.original_currency === 'USD' && (
                <p className="text-[11px] text-primary bg-primary/10 rounded px-2 py-1 flex items-center gap-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  Convertido de USD para BRL
                </p>
              )}

              {/* Actions: Confirm / Edit (via form) / Ignore */}
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={handleBatchNext}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    // The form is already populated — user edits and saves via form submit
                    toast.info('Edite os campos abaixo e salve');
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleIgnoreCurrent}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Ignorar
                </Button>
              </div>

              {/* Stop batch */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={handleBatchStop}
              >
                <SkipForward className="h-3 w-3 mr-1" />
                Parar importação
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Input row - hidden during batch mode */}
        {!batchMode && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Sparkles className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: almoco 35 reais hoje..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      parseWithAI();
                    }
                  }}
                  className="pl-9 h-10"
                  disabled={loading}
                />
              </div>
              <Button
                type="button"
                variant={listening ? 'destructive' : 'outline'}
                size="icon"
                onClick={listening ? stopVoice : startVoice}
                disabled={loading}
                className="shrink-0"
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => cameraInputRef.current?.click()}
                disabled={loading}
                className="shrink-0"
                title="Tirar Foto"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="shrink-0"
                title="Galeria"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={() => parseWithAI()}
                disabled={loading || (!text && !imageBase64)}
                className="shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFile}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />

            {preview && (
              <div className="relative inline-block">
                <img src={preview} alt="Preview" className="h-20 rounded-md border border-border object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-5 w-5"
                  onClick={clearPreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {listening && (
              <p className="text-xs text-muted-foreground animate-pulse">
                🎙️ Ouvindo... fale a transação
              </p>
            )}
          </>
        )}
      </div>
    );
  }
);

export default SmartTransactionInput;
