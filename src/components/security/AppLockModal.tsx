import { useState, useEffect, useRef } from 'react';
import { useAppLock } from '@/hooks/useAppLock';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, Fingerprint, Delete, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function AppLockModal() {
  const { isLocked, unlockWithPin } = useAppLock();
  const [pin, setPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLocked) {
      setPin('');
      setErrorShake(false);
      // Foca automaticamente no input invisível para captura de teclado
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length >= 4) {
        // Tenta desbloquear automaticamente se tiver 4 a 6 dígitos
        attemptUnlock(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const attemptUnlock = async (pinToTry: string) => {
    setIsVerifying(true);
    const success = await unlockWithPin(pinToTry);
    setIsVerifying(false);

    if (success) {
      toast.success('FinMaster desbloqueado.');
      setPin('');
    } else {
      setErrorShake(true);
      setTimeout(() => {
        setErrorShake(false);
        setPin('');
      }, 500);
      toast.error('PIN incorreto. Tente novamente.');
    }
  };

  const handleNativeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      handleKeyPress(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl p-4 select-none">
      {/* Input oculto para focar e receber teclado físico */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        className="opacity-0 absolute w-0 h-0 pointer-events-none"
        onKeyDown={handleNativeKey}
        autoFocus
      />

      <div className={`w-full max-w-xs flex flex-col items-center space-y-6 ${errorShake ? 'animate-bounce text-destructive' : ''}`}>
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">FinMaster Bloqueado</h2>
          <p className="text-xs text-muted-foreground">
            Digite seu PIN numérico de segurança para acessar o sistema.
          </p>
        </div>

        {/* Indicadores de Dígitos (Bolinhas) */}
        <div className="flex items-center justify-center gap-3 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`h-4 w-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-primary scale-110 shadow-sm shadow-primary/50'
                    : 'border-2 border-muted-foreground/30 bg-muted/20'
                }`}
              />
            );
          })}
        </div>

        {/* Teclado Numérico Visual */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <Button
              key={digit}
              variant="outline"
              size="lg"
              disabled={isVerifying}
              className="h-14 text-xl font-semibold rounded-xl bg-card/60 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
              onClick={() => handleKeyPress(digit)}
            >
              {digit}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="lg"
            className="h-14 rounded-xl text-xs text-muted-foreground hover:bg-muted/40"
            onClick={handleClear}
          >
            Limpar
          </Button>

          <Button
            variant="outline"
            size="lg"
            disabled={isVerifying}
            className="h-14 text-xl font-semibold rounded-xl bg-card/60 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
            onClick={() => handleKeyPress('0')}
          >
            0
          </Button>

          <Button
            variant="ghost"
            size="lg"
            className="h-14 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95"
            onClick={handleBackspace}
          >
            <Delete className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 pt-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Proteção por Criptografia Local (E2EE)</span>
        </div>
      </div>
    </div>
  );
}
