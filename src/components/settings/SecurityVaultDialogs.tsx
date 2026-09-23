import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { downloadEncryptedVault, parseEncryptedVaultFile } from '@/services/cryptoVaultService';
import { getStoredRules, saveRules } from '@/services/rulesEngine';
import { toast } from 'sonner';
import { ShieldCheck, Download, Upload, Lock, KeyRound, Loader2, AlertTriangle, FileCheck } from 'lucide-react';

interface SecurityVaultDialogsProps {
  exportOpen: boolean;
  onExportOpenChange: (open: boolean) => void;
  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;
  pinModalOpen: boolean;
  onPinModalOpenChange: (open: boolean) => void;
  onPinConfigured: (newPin: string) => Promise<void>;
}

export function SecurityVaultDialogs({
  exportOpen,
  onExportOpenChange,
  importOpen,
  onImportOpenChange,
  pinModalOpen,
  onPinModalOpenChange,
  onPinConfigured,
}: SecurityVaultDialogsProps) {
  const { user } = useAuth();

  // Estados de Exportação
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Estados de Importação
  const [importPassword, setImportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [restoredSummary, setRestoredSummary] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do PIN
  const [pinValue, setPinValue] = useState('');
  const [pinConfirmValue, setPinConfirmValue] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  // Manipulador de Exportação Criptografada
  const handleExportVault = async () => {
    if (!exportPassword || exportPassword.length < 6) {
      toast.error('A senha mestra deve conter no mínimo 6 caracteres.');
      return;
    }
    if (exportPassword !== exportConfirmPassword) {
      toast.error('As senhas informadas não coincidem.');
      return;
    }

    setIsExporting(true);
    try {
      // Coleta dados completos das entidades do usuário
      const [txRes, accRes, catRes, cardRes, contRes] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('credit_cards').select('*'),
        supabase.from('contacts').select('*'),
      ]);

      const vaultData = {
        exportedAt: new Date().toISOString(),
        version: '1.2.0',
        userId: user?.id,
        userEmail: user?.email,
        rules: getStoredRules(),
        transactions: txRes.data || [],
        accounts: accRes.data || [],
        categories: catRes.data || [],
        credit_cards: cardRes.data || [],
        contacts: contRes.data || [],
      };

      await downloadEncryptedVault(vaultData, exportPassword);
      toast.success('Backup criptografado (.finmaster.enc) gerado com sucesso!');
      onExportOpenChange(false);
      setExportPassword('');
      setExportConfirmPassword('');
    } catch (err: any) {
      console.error('Erro ao exportar cofre:', err);
      toast.error('Erro na exportação criptografada: ' + (err.message || 'Falha'));
    } finally {
      setIsExporting(false);
    }
  };

  // Manipulador de Importação e Descriptografia
  const handleDecryptFile = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo .finmaster.enc primeiro.');
      return;
    }
    if (!importPassword) {
      toast.error('Digite a senha mestra usada no momento da exportação.');
      return;
    }

    setIsImporting(true);
    try {
      const data = await parseEncryptedVaultFile(importFile, importPassword);
      setRestoredSummary(data);
      toast.success('Cofre descriptografado e integridade verificada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao descriptografar cofre:', err);
      toast.error(err.message || 'Senha incorreta ou arquivo violado.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyRestore = async () => {
    if (!restoredSummary || !user) return;

    setIsImporting(true);
    try {
      // Restaura regras locais
      if (Array.isArray(restoredSummary.rules) && restoredSummary.rules.length > 0) {
        saveRules(restoredSummary.rules);
      }

      // Concilia e insere categorias se necessário
      if (Array.isArray(restoredSummary.categories) && restoredSummary.categories.length > 0) {
        for (const cat of restoredSummary.categories) {
          const { error } = await supabase.from('categories').upsert({
            name: cat.name,
            type: cat.type,
            user_id: user.id,
            icon: cat.icon,
            color: cat.color,
          }, { onConflict: 'name,user_id' });
          if (error) console.warn('Aviso ao restaurar categoria:', error);
        }
      }

      toast.success('Dados e regras restaurados com sucesso no FinMaster!');
      onImportOpenChange(false);
      setRestoredSummary(null);
      setImportFile(null);
      setImportPassword('');
      window.location.reload();
    } catch (err: any) {
      console.error('Erro ao aplicar restauração:', err);
      toast.error('Falha ao restaurar dados: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Manipulador de Configuração de PIN
  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(pinValue)) {
      toast.error('O PIN deve conter exatamente 4 a 6 dígitos numéricos.');
      return;
    }
    if (pinValue !== pinConfirmValue) {
      toast.error('Os PINs digitados não conferem.');
      return;
    }

    setIsSettingPin(true);
    try {
      await onPinConfigured(pinValue);
      onPinModalOpenChange(false);
      setPinValue('');
      setPinConfirmValue('');
    } catch (err: any) {
      toast.error('Erro ao configurar PIN: ' + err.message);
    } finally {
      setIsSettingPin(false);
    }
  };

  return (
    <>
      {/* DIÁLOGO: EXPORTAR COFRE CRIPTOGRAFADO */}
      <Dialog open={exportOpen} onOpenChange={onExportOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base">Exportar Backup Criptografado (E2EE)</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Seus dados financeiros (contas, transações, categorias e regras) serão cifrados em AES-GCM 256 bits com chave derivada de PBKDF2.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Senha Mestra de Criptografia *</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                className="mt-1 h-8 text-xs"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Confirmar Senha Mestra *</Label>
              <Input
                type="password"
                placeholder="Repita a senha"
                className="mt-1 h-8 text-xs"
                value={exportConfirmPassword}
                onChange={(e) => setExportConfirmPassword(e.target.value)}
              />
            </div>

            <div className="p-2.5 rounded bg-muted/40 border flex items-start gap-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Como este cofre utiliza criptografia de conhecimento zero (Zero-Knowledge), não há como recuperar os dados se você esquecer a senha mestra.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onExportOpenChange(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleExportVault} disabled={isExporting} className="text-xs">
              {isExporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
              Baixar .finmaster.enc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: RESTAURAR COFRE CRIPTOGRAFADO */}
      <Dialog open={importOpen} onOpenChange={onImportOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base">Restaurar Cofre Criptografado</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Selecione o arquivo <code className="bg-muted px-1 rounded">.finmaster.enc</code> e insira a senha mestra para descriptografar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Arquivo de Backup Criptografado</Label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".enc,.json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImportFile(e.target.files[0]);
                    setRestoredSummary(null);
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1 h-8 justify-start text-xs font-normal truncate"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                {importFile ? importFile.name : 'Selecionar arquivo .finmaster.enc...'}
              </Button>
            </div>

            <div>
              <Label className="text-xs">Senha Mestra do Arquivo *</Label>
              <Input
                type="password"
                placeholder="Digite a senha mestra usada no backup"
                className="mt-1 h-8 text-xs"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
              />
            </div>

            {restoredSummary && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <FileCheck className="h-4 w-4" /> Integridade Verificada!
                </div>
                <p className="text-muted-foreground">
                  Data: <strong>{new Date(restoredSummary.exportedAt).toLocaleDateString()}</strong> | 
                  Transações: <strong>{restoredSummary.transactions?.length || 0}</strong> | 
                  Regras: <strong>{restoredSummary.rules?.length || 0}</strong>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onImportOpenChange(false)} className="text-xs">
              Cancelar
            </Button>
            {!restoredSummary ? (
              <Button size="sm" onClick={handleDecryptFile} disabled={isImporting || !importFile || !importPassword} className="text-xs">
                {isImporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Lock className="h-3.5 w-3.5 mr-1.5" />}
                Descriptografar Arquivo
              </Button>
            ) : (
              <Button size="sm" onClick={handleApplyRestore} disabled={isImporting} className="text-xs bg-emerald-600 hover:bg-emerald-700">
                {isImporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5 mr-1.5" />}
                Confirmar Restauração
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CONFIGURAR PIN */}
      <Dialog open={pinModalOpen} onOpenChange={onPinModalOpenChange}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base">Definir PIN de Acesso</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Crie um código de 4 a 6 números para bloquear o FinMaster por inatividade ou manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Novo PIN Numérico (4-6 dígitos) *</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Ex: 1234"
                className="mt-1 h-8 text-center text-lg tracking-widest font-mono"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div>
              <Label className="text-xs">Confirmar Novo PIN *</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Repita o PIN"
                className="mt-1 h-8 text-center text-lg tracking-widest font-mono"
                value={pinConfirmValue}
                onChange={(e) => setPinConfirmValue(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onPinModalOpenChange(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSavePin} disabled={isSettingPin || pinValue.length < 4} className="text-xs">
              {isSettingPin ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : 'Salvar PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
