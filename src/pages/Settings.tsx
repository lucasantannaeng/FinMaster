import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Link2,
  Eye,
  EyeOff,
  Shield,
  Bell,
  ChevronRight,
  Fingerprint,
  Coins,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppSettings } from '@/hooks/useAppSettings';
import SubscriptionAlerts from '@/components/settings/SubscriptionAlerts';

const Settings = () => {
  const { discreteMode, setDiscreteMode, baseCurrency, setBaseCurrency } = useAppSettings();
  const [biometric, setBiometric] = useState(() => localStorage.getItem('biometric_enabled') === 'true');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [alertBudget, setAlertBudget] = useState(true);

  useEffect(() => {
    // Check WebAuthn support
    const checkSupport = async () => {
      const supported = typeof window !== 'undefined' && !!(window.PublicKeyCredential);
      if (supported) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricSupported(available);
          if (!available && biometric) {
            setBiometric(false);
            localStorage.removeItem('biometric_enabled');
          }
        } catch {
          setBiometricSupported(false);
        }
      } else {
        setBiometricSupported(false);
      }
    };
    checkSupport();
  }, [biometric]);

  const handleBiometricToggle = async (checked: boolean) => {
    if (!biometricSupported) {
      toast.error('Autenticação biométrica não é suportada neste dispositivo');
      return;
    }

    if (checked) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
          toast.error('Nenhum autenticador biométrico encontrado neste dispositivo');
          return;
        }
        setBiometric(true);
        localStorage.setItem('biometric_enabled', 'true');
        toast.success('Biometria WebAuthn ativada com sucesso');
      } catch {
        toast.error('Erro ao configurar biometria');
      }
    } else {
      setBiometric(false);
      localStorage.removeItem('biometric_enabled');
      toast.success('Biometria desativada');
    }
  };

  return (
    <div className="p-5 space-y-5">
      <div className="pt-3 pb-1">
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Preferências</p>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      </div>

      {/* Connections */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Gerenciamento de Conexões
          </CardTitle>
          <CardDescription className="text-xs">
            Gerencie suas integrações com serviços externos
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-between h-12 px-3"
            onClick={() => toast.info('Acesse o painel da OKX para gerar novas chaves API')}
          >
            <div className="flex items-center gap-3">
              <Coins className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">OKX Exchange</p>
                <p className="text-[11px] text-muted-foreground">Chaves API configuradas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">Conectado</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Preferências de Exibição
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Moeda Base</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Exibir valores convertidos para
              </p>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <Button
                variant={baseCurrency === 'BRL' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => {
                  setBaseCurrency('BRL');
                  toast.success('Moeda base: BRL');
                }}
              >
                R$ BRL
              </Button>
              <Button
                variant={baseCurrency === 'USDT' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => {
                  setBaseCurrency('USDT');
                  toast.success('Moeda base: USDT');
                }}
              >
                $ USDT
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Precisão Decimal</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cripto: 5 casas · Fiat: 2 casas
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">Padrão</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Segurança e Privacidade
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {discreteMode ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              <div>
                <Label className="text-sm font-medium">Modo Discreto</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Oculta saldos com ••••
                </p>
              </div>
            </div>
            <Switch
              checked={discreteMode}
              onCheckedChange={(checked) => {
                setDiscreteMode(checked);
                toast.success(checked ? 'Modo discreto ativado' : 'Modo discreto desativado');
              }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Autenticação Biométrica</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {biometricSupported ? 'Face ID / Impressão digital' : 'Não suportado neste dispositivo'}
                </p>
              </div>
            </div>
            {biometricSupported ? (
              <Switch
                checked={biometric}
                onCheckedChange={handleBiometricToggle}
              />
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                Indisponível
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Alerts */}
      <SubscriptionAlerts />

      {/* Notifications */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Alerta de Orçamento</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avisar quando gasto atingir 80% da meta
              </p>
            </div>
            <Switch
              checked={alertBudget}
              onCheckedChange={(checked) => {
                setAlertBudget(checked);
                toast.success(checked ? 'Alertas ativados' : 'Alertas desativados');
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Supabase Connection Setup (Para quem clonar o repositório) */}
      <SupabaseConfigCard />

      {/* AI Consultant Keys (Gemini, OpenAI, Groq, OpenRouter) */}
      <AIConfigCard />

      {/* OKX API Credentials */}
      <OKXConfigCard />
    </div>
  );
};

const SupabaseConfigCard = () => {
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('CUSTOM_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      toast.error('Informe a URL e a Anon Key do Supabase');
      return;
    }
    localStorage.setItem('CUSTOM_SUPABASE_URL', supabaseUrl.trim());
    localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', supabaseKey.trim());
    toast.success('Credenciais do Supabase salvas! Recarregando aplicação...');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleReset = () => {
    localStorage.removeItem('CUSTOM_SUPABASE_URL');
    localStorage.removeItem('CUSTOM_SUPABASE_ANON_KEY');
    setSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
    setSupabaseKey(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
    toast.info('Restaurado para variáveis de ambiente padrão.');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <Card className="shadow-sm border-brand-500/20">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Conexão Supabase (Banco de Dados & Auth)
        </CardTitle>
        <CardDescription className="text-xs">
          Permite que qualquer pessoa que clone o app use seu próprio projeto Supabase sem alterar o código.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 space-y-3 pt-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Supabase Project URL</Label>
          <input
            type="text"
            className="w-full text-xs p-2.5 rounded-lg border border-input bg-background font-mono"
            placeholder="https://xyzcompany.supabase.co"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Supabase Anon / Public Key</Label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              className="w-full text-xs p-2.5 pr-10 rounded-lg border border-input bg-background font-mono"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} className="text-xs">
            Salvar Conexão
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} className="text-xs">
            Restaurar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AIConfigCard = () => {
  const [provider, setProvider] = useState(() => localStorage.getItem('CUSTOM_AI_PROVIDER') || 'gemini');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('CUSTOM_AI_API_KEY') || '');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    localStorage.setItem('CUSTOM_AI_PROVIDER', provider);
    if (apiKey.trim()) {
      localStorage.setItem('CUSTOM_AI_API_KEY', apiKey.trim());
      toast.success('Chave de IA configurada com sucesso!');
    } else {
      localStorage.removeItem('CUSTOM_AI_API_KEY');
      toast.info('Provedor salvo. Usando chave padrão da Edge Function.');
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          Consultor Financeiro IA (Chaves de API)
        </CardTitle>
        <CardDescription className="text-xs">
          Configure seu provedor de IA preferido para o FinMaster AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 space-y-3 pt-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Provedor de IA</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-input bg-background"
          >
            <option value="gemini">Google Gemini (Oficial / Gratuito)</option>
            <option value="groq">Groq (Ultra-rápido Llama 3)</option>
            <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
            <option value="openrouter">OpenRouter (Multi-modelos)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Chave de API (Opcional - Sobrescreve padrão)</Label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              className="w-full text-xs p-2.5 pr-10 rounded-lg border border-input bg-background font-mono"
              placeholder="Cole sua API Key (ex: AIzaSy..., gsk_..., sk-...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} className="text-xs">
          Salvar Configurações de IA
        </Button>
      </CardContent>
    </Card>
  );
};

const OKXConfigCard = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('OKX_API_KEY') || '');
  const [secretKey, setSecretKey] = useState(() => localStorage.getItem('OKX_SECRET_KEY') || '');
  const [passphrase, setPassphrase] = useState(() => localStorage.getItem('OKX_PASSPHRASE') || '');
  const [showKeys, setShowKeys] = useState(false);

  const handleSave = () => {
    if (apiKey.trim()) localStorage.setItem('OKX_API_KEY', apiKey.trim());
    else localStorage.removeItem('OKX_API_KEY');

    if (secretKey.trim()) localStorage.setItem('OKX_SECRET_KEY', secretKey.trim());
    else localStorage.removeItem('OKX_SECRET_KEY');

    if (passphrase.trim()) localStorage.setItem('OKX_PASSPHRASE', passphrase.trim());
    else localStorage.removeItem('OKX_PASSPHRASE');

    toast.success('Credenciais da OKX salvas localmente com sucesso!');
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          Integração CEX (OKX Exchange)
        </CardTitle>
        <CardDescription className="text-xs">
          Permite sincronizar saldos de criptomoedas da sua conta OKX (somente leitura).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 space-y-3 pt-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">OKX API Key</Label>
          <input
            type={showKeys ? 'text' : 'password'}
            className="w-full text-xs p-2.5 rounded-lg border border-input bg-background font-mono"
            placeholder="Sua API Key OKX"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">OKX Secret Key</Label>
          <input
            type={showKeys ? 'text' : 'password'}
            className="w-full text-xs p-2.5 rounded-lg border border-input bg-background font-mono"
            placeholder="Sua Secret Key OKX"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">OKX Passphrase</Label>
          <input
            type={showKeys ? 'text' : 'password'}
            className="w-full text-xs p-2.5 rounded-lg border border-input bg-background font-mono"
            placeholder="Sua Passphrase OKX"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button size="sm" onClick={handleSave} className="text-xs">
            Salvar Chaves OKX
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowKeys(!showKeys)}
            className="text-xs text-muted-foreground"
          >
            {showKeys ? 'Ocultar Chaves' : 'Visualizar Chaves'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Settings;

