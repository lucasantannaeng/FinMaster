import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { Camera, Upload, Loader2, CheckCircle2, X, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface OcrResult {
  cnpj_cpf: string | null;
  nome_prestador: string | null;
  valor: number | null;
  data: string | null;
  descricao: string | null;
  categoria_sugerida: string | null;
  is_deductible: boolean;
  deduction_type: string | null;
  confidence: string;
  raw_text: string | null;
  error?: string;
}

interface Props {
  onLinkTransaction?: (data: OcrResult) => void;
}

const CATEGORY_MAP: Record<string, string> = {
  saude: 'Saúde',
  educacao: 'Educação',
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  moradia: 'Moradia',
  lazer: 'Lazer',
  outros: 'Outros',
};

export default function OCRScannerTab({ onLinkTransaction }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OcrResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 10MB)');
      return;
    }

    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-receipt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro de rede' }));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const data: OcrResult = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setResults(prev => [data, ...prev]);
        toast.success('Recibo processado!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Falha no OCR');
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const formatDateBR = (d: string | null) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardContent className="py-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Scanner de Recibos</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Envie uma foto ou PDF de recibo/nota fiscal. A IA extrai automaticamente os dados.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={loading} className="gap-2">
              <Camera className="h-4 w-4" /> Câmera
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading ? 'Processando...' : 'Enviar Arquivo'}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Results */}
      {results.map((result, i) => (
        <Card key={i} className={result.is_deductible ? 'border-primary/30' : ''}>
          <CardContent className="py-4 px-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{result.nome_prestador || 'Prestador não identificado'}</span>
              </div>
              <Badge variant={result.confidence === 'high' ? 'default' : 'secondary'} className="text-[9px]">
                {result.confidence === 'high' ? 'Alta' : result.confidence === 'medium' ? 'Média' : 'Baixa'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">CNPJ/CPF:</span>
                <span className="font-mono ml-1">{result.cnpj_cpf || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-mono font-bold ml-1">{result.valor ? formatCurrency(result.valor) : '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Data:</span>
                <span className="ml-1">{formatDateBR(result.data)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Categoria:</span>
                <span className="ml-1">{CATEGORY_MAP[result.categoria_sugerida || ''] || result.categoria_sugerida || '—'}</span>
              </div>
            </div>

            {result.descricao && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">{result.descricao}</p>
            )}

            <div className="flex items-center gap-2">
              {result.is_deductible && (
                <Badge className="text-[9px] gap-1">
                  ✓ Dedutível ({result.deduction_type})
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1"
              onClick={() => {
                if (onLinkTransaction) {
                  onLinkTransaction(result);
                } else {
                  toast.info('Vincule este recibo a uma transação na aba Transações.');
                }
              }}
            >
              <Plus className="h-3 w-3" /> Vincular a Transação
            </Button>
          </CardContent>
        </Card>
      ))}

      {results.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhum recibo processado ainda. Use os botões acima para digitalizar.
        </p>
      )}
    </div>
  );
}
