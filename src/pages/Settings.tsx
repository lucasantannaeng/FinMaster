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
  const [biometric, setBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(true);
  const [alertBudget, setAlertBudget] = useState(true);

  useEffect(() => {
    // Check WebAuthn support
    const supported = !!(window.PublicKeyCredential);
    setBiometricSupported(supported);
  }, []);

  const handleBiometricToggle = async (checked: boolean) => {
    if (!biometricSupported) {
      toast.error('Autenticação biométrica não é suportada neste dispositivo');
      return;
    }

    if (checked) {
      try {
        // Test WebAuthn availability
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
          toast.error('Nenhum autenticador biométrico encontrado neste dispositivo');
          return;
        }
        setBiometric(true);
        toast.success('Biometria ativada');
      } catch {
        toast.error('Erro ao configurar biometria');
      }
    } else {
      setBiometric(false);
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
    </div>
  );
};

export default Settings;
