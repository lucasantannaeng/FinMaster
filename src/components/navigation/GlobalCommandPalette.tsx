import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useAppLock } from '@/hooks/useAppLock';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Settings,
  FolderTree,
  FileText,
  User,
  Plus,
  UploadCloud,
  Eye,
  EyeOff,
  Lock,
  Keyboard,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { discreteMode, setDiscreteMode } = useAppSettings();
  const { lockApp, isPinConfigured } = useAppLock();

  // Escuta atalhos de teclado globais
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalhos de navegação direta se o usuário estiver digitando em um campo de texto
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Ctrl+K ou Cmd+K sempre abre a Command Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      // Atalhos de tecla única
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        navigate('/');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        navigate('/transactions');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        navigate('/cards');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        navigate('/settings');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigate('/transactions?new=true');
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Digite um comando, navegue ou busque ações..." />
        <CommandList className="text-xs">
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Ações Rápidas">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/transactions?new=true');
                })
              }
            >
              <Plus className="mr-2 h-4 w-4 text-primary" />
              <span>Nova Transação</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/transactions');
                })
              }
            >
              <UploadCloud className="mr-2 h-4 w-4 text-primary" />
              <span>Importar Extrato Bancário (OFX / CSV)</span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setDiscreteMode(!discreteMode);
                  toast.info(
                    !discreteMode ? 'Modo Discreto ATIVADO' : 'Modo Discreto desativado'
                  );
                })
              }
            >
              {discreteMode ? (
                <EyeOff className="mr-2 h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
              )}
              <span>{discreteMode ? 'Desativar Modo Discreto' : 'Ativar Modo Discreto (Ocultar Saldos)'}</span>
              <CommandShortcut>Ctrl+H</CommandShortcut>
            </CommandItem>

            {isPinConfigured && (
              <CommandItem
                onSelect={() =>
                  runCommand(() => {
                    lockApp();
                    toast.info('FinMaster bloqueado.');
                  })
                }
              >
                <Lock className="mr-2 h-4 w-4 text-amber-500" />
                <span>Bloquear FinMaster Agora (PIN Lock)</span>
              </CommandItem>
            )}

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/settings');
                })
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Exportar / Restaurar Cofre Criptografado (AES-256)</span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setHelpOpen(true);
                })
              }
            >
              <Keyboard className="mr-2 h-4 w-4 text-blue-500" />
              <span>Ver Atalhos de Teclado</span>
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navegação">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/');
                })
              }
            >
              <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Dashboard Principal</span>
              <CommandShortcut>D</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/transactions');
                })
              }
            >
              <Receipt className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Transações & Extratos</span>
              <CommandShortcut>T</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/cards');
                })
              }
            >
              <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Cartões & Faturas</span>
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/categories');
                })
              }
            >
              <FolderTree className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Categorias & Orçamentos</span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/tax-report');
                })
              }
            >
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Relatório Fiscal & IRPF</span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/settings');
                })
              }
            >
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Configurações & Segurança</span>
              <CommandShortcut>S</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  navigate('/profile');
                })
              }
            >
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Meu Perfil</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* DIÁLOGO: AJUDA DE ATALHOS DE TECLADO */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base">Atalhos de Teclado (Keyboard-First)</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Navegue e execute operações em milissegundos sem tirar as mãos do teclado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/40 border">
              <div className="flex items-center justify-between">
                <span>Buscar comandos</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">Ctrl + K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Modo Discreto (Pânico)</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">Ctrl + H</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Nova Transação</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">N</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Ir para Dashboard</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">D</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Ir para Transações</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">T</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Ir para Cartões</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Ir para Configurações</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">S</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Ajuda de Atalhos</span>
                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px]">?</kbd>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
