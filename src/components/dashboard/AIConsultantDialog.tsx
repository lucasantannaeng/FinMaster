import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, User, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sanitizeHtml } from '@/lib/sanitize';
import { getSecureItem } from '@/lib/secureStorage';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PortfolioContext {
  fiatBalance: number;
  totalEquityUsdt: number;
  totalCryptoBrl: number;
  totalPatrimonyBrl: number;
  assets: Array<{
    currency: string;
    equity: number;
    priceUsdt: number;
    valueBrl: number;
    change24h: number;
  }>;
  ethExposure: number;
  ethExposureTotal: number;
  ethLimit: number;
  isOverLimit: boolean;
  monthlyIncome?: number;
  monthExpense?: number;
  totalCardDebt?: number;
  burnRateMonths?: number | null;
  topExpenseCategories?: Array<{
    category: string;
    amount: number;
    percent: number;
  }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioContext: PortfolioContext;
  initialMessage?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-consultant`;

const AIConsultantDialog = ({ open, onOpenChange, portfolioContext, initialMessage }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSent = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Send initial message when dialog opens with context (ref-guarded, one-shot)
  useEffect(() => {
    if (open && initialMessage && !initialSent.current && messages.length === 0) {
      initialSent.current = true;
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      initialSent.current = false;
      setMessages([]);
      setInput('');
    }
  }, [open]);

  const streamChat = useCallback(async (allMessages: Message[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('Você precisa estar logado para usar o consultor.');

    const customApiKey = typeof window !== 'undefined'
      ? (await getSecureItem('CUSTOM_AI_API_KEY')) || localStorage.getItem('CUSTOM_AI_API_KEY')
      : null;
    const customProvider = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_AI_PROVIDER') : null;
    const customSupabaseKey = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') : null;

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: customSupabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key',
      },
      body: JSON.stringify({
        messages: allMessages,
        portfolioContext,
        customApiKey,
        customProvider,
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${resp.status}`);
    }

    if (!resp.body) throw new Error('Stream não disponível');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantSoFar = '';

    const updateAssistant = (content: string) => {
      assistantSoFar = content;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
        }
        return [...prev, { role: 'assistant', content }];
      });
    };

    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            updateAssistant(assistantSoFar);
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            updateAssistant(assistantSoFar);
          }
        } catch { /* ignore */ }
      }
    }
  }, [portfolioContext]);

  const sendMessage = async (text: string) => {
    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat(updatedMessages);
    } catch (e: any) {
      console.error('AI consultant error:', e);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${e.message || 'Erro ao conectar com o consultor IA. Tente novamente.'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
  };

  const quickActions = [
    {
      label: '📉 Quitação de dívidas',
      msg: 'Analise minhas faturas de cartão e despesas mensais e elabore um plano de quitação de dívidas (comparando os métodos Bola de Neve e Avalanche) com cronograma estimado mês a mês e economia de juros.',
    },
    {
      label: '💰 Simular aporte mensal',
      msg: 'Com base no meu saldo fiduciário, renda, despesas e patrimônio atual, elabore uma sugestão de alocação de aportes mensais dividida entre Reserva de Emergência, Renda Fixa e Criptoativos.',
    },
    {
      label: '⚖️ Rebalancear patrimônio',
      msg: 'Avalie a distribuição atual do meu patrimônio entre Fiat (BRL) e Criptoativos. Indique desvios em relação à minha exposição e sugira um plano de rebalanceamento seguro.',
    },
    {
      label: '🎯 Liberdade financeira',
      msg: 'Com base no meu patrimônio total fiduciário e cripto e no meu custo de vida mensal (burn rate), calcule meu tempo estimado para atingir a independência financeira pela Regra dos 4%.',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[85vh] max-h-[700px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span>FinMaster AI</span>
              <p className="text-[10px] text-muted-foreground font-normal">Consultor Financeiro Pessoal</p>
            </div>
            <Badge variant="secondary" className="text-[10px] ml-auto bg-primary/10 text-primary border-0">
              <Sparkles className="h-3 w-3 mr-0.5" />
              IA
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">Chat com consultor financeiro IA</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Bot className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Olá! Sou o FinMaster AI</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                    Seu consultor financeiro pessoal. Tenho acesso ao seu portfólio em tempo real para dar sugestões personalizadas.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((qa, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-[11px] h-auto py-2.5 px-3 text-left justify-start leading-tight whitespace-normal"
                      onClick={() => sendMessage(qa.msg)}
                      disabled={isLoading}
                    >
                      {qa.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary/10 text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-1.5 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground">
                      <ReactMarkdown>{sanitizeHtml(msg.content)}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2.5 justify-start">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-secondary/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 border-t border-border shrink-0 flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seu portfólio..."
            className="text-xs h-10"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AIConsultantDialog;
