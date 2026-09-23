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
  Sparkles,
  Lock,
  Unlock,
  ShieldCheck,
  Download,
  Upload,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useAppLock } from '@/hooks/useAppLock';
import { SecurityVaultDialogs } from '@/components/settings/SecurityVaultDialogs';
import SubscriptionAlerts from '@/components/settings/SubscriptionAlerts';
import { setSecureItem, getSecureItem, removeSecureItem } from '@/lib/secureStorage';

const Settings = () => {
  const { discreteMode, setDiscreteMode, baseCurrency, setBaseCurrency } = useAppSettings();
  const {
    isPinConfigured,
    autoLockMinutes,
    lockApp,
    setupPin,
    removePin,
    updateAutoLockMinutes,
  } = useAppLock();

  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [removePinInput, setRemovePinInput] = useState('');
  const [showRemovePin, setShowRemovePin] = useState(false);

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

      {/* Security & Vault */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Segurança, Privacidade & Cofre Criptografado
          </CardTitle>
          <CardDescription className="text-xs">
            Proteção local avançada com PIN numérico, bloqueio por inatividade e backup criptografado AES-256.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 space-y-4">
          {/* Modo Discreto / Atalho de Pânico */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {discreteMode ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Modo Discreto</Label>
                  <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 text-muted-foreground">
                    Ctrl + H
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Oculta instantaneamente todos os saldos e valores da tela (Atalho de Pânico).
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

          {/* Bloqueio por PIN & Inatividade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Bloqueio do Aplicativo (PIN Lock)</Label>
                    {isPinConfigured ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                        Ativo (4-6 Dígitos)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Desativado
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Exige confirmação de PIN numérico ao abrir o app ou após tempo sem uso.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isPinConfigured ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPinModalOpen(true)}
                    >
                      Alterar PIN
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setShowRemovePin(true)}
                    >
                      Remover
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setPinModalOpen(true)}
                  >
                    Configurar PIN
                  </Button>
                )}
              </div>
            </div>

            {/* Diálogo em linha para confirmar remoção de PIN */}
            {showRemovePin && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2 text-xs">
                <p className="font-semibold text-destructive">Digite seu PIN atual para desativar o bloqueio:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="PIN atual"
                    value={removePinInput}
                    onChange={(e) => setRemovePinInput(e.target.value)}
                    className="h-8 px-2 rounded border text-xs bg-background w-32 font-mono"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={async () => {
                      const success = await removePin(removePinInput);
                      if (success) {
                        setShowRemovePin(false);
                        setRemovePinInput('');
                      }
                    }}
                  >
                    Confirmar Desativação
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => {
                      setShowRemovePin(false);
                      setRemovePinInput('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Tempo de Bloqueio por Inatividade */}
            {isPinConfigured && (
              <div className="flex items-center justify-between pl-7 pt-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Bloquear por inatividade após:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '1m', val: 1 },
                    { label: '5m', val: 5 },
                    { label: '15m', val: 15 },
                    { label: 'Nunca', val: 0 },
                  ].map((item) => (
                    <Button
                      key={item.label}
                      variant={autoLockMinutes === item.val ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => updateAutoLockMinutes(item.val)}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-[11px] ml-2 text-primary"
                    onClick={() => lockApp()}
                  >
                    Bloquear Agora
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Autenticação Biométrica */}
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

          <Separator />

          {/* Cofre Criptografado (AES-256 E2EE Backup) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm font-medium">Cofre de Backup Criptografado (E2EE)</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Exporte ou restaure suas finanças em formato seguro (.finmaster.enc) protegido por AES-256 bits.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 sm:flex-none"
                onClick={() => setExportOpen(true)}
              >
                <Download className="h-3.5 w-3.5 mr-1 text-primary" /> Exportar Cofre
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 sm:flex-none"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Restaurar Cofre
              </Button>
            </div>
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

      {/* Diálogos de Segurança, PIN e Cofre Criptografado */}
      <SecurityVaultDialogs
        exportOpen={exportOpen}
        onExportOpenChange={setExportOpen}
        importOpen={importOpen}
        onImportOpenChange={setImportOpen}
        pinModalOpen={pinModalOpen}
        onPinModalOpenChange={setPinModalOpen}
        onPinConfigured={setupPin}
      />
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
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSecureItem('CUSTOM_AI_API_KEY').then(val => {
      if (mounted && val) setApiKey(val);
      else if (mounted) {
        const legacy = localStorage.getItem('CUSTOM_AI_API_KEY');
        if (legacy) setApiKey(legacy);
      }
    });
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    localStorage.setItem('CUSTOM_AI_PROVIDER', provider);
    if (apiKey.trim()) {
      await setSecureItem('CUSTOM_AI_API_KEY', apiKey.trim());
      toast.success('Chave de IA configurada com criptografia AES-256!');
    } else {
      removeSecureItem('CUSTOM_AI_API_KEY');
      toast.info('Provedor salvo. Usando chave padrão da Edge Function.');
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Inteligência Artificial & Chaves (BYOK)
          </CardTitle>
          <Badge variant={apiKey ? "default" : "outline"} className="text-[10px]">
            {apiKey ? "BYOK Criptografado (AES-256)" : "Nuvem Padronizada"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          O FinMaster usa o Gemini/Groq gerenciado via Edge Functions por padrão. Se desejar, insira sua própria chave de API gratuita do Google Gemini ou OpenRouter para cotas personalizadas.
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
          <Label className="text-xs font-medium">Chave de API (Criptografada localmente)</Label>
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
        <div className="flex items-center justify-between pt-1">
          <Button size="sm" onClick={handleSave} className="text-xs">
            Salvar Configurações de IA
          </Button>
          {apiKey && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setApiKey('');
                removeSecureItem('CUSTOM_AI_API_KEY');
                toast.info('Chave removida. Restaurado para chave padrão do servidor.');
              }}
              className="text-xs text-destructive hover:bg-destructive/10"
            >
              Restaurar Padrão
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const OKXConfigCard = () => {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getSecureItem('OKX_API_KEY'),
      getSecureItem('OKX_SECRET_KEY'),
      getSecureItem('OKX_PASSPHRASE'),
    ]).then(([k, s, p]) => {
      if (!mounted) return;
      if (k) setApiKey(k);
      else {
        const legacyK = localStorage.getItem('OKX_API_KEY');
        if (legacyK) setApiKey(legacyK);
      }
      if (s) setSecretKey(s);
      else {
        const legacyS = localStorage.getItem('OKX_SECRET_KEY');
        if (legacyS) setSecretKey(legacyS);
      }
      if (p) setPassphrase(p);
      else {
        const legacyP = localStorage.getItem('OKX_PASSPHRASE');
        if (legacyP) setPassphrase(legacyP);
      }
    });
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (apiKey.trim()) await setSecureItem('OKX_API_KEY', apiKey.trim());
    else removeSecureItem('OKX_API_KEY');

    if (secretKey.trim()) await setSecureItem('OKX_SECRET_KEY', secretKey.trim());
    else removeSecureItem('OKX_SECRET_KEY');

    if (passphrase.trim()) await setSecureItem('OKX_PASSPHRASE', passphrase.trim());
    else removeSecureItem('OKX_PASSPHRASE');

    toast.success('Credenciais da OKX salvas com criptografia AES-256!');
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          Integração CEX (OKX Exchange)
        </CardTitle>
        <CardDescription className="text-xs">
          Permite sincronizar saldos de criptomoedas da sua conta OKX (somente leitura). Se você já configurou as chaves nos Secrets do Supabase (<code>OKX_API_KEY</code>, <code>OKX_SECRET_KEY</code>, <code>OKX_PASSPHRASE</code>), elas são detectadas automaticamente. Os campos abaixo são opcionais para sobrescrita local.
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

