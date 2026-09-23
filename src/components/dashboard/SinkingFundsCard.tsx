import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  SavingsGoal,
  getStoredGoals,
  addGoal,
  deleteGoal,
  addContribution,
  calculateMonthlyRequirement,
} from '@/services/sinkingFundsService';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppSettings } from '@/hooks/useAppSettings';
import { PiggyBank, Plus, TrendingUp, Calendar, Trash2, CheckCircle2, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';

export function SinkingFundsCard() {
  const { discreteMode } = useAppSettings();
  const d = discreteMode;

  const [goals, setGoals] = useState<SavingsGoal[]>(() => getStoredGoals());
  const [modalOpen, setModalOpen] = useState(false);
  const [contributeModalOpen, setContributeModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  // Formulário de nova meta
  const [newName, setNewName] = useState('');
  const [newTargetAmount, setNewTargetAmount] = useState('');
  const [newCurrentAmount, setNewCurrentAmount] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const reloadGoals = () => {
    setGoals(getStoredGoals());
  };

  const handleCreateGoal = () => {
    const targetAmt = parseFloat(newTargetAmount);
    if (!newName.trim() || isNaN(targetAmt) || targetAmt <= 0 || !newTargetDate) {
      toast.error('Preencha o nome, valor alvo e data limite.');
      return;
    }

    const currentAmt = parseFloat(newCurrentAmount) || 0;

    addGoal({
      name: newName.trim(),
      targetAmount: targetAmt,
      currentAmount: currentAmt,
      targetDate: newTargetDate,
      category: newCategory.trim() || 'Geral',
      color: '#10b981',
    });

    toast.success('Pote de reserva criado com sucesso!');
    setModalOpen(false);
    setNewName('');
    setNewTargetAmount('');
    setNewCurrentAmount('');
    setNewTargetDate('');
    setNewCategory('');
    reloadGoals();
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Excluir o pote "${name}"?`)) {
      deleteGoal(id);
      toast.success('Pote removido.');
      reloadGoals();
    }
  };

  const handleOpenContribute = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setContributeAmount('');
    setContributeModalOpen(true);
  };

  const handleConfirmContribution = () => {
    if (!selectedGoal) return;
    const amt = parseFloat(contributeAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Informe um valor de aporte válido.');
      return;
    }

    addContribution(selectedGoal.id, amt);
    toast.success(`Aporte de ${formatCurrency(amt)} adicionado ao pote "${selectedGoal.name}"!`);
    setContributeModalOpen(false);
    setSelectedGoal(null);
    setContributeAmount('');
    reloadGoals();
  };

  // Totais agregados
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalCurrent = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalMonthlyNeeded = goals.reduce((acc, g) => {
    const req = calculateMonthlyRequirement(g);
    return acc + (req.isCompleted ? 0 : req.monthlyAmount);
  }, 0);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3 px-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-emerald-500" />
              Potes de Metas & Reservas (Sinking Funds)
            </CardTitle>
            <CardDescription className="text-xs">
              Envelopes virtuais de acumulação para grandes objetivos e despesas periódicas.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setModalOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Novo Pote
          </Button>
        </CardHeader>

        <CardContent className="px-5 space-y-4">
          {/* Resumo Agregado */}
          <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2.5 rounded-lg border text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground">Total Acumulado</span>
              <p className="font-semibold text-emerald-500 font-mono text-sm">
                {d ? '••••' : formatCurrency(totalCurrent)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Objetivo Total</span>
              <p className="font-semibold text-foreground font-mono text-sm">
                {d ? '••••' : formatCurrency(totalTarget)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Aporte Mensal Ideal</span>
              <p className="font-semibold text-blue-500 font-mono text-sm">
                {d ? '••••' : formatCurrency(totalMonthlyNeeded)}/mês
              </p>
            </div>
          </div>

          {/* Lista de Metas */}
          <div className="space-y-3">
            {goals.map((goal) => {
              const req = calculateMonthlyRequirement(goal);
              return (
                <div key={goal.id} className="p-3 border rounded-lg bg-card/50 hover:bg-muted/10 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <div>
                        <h4 className="text-xs font-semibold">{goal.name}</h4>
                        {goal.category && (
                          <span className="text-[10px] text-muted-foreground">{goal.category}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.isCompleted ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Concluído
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleOpenContribute(goal)}
                        >
                          <TrendingUp className="h-3 w-3 mr-1" /> Aportar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(goal.id, goal.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <Progress value={req.progressPercent} className="h-1.5" />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {d ? '••••' : formatCurrency(goal.currentAmount)} de{' '}
                      {d ? '••••' : formatCurrency(goal.targetAmount)} ({req.progressPercent}%)
                    </span>
                    {!req.isCompleted && (
                      <span className="text-blue-500 font-medium">
                        Sugerido: {d ? '••••' : formatCurrency(req.monthlyAmount)}/mês ({req.monthsRemaining} meses)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* MODAL: NOVO POTE / META */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-500" />
              <DialogTitle className="text-base">Novo Pote de Reserva (Sinking Fund)</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Defina um objetivo financeiro e uma data estimada para calcular o aporte mensal necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Nome do Objetivo *</Label>
              <Input
                placeholder="Ex: Reforma da Casa, Reserva de Emergência"
                className="mt-1 h-8 text-xs"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Valor Alvo (R$) *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 10000"
                  className="mt-1 h-8 text-xs"
                  value={newTargetAmount}
                  onChange={(e) => setNewTargetAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Já Acumulado (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 2500"
                  className="mt-1 h-8 text-xs"
                  value={newCurrentAmount}
                  onChange={(e) => setNewCurrentAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data Limite Desejada *</Label>
                <Input
                  type="date"
                  className="mt-1 h-8 text-xs"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Categoria / Finalidade</Label>
                <Input
                  placeholder="Ex: Viagem, Segurança"
                  className="mt-1 h-8 text-xs"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateGoal} className="text-xs">
              Criar Pote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: APORTE RÁPIDO */}
      <Dialog open={contributeModalOpen} onOpenChange={setContributeModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <DialogTitle className="text-base">Aporte no Pote</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Adicionar saldo acumulado ao pote <strong>{selectedGoal?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Valor do Aporte (R$) *</Label>
              <Input
                type="number"
                placeholder="Ex: 500"
                className="mt-1 h-8 text-xs"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              {[50, 100, 200, 500].map((val) => (
                <Button
                  key={val}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] flex-1"
                  onClick={() => setContributeAmount(String(val))}
                >
                  +{val}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setContributeModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirmContribution} className="text-xs bg-emerald-600 hover:bg-emerald-700">
              Confirmar Aporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
