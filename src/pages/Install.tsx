import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle, Share } from "lucide-react";
import { useNavigate } from "react-router-dom";

const InstallHead = () => (
  <Helmet>
    <title>Instalar o FinMaster no celular — PWA Android e iOS</title>
    <meta name="description" content="Instale o FinMaster como aplicativo (PWA) no seu Android ou iPhone para acesso rápido ao controle financeiro." />
    <link rel="canonical" href="https://pocket-fin-control.lovable.app/install" />
    <meta property="og:title" content="Instalar o FinMaster no celular" />
    <meta property="og:description" content="Instale o FinMaster como app no seu Android ou iPhone." />
    <meta property="og:url" content="https://pocket-fin-control.lovable.app/install" />
  </Helmet>
);

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <InstallHead />
        <h1 className="sr-only">FinMaster instalado</h1>
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl">App Instalado!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              O FinMaster já está instalado no seu dispositivo.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Ir para o App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <InstallHead />
      <h1 className="sr-only">Instalar o FinMaster no celular</h1>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/pwa-192x192.png" alt="FinMaster" className="w-20 h-20 mx-auto mb-4 rounded-2xl" />
          <CardTitle className="text-2xl">Instalar FinMaster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-center">
            Instale o FinMaster no seu celular para acesso rápido, como um app nativo.
          </p>

          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full gap-2" size="lg">
              <Download className="w-5 h-5" />
              Instalar Agora
            </Button>
          ) : isIOS ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="font-medium text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                No iPhone / iPad:
              </p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Toque no botão <Share className="w-4 h-4 inline" /> (Compartilhar) no Safari</li>
                <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                <li>Toque em <strong>"Adicionar"</strong></li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="font-medium text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                No Android:
              </p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Abra o menu do navegador (⋮)</li>
                <li>Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
                <li>Confirme a instalação</li>
              </ol>
            </div>
          )}

          <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
            Continuar no navegador
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
