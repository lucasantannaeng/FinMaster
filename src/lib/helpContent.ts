export interface HelpItem {
  title: string;
  description: string;
  tips: string[];
}

const helpContent: Record<string, HelpItem> = {
  'safe-to-spend': {
    title: 'Gasto Seguro (Safe-to-Spend)',
    description:
      'Mostra quanto você pode gastar livremente neste mês. O cálculo deduz automaticamente suas metas de orçamento por categoria e seus aportes de investimento (DCA cripto) antes de exibir o saldo disponível.',
    tips: [
      'Configure suas metas de orçamento em Categorias para um cálculo mais preciso.',
      'O gauge diminui conforme as despesas reais do mês são registradas.',
      'Se o valor estiver negativo, significa que você já ultrapassou o limite seguro — hora de conter os gastos!',
    ],
  },
  'total-balance': {
    title: 'Saldo Total',
    description:
      'Soma dos saldos de todas as suas contas bancárias cadastradas. Representa seu patrimônio líquido em moeda fiduciária (BRL).',
    tips: [
      'Mantenha todas as suas contas atualizadas para ter uma visão fiel do seu patrimônio.',
      'Receitas e despesas do mês são calculadas com base nas transações registradas no período.',
    ],
  },
  'credit-card-bill': {
    title: 'Fatura Atual do Cartão',
    description:
      'Soma de todas as despesas no cartão de crédito dentro do período de faturamento atual, calculado com base no dia de fechamento configurado em cada cartão.',
    tips: [
      'Configure o dia de fechamento correto em cada cartão para um cálculo preciso.',
      'Acompanhe a fatura para evitar surpresas no vencimento.',
    ],
  },
  'crypto-portfolio': {
    title: 'Carteira Cripto (OKX)',
    description:
      'Exibe seus ativos de criptomoedas custodiados na OKX, com preços em tempo real via API. Mostra o saldo total em USDT e o equivalente em BRL.',
    tips: [
      'Os valores são atualizados a cada refresh do Dashboard.',
      'Variações de 24h ajudam a acompanhar a volatilidade dos seus ativos.',
      'Use o botão de refresh para obter as cotações mais recentes.',
    ],
  },
  'portfolio-health': {
    title: 'Saúde do Portfólio',
    description:
      'Analisa a alocação dos seus ativos entre FIAT e Cripto, mostrando a exposição percentual de cada ativo. Inclui controle de limite de exposição a ETH e rebalanceamento sugerido.',
    tips: [
      'Defina um limite de exposição a ETH para receber alertas quando ultrapassado.',
      'Use o consultor de IA para estratégias de proteção quando a exposição estiver alta.',
      'O gráfico de pizza mostra a distribuição real do seu patrimônio total.',
    ],
  },
  'scenario-simulator': {
    title: 'Simulador de Cenários',
    description:
      'Permite simular diferentes cenários de mercado para seus criptoativos. Ajuste a variação percentual de cada moeda e veja o impacto no portfólio total.',
    tips: [
      'Simule cenários de alta e baixa para entender seu risco.',
      'O cenário "Crash -50%" ajuda a avaliar sua tolerância a perdas.',
      'Use os resultados para decidir se precisa rebalancear.',
    ],
  },
  'savings-challenge': {
    title: 'Desafio de Economia (IA Coach)',
    description:
      'Analisa suas categorias de despesa e identifica oportunidades reais de economia comparando o orçamento planejado com os gastos proporcionais do mês.',
    tips: [
      'Categorias verdes indicam onde você está economizando — mantenha o ritmo!',
      'Use o botão "Simular DCA" para ver como a economia poderia render em cripto.',
      'A IA calcula a economia proporcional ao dia do mês para uma análise justa.',
    ],
  },
  'expense-by-category': {
    title: 'Despesas por Categoria',
    description:
      'Gráfico de pizza mostrando a distribuição das suas despesas do mês por categoria. Exibe as 6 maiores categorias de gasto.',
    tips: [
      'Categorize todas as transações para uma visão mais completa.',
      'Identifique as categorias que mais consomem seu orçamento.',
      'Compare mês a mês para identificar tendências de gasto.',
    ],
  },
  'crypto-retirement': {
    title: 'Simulador de Aposentadoria Cripto',
    description:
      'Projeta o crescimento do seu portfólio cripto ao longo dos anos. Selecione qualquer ativo com bot DCA ativo na OKX e ajuste a taxa de valorização anual para simular cenários.',
    tips: [
      'Selecione o ativo desejado no dropdown — todos os criptoativos com saldo na OKX são listados.',
      'Use taxas conservadoras (10-15%) para projeções mais realistas.',
      'O valor em BRL depende da cotação atual do dólar — pode variar significativamente.',
      'O gráfico mostra o crescimento composto: quanto antes começar, melhor o resultado.',
      'Valores são exibidos com 5 casas decimais para precisão.',
    ],
  },
  'burn-rate': {
    title: 'Taxa de Queima (Burn Rate)',
    description:
      'Mostra a velocidade com que você está consumindo sua renda mensal. Compara suas despesas totais com a renda, exibindo um percentual de utilização e as categorias mais impactantes.',
    tips: [
      'Burn rate abaixo de 70% é saudável — significa que você está poupando pelo menos 30%.',
      'A linha de referência mostra o limite de 100% da renda.',
      'Foque em reduzir as categorias com maior barra no gráfico.',
    ],
  },
  'recent-transactions': {
    title: 'Últimas Transações',
    description:
      'Lista as 5 transações mais recentes registradas, independente do tipo (receita ou despesa). Permite acesso rápido ao histórico completo.',
    tips: [
      'Clique em "Ver todas" para acessar o histórico completo com filtros.',
      'Use o botão "+" para registrar novas transações rapidamente.',
    ],
  },
  'hourly-rate': {
    title: 'Calculadora de Valor-Hora',
    description:
      'Calcula o valor da sua hora técnica para projetos de engenharia, considerando todos os custos fixos (softwares, impostos, internet) mais a renda desejada e uma margem de lucro.',
    tips: [
      'Inclua TODOS os custos fixos: AutoCAD, SolidWorks, MEI, INSS, internet dedicada.',
      'A margem de lucro deve cobrir imprevistos e períodos sem projeto.',
      'Use a IA para gerar um orçamento base profissional a partir do valor-hora calculado.',
      'Revise o valor a cada 6 meses para acompanhar a inflação e novos custos.',
    ],
  },
  'tax-overview': {
    title: 'Visão Geral — Imposto de Renda',
    description:
      'Resumo anual das suas receitas, despesas e impostos. Permite filtrar por ano-calendário e exportar os dados agrupados por categoria em CSV.',
    tips: [
      'Selecione o ano correto antes de gerar relatórios.',
      'Use a exportação CSV para importar dados no programa da Receita Federal.',
      'Mantenha categorias organizadas para facilitar a declaração.',
    ],
  },
  'tax-deductions': {
    title: 'Deduções com IA',
    description:
      'A IA analisa suas transações em busca de despesas potencialmente dedutíveis: saúde, educação, previdência privada e dependentes. Gera um relatório organizado pronto para a Receita Federal.',
    tips: [
      'Quanto mais detalhadas as descrições das transações, melhor a análise da IA.',
      'Confirme cada dedução sugerida antes de incluir na declaração.',
      'Guarde comprovantes de todas as despesas identificadas como dedutíveis.',
    ],
  },
  'tax-crypto': {
    title: 'Criptoativos — Bens e Direitos',
    description:
      'Gera automaticamente a ficha de "Bens e Direitos - Criptoativos" exigida pela Receita Federal, com cálculo de custo médio ponderado e alertas de GCAP para vendas acima do limite de isenção (R$ 35.000).',
    tips: [
      'O custo médio é calculado com base nos aportes DCA detectados na OKX.',
      'Vendas de cripto acima de R$ 35.000/mês exigem apuração de ganho de capital.',
      'Copie a descrição gerada diretamente para o programa IRPF.',
    ],
  },
  'tax-ocr': {
    title: 'Scanner de Recibos (OCR)',
    description:
      'Escaneia imagens ou PDFs de recibos usando IA com visão computacional. Extrai automaticamente o CNPJ/CPF do prestador, valor, data e categoria da despesa.',
    tips: [
      'Fotos com boa iluminação e sem reflexos geram melhores resultados.',
      'Verifique os dados extraídos antes de vincular a uma transação.',
      'Funciona com recibos médicos, notas fiscais e comprovantes de pagamento.',
    ],
  },
  'subscription-alerts': {
    title: 'Detecção de Assinaturas',
    description:
      'A IA analisa 90 dias de transações para identificar cobranças recorrentes que não estão marcadas como assinatura. Detecta padrões de nomes e valores similares.',
    tips: [
      'Revise as sugestões e marque como recorrente ou ignore.',
      'Assinaturas esquecidas são uma das maiores fontes de desperdício.',
      'Execute a análise mensalmente para detectar novos padrões.',
    ],
  },
  'dca-performance': {
    title: 'Performance DCA (ETH)',
    description:
      'Acompanha o desempenho do seu bot de DCA (Dollar-Cost Averaging) na OKX. A linha de referência no gráfico indica o ponto de break-even — acima dela, você está no lucro.',
    tips: [
      'Break-even é o preço médio de compra — acima dele, seu investimento está positivo.',
      'DCA funciona melhor em horizontes longos (anos, não meses).',
      'Não se assuste com quedas pontuais — o DCA suaviza a volatilidade ao longo do tempo.',
    ],
  },
};

export default helpContent;
