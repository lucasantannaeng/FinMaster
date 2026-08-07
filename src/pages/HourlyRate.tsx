import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Calculator, Clock, FileText, Loader2, Sparkles } from 'lucide-react';
import InfoButton from '@/components/InfoButton';
import { toast } from 'sonner';

const HourlyRate = () => {
  const { discreteMode } = useAppSettings();

  // Calculator inputs
  const [software, setSoftware] = useState(500);
  const [taxes, setTaxes] = useState(200);
  const [internet, setInternet] = useState(150);
  const [otherCosts, setOtherCosts] = useState(0);
  const [desiredIncome, setDesiredIncome] = useState(8000);
  const [productiveHours, setProductiveHours] = useState(120);
  const [profitMargin, setProfitMargin] = useState(30);

  // AI budget
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budget, setBudget] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const totalFixedCosts = software + taxes + internet + otherCosts;
  const hourlyRate = productiveHours > 0
    ? ((totalFixedCosts + desiredIncome) / productiveHours) * (1 + profitMargin / 100)
    : 0;

  const generateBudget = async () => {
    if (!projectDesc.trim()) {
      toast.error('Descreva brevemente o projeto');
      return;
    }
    setBudgetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-budget', {
        body: {
          hourlyRate,
          totalFixedCosts,
          desiredIncome,
          productiveHours,
          profitMargin,
          projectDescription: projectDesc,
        },
      });
      if (error) throw error;
      setBudget(data?.budget || 'Não foi possível gerar o orçamento.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar orçamento');
    } finally {
      setBudgetLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      <div className="pt-3 pb-1">
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Ferramentas</p>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Calculadora Valor-Hora
          <InfoButton helpId="hourly-rate" />
        </h1>
      </div>

      <Tabs defaultValue="calculator">
        <TabsList className="w-full">
          <TabsTrigger value="calculator" className="flex-1 text-xs">
            <Calculator className="h-3.5 w-3.5 mr-1.5" /> Calculadora
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex-1 text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Orçamento IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-4 mt-4">
          {/* Result card */}
          <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 opacity-70" />
                <span className="text-xs font-medium opacity-70 uppercase tracking-wider">Seu Valor-Hora</span>
              </div>
              <p className="text-4xl font-bold font-mono tracking-tight">
                {formatCurrency(hourlyRate, discreteMode)}
                <span className="text-lg opacity-60">/h</span>
              </p>
              <p className="text-xs mt-2 opacity-60">
                Receita mensal projetada: {formatCurrency(hourlyRate * productiveHours, discreteMode)}
              </p>
            </CardContent>
          </Card>

          {/* Fixed costs */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-5">
              <CardTitle className="text-sm font-semibold">Custos Fixos Mensais</CardTitle>
              <CardDescription className="text-xs">Softwares, impostos e infraestrutura</CardDescription>
            </CardHeader>
            <CardContent className="px-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Softwares (CAD/BIM)</Label>
                  <Input
                    type="number"
                    value={software}
                    onChange={(e) => setSoftware(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MEI / Impostos</Label>
                  <Input
                    type="number"
                    value={taxes}
                    onChange={(e) => setTaxes(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Internet / Telecom</Label>
                  <Input
                    type="number"
                    value={internet}
                    onChange={(e) => setInternet(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Outros Custos</Label>
                  <Input
                    type="number"
                    value={otherCosts}
                    onChange={(e) => setOtherCosts(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Custos Fixos</span>
                <span className="font-semibold font-mono">{formatCurrency(totalFixedCosts, discreteMode)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Income & hours */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-5">
              <CardTitle className="text-sm font-semibold">Renda e Produtividade</CardTitle>
            </CardHeader>
            <CardContent className="px-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Renda Líquida Desejada</Label>
                <Input
                  type="number"
                  value={desiredIncome}
                  onChange={(e) => setDesiredIncome(Number(e.target.value))}
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-xs">Horas Produtivas / Mês</Label>
                  <Badge variant="secondary" className="text-[10px]">{productiveHours}h</Badge>
                </div>
                <Slider
                  value={[productiveHours]}
                  onValueChange={([v]) => setProductiveHours(v)}
                  min={40}
                  max={220}
                  step={5}
                />
              </div>

              <Separator />

              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-xs">Margem de Lucro</Label>
                  <Badge variant="secondary" className="text-[10px]">{profitMargin}%</Badge>
                </div>
                <Slider
                  value={[profitMargin]}
                  onValueChange={([v]) => setProfitMargin(v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Breakdown */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-5">
              <CardTitle className="text-sm font-semibold">Composição do Valor</CardTitle>
            </CardHeader>
            <CardContent className="px-5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Custos Fixos / Hora</span>
                <span className="font-mono">{formatCurrency(productiveHours > 0 ? totalFixedCosts / productiveHours : 0, discreteMode)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Renda / Hora</span>
                <span className="font-mono">{formatCurrency(productiveHours > 0 ? desiredIncome / productiveHours : 0, discreteMode)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Margem ({profitMargin}%)</span>
                <span className="font-mono">{formatCurrency(hourlyRate - (productiveHours > 0 ? (totalFixedCosts + desiredIncome) / productiveHours : 0), discreteMode)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span>Valor-Hora Final</span>
                <span className="font-mono text-primary">{formatCurrency(hourlyRate, discreteMode)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4 mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Gerar Orçamento Base
              </CardTitle>
              <CardDescription className="text-xs">
                A IA gera um escopo de serviço baseado no seu valor-hora de {formatCurrency(hourlyRate, discreteMode)}/h
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Descrição do Projeto</Label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Ex: Projeto estrutural de residência unifamiliar de 200m², 2 pavimentos..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
                />
              </div>

              <Button className="w-full" onClick={generateBudget} disabled={budgetLoading}>
                {budgetLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" /> Gerar Orçamento Base</>
                )}
              </Button>

              {budget && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 pb-4 px-4">
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                      {budget}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(budget);
                        toast.success('Orçamento copiado!');
                      }}
                    >
                      Copiar Orçamento
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HourlyRate;
