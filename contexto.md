# Pocket Fin Control — Contexto Completo do Projeto

> Documento de referência consolidado. Cobre arquitetura, schema, funcionalidades, fluxos de negócio, correções aplicadas e principais trechos de código de cada módulo.
>
> **Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind v3 + shadcn/ui + Supabase (Auth, Postgres com RLS, Edge Functions Deno) + Lovable AI Gateway + OKX API.
>
> **Posicionamento:** App de finanças pessoais mobile-first em português (BRL) com dark theme "Fintech Premium" (graphite/teal), focado em controle de gastos, dívidas entre pessoas, cartão de crédito por fatura, investimentos em cripto via OKX, e camada de IA para entrada de lançamentos, consultoria e relatórios.

---

## 1. Visão geral e princípios

### 1.1 Diretrizes globais (memória "Core")
- Mobile-first; layout responsivo com sidebar no desktop e sheet/drawer no mobile.
- Dark theme único, paleta Graphite/Teal, tipografia Inter / SF Pro.
- **Validação:** sempre Zod (`src/lib/validation.ts`).
- **Auth:** todas as Edge Functions exigem Supabase Auth (JWT do usuário).
- **RLS:** toda tabela `public.*` tem policy `user_id = auth.uid()` para `ALL`.
- **Datas:** `YYYY-MM-DD` é parseado com `parseLocalDate` (evita bug de UTC).
- **Cripto:** 5 casas decimais.
- **Vetados (não re-adicionar):** card de DCA isolado no Dashboard; configuração manual de Pluggy.

### 1.2 Convenções de saldo (regra atual)
- **`accounts.balance`** é debitado/creditado **no momento da criação** da transação, **independente** de `is_paid`. Editar/excluir aplica o delta correspondente.
- **`contacts.balance`** reflete **apenas** transações com `is_paid = true`. Marcar/desmarcar como pago aplica o delta no contato. Editar reconcilia também esse saldo.
- Updates de saldo usam **RPCs atômicas** (`update_account_balance`, `update_contact_balance`) com `UPDATE … SET balance = balance + p_delta` para evitar race conditions.

---

## 2. Arquitetura

### 2.1 Estrutura de pastas
```
src/
├── App.tsx                 # Router + providers (Auth, AppSettings, QueryClient, Toaster)
├── main.tsx                # Entry
├── index.css               # Tokens semânticos HSL + camadas Tailwind
├── components/
│   ├── AppLayout.tsx       # Wrapper com Sidebar + área de conteúdo
│   ├── AppSidebar.tsx      # Navegação desktop/mobile
│   ├── NavLink.tsx
│   ├── PageSkeleton.tsx
│   ├── InfoButton.tsx              # Help contextual
│   ├── CryptoCard.tsx              # Render de ativo OKX
│   ├── SmartTransactionInput.tsx   # Entrada multi-modal IA
│   ├── cards/                      # Componentes específicos da fatura
│   │   ├── InvoiceFilters.tsx
│   │   ├── InvoiceNavigator.tsx
│   │   ├── InvoiceSummary.tsx
│   │   └── InvoiceTransactionList.tsx
│   ├── dashboard/                  # Widgets do Dashboard
│   │   ├── AIConsultantDialog.tsx
│   │   ├── AssetAllocationChart.tsx
│   │   ├── BurnRateChart.tsx
│   │   ├── CryptoRetirementSimulator.tsx
│   │   ├── DCAPerformanceCard.tsx
│   │   ├── ExpenseByCategoryChart.tsx
│   │   ├── PortfolioHealthCard.tsx
│   │   ├── SafeToSpendCard.tsx
│   │   ├── SavingsChallengeCard.tsx
│   │   └── ScenarioSimulator.tsx
│   ├── settings/SubscriptionAlerts.tsx
│   ├── tax/                        # Aba de IR
│   │   ├── AIDeductionsTab.tsx
│   │   ├── CryptoAssetsTab.tsx
│   │   ├── OCRScannerTab.tsx
│   │   └── OverviewTab.tsx
│   └── ui/                         # shadcn (~50 componentes)
├── hooks/
│   ├── useAuth.tsx          # Provider de sessão Supabase
│   ├── useAppSettings.tsx   # Discreet Mode + flags globais
│   ├── useBillingPeriod.ts  # Ciclo de fatura por closing_day
│   ├── useCardInvoice.ts    # Agregação de despesas da fatura corrente
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   ├── format.ts            # formatCurrency, parseLocalDate, formatDate, getBillingPeriod
│   ├── validation.ts        # Schemas Zod + getUserFriendlyError
│   ├── helpContent.ts       # Mapa de Help Dialogs por chave
│   └── utils.ts             # cn() (clsx + tailwind-merge)
├── integrations/supabase/
│   ├── client.ts
│   └── types.ts             # Gerado pelo Supabase — nunca editar à mão
└── pages/
    ├── Auth.tsx
    ├── Dashboard.tsx
    ├── Transactions.tsx
    ├── Cards.tsx
    ├── Categories.tsx
    ├── Profile.tsx
    ├── TaxReport.tsx
    ├── Settings.tsx
    ├── HourlyRate.tsx
    ├── Install.tsx
    ├── Index.tsx
    └── NotFound.tsx

supabase/
├── config.toml
├── functions/
│   ├── ai-consultant/        # Chat streaming com contexto do usuário
│   ├── analyze-deductions/   # IR — análise de deduções
│   ├── detect-subscriptions/ # Detecta assinaturas recorrentes
│   ├── generate-budget/      # Sugere % por categoria
│   ├── get-okx-balance/      # Saldos OKX (HMAC-SHA256)
│   ├── ocr-receipt/          # OCR de recibos
│   └── parse-transaction/    # NLU multi-modal (texto/voz/PDF/foto)
└── migrations/
    ├── 20260227235403…  schema inicial
    ├── 20260228000838…  monthly_income + category_budgets
    ├── 20260228001744…  recurrence
    ├── 20260228002904…  RPCs de saldo
    ├── 20260308202748…  policies PERMISSIVE
    ├── 20260520010242…  recálculo de contacts.balance (regra "só pagos")
    └── 20260525235745…  reaplicação do mesmo recálculo
```

### 2.2 Roteamento (`src/App.tsx`)

Todas as rotas autenticadas passam por `ProtectedRoute` → `AppLayout`. As rotas públicas são `/auth` (`AuthRoute` redireciona logados) e `/install`.

```tsx
<Route path="/auth"         element={<AuthRoute><Auth /></AuthRoute>} />
<Route path="/install"      element={<Install />} />
<Route path="/"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
<Route path="/cards"        element={<ProtectedRoute><Cards /></ProtectedRoute>} />
<Route path="/profile"      element={<ProtectedRoute><Profile /></ProtectedRoute>} />
<Route path="/categories"   element={<ProtectedRoute><Categories /></ProtectedRoute>} />
<Route path="/tax-report"   element={<ProtectedRoute><TaxReport /></ProtectedRoute>} />
<Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
<Route path="/hourly-rate"  element={<ProtectedRoute><HourlyRate /></ProtectedRoute>} />
<Route path="*"             element={<NotFound />} />
```

Lazy-loading: cada página é `lazy()` + `Suspense` com `<PageSkeleton />`.

### 2.3 PWA
- `public/manifest.json` define ícones, cor de tema e display `standalone`.
- Página `/install` mostra prompt nativo no Android e instruções manuais (Compartilhar → "Adicionar à Tela de Início") no iOS.

---

## 3. Banco de dados (Supabase)

### 3.1 Schema (estado atual)

#### `profiles` (1:1 com `auth.users`)
| Coluna | Tipo | Default |
|---|---|---|
| user_id | uuid UNIQUE | — |
| full_name | text | NULL |
| avatar_url | text | NULL |
| currency | text | `'BRL'` |
| monthly_income | numeric | 0 |
| created_at / updated_at | timestamptz | now() |

Trigger `handle_new_user` cria a linha automaticamente em `INSERT` na `auth.users`. Trigger `create_default_categories` insere 10 categorias padrão (Salário, Freelance, Investimentos, Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Outros).

#### `accounts`
`id, user_id, name, type ('checking'|'savings'|'wallet'|'investment'), balance numeric, color, icon`. Trigger `updated_at`.

#### `credit_cards`
`id, user_id, name, card_limit, closing_day (1-31), due_day (1-31), color`.

#### `contacts` (dívidas entre pessoas)
`id, user_id, name, balance numeric, avatar_url`. Semântica: `balance > 0` → "me deve"; `< 0` → "eu devo"; `= 0` → quitado.

#### `categories`
`id, user_id, name, icon, color, type ('income'|'expense')`.

#### `category_budgets`
`id, user_id, category_id UNIQUE(user_id, category_id), percentage numeric`. Define a fatia da renda mensal alocada a cada categoria.

#### `transactions`
| Coluna | Observações |
|---|---|
| id, user_id | — |
| description | text |
| amount | numeric(12,2) |
| date | date (default `CURRENT_DATE`) |
| type | `'income' | 'expense' | 'transfer'` |
| category_id, account_id, card_id, contact_id | FKs nullable, `ON DELETE SET NULL` |
| is_paid | boolean default `true` |
| installment_number, total_installments | int, opcionais |
| recurring_group_id | uuid agrupa parcelas/recorrências |
| recurrence | `null | 'weekly' | 'monthly' | 'yearly'` |
| notes | text |

Índices: `(user_id, date DESC)`, `card_id, date`, `account_id`, `contact_id`.

### 3.2 Funções e triggers

```sql
-- Atualização atômica de saldo de conta (verifica auth.uid())
CREATE OR REPLACE FUNCTION public.update_account_balance(p_account_id UUID, p_delta NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE public.accounts SET balance = balance + p_delta
  WHERE id = p_account_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Mesma estrutura para contacts
CREATE OR REPLACE FUNCTION public.update_contact_balance(p_contact_id UUID, p_delta NUMERIC) …
```

Triggers: `update_updated_at_column` em todas as tabelas com `updated_at`; `handle_new_user` e `create_default_categories` em `auth.users`; event trigger `rls_auto_enable` força RLS em qualquer tabela nova em `public`.

### 3.3 RLS
Todas as tabelas: policy única `FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`. `profiles` mantém policies separadas por comando (SELECT/INSERT/UPDATE). DELETE em `profiles` não é permitido.

### 3.4 Histórico de migrações

| Data | Migração | Conteúdo |
|---|---|---|
| 2026-02-27 23:54 | inicial | Cria `profiles`, `accounts`, `credit_cards`, `contacts`, `categories`, `transactions`; RLS; triggers de timestamp; trigger de criação de profile; 10 categorias default |
| 2026-02-28 00:08 | budgets | `profiles.monthly_income` + tabela `category_budgets` |
| 2026-02-28 00:17 | recurrence | `transactions.recurrence` |
| 2026-02-28 00:29 | balance RPCs | `update_account_balance`, `update_contact_balance` |
| 2026-03-08 20:27 | policies | Converte policies para `PERMISSIVE` com role `authenticated` |
| 2026-05-20 01:02 | recálculo | `UPDATE contacts.balance` somando só `is_paid = true` |
| 2026-05-25 23:57 | recálculo (re-run) | Mesma query — reaplicada após mudança de regra na UI |

---

## 4. Camadas auxiliares

### 4.1 `src/lib/format.ts`
- `formatCurrency(value, discrete)` → `Intl pt-BR / BRL` ou `'••••'`.
- `parseLocalDate('YYYY-MM-DD')` → `new Date(y, m-1, d)` (evita UTC).
- `formatDate(date)` → "25 mai" (pt-BR, `day-short` + `month-short`).
- `getBillingPeriod(closingDay, ref)` → janela do ciclo de fatura.

### 4.2 `src/lib/validation.ts` — Zod schemas
- `transactionSchema`: descrição (1-200), amount >0 ≤999M, date `YYYY-MM-DD`, type enum, IDs opcionais como string, `is_paid` bool, `installments` 1-48, `recurrence` enum vazio/weekly/monthly/yearly.
- `categorySchema`, `accountSchema`, `contactSchema`, `creditCardSchema`, `incomeSchema`, `settleSchema`.
- `getUserFriendlyError(err)` mapeia erros Postgres (`row-level security`, `duplicate key`, `foreign key`, `null value`, `check_violation`) para mensagens em pt-BR.

### 4.3 Hooks
- **`useAuth`** — Provider em `App`. Escuta `supabase.auth.onAuthStateChange` e expõe `user`, `loading`, `signOut`.
- **`useAppSettings`** — `discreteMode` (oculta valores com `••••`), persistido em `localStorage`. Usado em todas as páginas para ofuscar saldos.
- **`useBillingPeriod(card)`** — calcula início/fim do ciclo corrente.
- **`useCardInvoice(card)`** — agrega despesas do cartão no ciclo via `closing_day`.

---

## 5. Páginas

### 5.1 `Auth.tsx`
Email/senha via Supabase. Toggle entre Login e Cadastro. Cadastro envia `emailRedirectTo` para a origem atual. Trata erros com `getUserFriendlyError`.

### 5.2 `Dashboard.tsx` (homepage `/`)
Ordem fixa de widgets (memória `style/layout-dashboard`):
1. Fatura corrente do(s) cartão(ões)
2. Despesas por categoria (`ExpenseByCategoryChart`)
3. Burn Rate (`BurnRateChart`) — receita vs despesa
4. Bloco cripto: `CryptoCard`s + `AssetAllocationChart`
5. `PortfolioHealthCard`, `SafeToSpendCard`, `SavingsChallengeCard`, `CryptoRetirementSimulator`, `ScenarioSimulator`
6. Botão de `AIConsultantDialog` (consultoria IA streaming)

Carrega em paralelo `accounts`, `cards`, `transactions`, `categories`, `category_budgets`, saldo OKX (Edge Function).

### 5.3 `Transactions.tsx` (840 linhas — núcleo do app)

Estado e filtros:
- Mês/ano (navegável com setas), tipo (toggle: todos/despesas/receitas/transferência), busca por descrição, e painel "Filtros avançados": categoria, status (pago/pendente), conta, cartão, **pessoa** (todos / somente meus gastos / contato específico).
- `activeFilterCount` controla badge "(N)" no botão Filtros.
- Resumo do mês: Receitas / Despesas / Saldo.

#### Criação de transação (`handleSubmit`)
Fluxos suportados:

**a) Divisão de conta** (`form.split_enabled`):
- Calcula `userPct` (default 50) e `contactPct = 100 - userPct`.
- Cria 2 lançamentos com descrição sufixada `"(sua parte X%)"` e `"(<nome> Y%)"`, mesmo `date/type/category/account/card/is_paid`. Só o do contato tem `contact_id`.
- Account é debitado pelo **valor total**; contato recebe delta de `contactAmount` somente se `is_paid`.

**b) Parcelado / recorrente** (criação normal):
- `count = recurrence ? 12 : installments`. Gera `count` rows com `recurring_group_id` comum.
- Datas calculadas com offset (`+i*7 dias` semanal, `+i meses` parcela/mensal, `+i anos` anual).
- Apenas a **1ª** linha nasce com `is_paid = form.is_paid`; demais nascem `false`.
- **Conta e contato** são debitados apenas pelo valor da 1ª parcela paga (`amount/installments` ou `amount` em recorrência). **Correção crítica aplicada em 2026-05-25:** antes o app debitava o `amount` inteiro mesmo quando só uma parcela estava paga.

**c) Edição** (`editingTx`):
- `UPDATE transactions SET …`.
- **Reconcilia ambos os saldos** (account e contact) calculando delta entre estado antigo e novo (`oldContactId/newContactId`, `oldAccountId/newAccountId`, `oldAmount/amount`, `oldType/form.type`, `oldPaid/newPaid`). **Correção crítica aplicada em 2026-05-25:** antes só o contato era reconciliado, deixando saldos de conta inconsistentes ao editar.

Trecho-chave (criação parcelada — versão corrigida):
```ts
const firstAmount = recurrence ? amount : amount / installments;
if (form.account_id && form.is_paid) {
  const delta = form.type === 'income' ? firstAmount : -firstAmount;
  await supabase.rpc('update_account_balance', { p_account_id: form.account_id, p_delta: delta });
}
if (form.contact_id && form.is_paid) {
  const delta = form.type === 'expense' ? firstAmount : -firstAmount;
  await supabase.rpc('update_contact_balance', { p_contact_id: form.contact_id, p_delta: delta });
}
```

Trecho-chave (edição — versão corrigida):
```ts
// Contato: só conta quando pago
if (oldContactId && oldPaid) await rpc(update_contact_balance, revert);
if (newContactId && newPaid) await rpc(update_contact_balance, apply);

// Conta: convenção atual debita na criação independente de is_paid
if (oldAccountId) await rpc(update_account_balance, revertAcc);
if (newAccountId) await rpc(update_account_balance, applyAcc);
```

#### Exclusão (`handleDelete`)
Estorna account incondicionalmente; estorna contact **apenas se** `tx.is_paid`.

#### Modo lote (batch)
`SmartTransactionInput` pode enfileirar várias transações extraídas por IA. Em batch, ao salvar uma o app:
- aprende a categoria escolhida (`saveCategoryOverride(description, catName)` salva mapping em `localStorage` para que a próxima parse de descrição similar venha já categorizada);
- chama `handleConfirmCurrent()` e `handleBatchNext()` no ref do componente para avançar a fila sem fechar o dialog.

### 5.4 `Profile.tsx`

Três blocos:
1. Cabeçalho com email + botão "Sair".
2. **Contas** — lista com nome, saldo, editar/excluir. Dialog único reaproveitado para criar e editar (`accountSchema`).
3. **Dívidas** — para cada contato:
   - Saldo absoluto formatado, rótulo `"Me deve" | "Eu devo" | "Quitado"`.
   - Contador "X pendente(s)" em âmbar.
   - `Collapsible` "Ver pendências" abre lista de `transactions` com `contact_id` e `is_paid = false`. Cada item tem `Checkbox` para marcar como pago.
   - Botão "Quitar" abre dialog `settleDebt`: cria uma `transaction` com `is_paid: true`, tipo oposto ao saldo (`income` se contato deve a você; `expense` se você devia), e aplica delta no `contact.balance`.

Função `markPaid` (versão corrigida 2026-05-25 — só permite **marcar** como pago):
```ts
const markPaid = async (tx: any) => {
  await supabase.from('transactions').update({ is_paid: true }).eq('id', tx.id);
  // Contact balance only counts paid transactions → apply contribution.
  // Account NÃO é tocada: já foi debitada na criação (convenção do app).
  if (tx.contact_id) {
    const amount = Number(tx.amount);
    const delta = tx.type === 'expense' ? amount : -amount;
    await supabase.rpc('update_contact_balance', { p_contact_id: tx.contact_id, p_delta: delta });
  }
  toast.success('Lançamento marcado como pago!');
  loadData();
};
```

Carregamento: 4 queries em paralelo (profile, accounts, contacts, transactions filtradas por `contact_id IS NOT NULL` e `is_paid = false`). Pendentes são agrupadas por contato em `pendingByContact`.

### 5.5 `Cards.tsx`
CRUD de cartões; navegação por fatura com `InvoiceNavigator` (mês a mês); lista de despesas da fatura corrente (`InvoiceTransactionList`) com filtros (`InvoiceFilters`) e totalizador (`InvoiceSummary`). Usa `useCardInvoice` para agregar.

### 5.6 `Categories.tsx`
CRUD de categorias. Para despesas, exibe campo `percentage` que grava em `category_budgets`. Total dos % é validado no front. Sugestão automática via Edge Function `generate-budget` (botão "Gerar orçamento sugerido").

### 5.7 `Settings.tsx`
- **OKX API:** form com api_key/secret/passphrase; valores são guardados como **Supabase Secrets** (nunca em tabela) e usados pela Edge Function `get-okx-balance`.
- **WebAuthn:** biometria local para destravar Discreet Mode.
- **Discreet Mode** toggle: ativa `discreteMode` em `useAppSettings`. Todos os valores monetários renderizam `••••`.
- `SubscriptionAlerts` — convoca `detect-subscriptions` para identificar cobranças recorrentes nos últimos 90 dias.

### 5.8 `TaxReport.tsx`
Quatro abas:
- **Overview** — totais anuais agregados.
- **AIDeductionsTab** — chama `analyze-deductions` (IA detecta despesas dedutíveis).
- **CryptoAssetsTab** — saldos OKX convertidos para BRL; alerta de GCAP quando ganhos > R$ 35.000/mês.
- **OCRScannerTab** — upload de imagem → `ocr-receipt` extrai dados estruturados.

### 5.9 `HourlyRate.tsx`
Calculadora de valor/hora para profissionais autônomos. Recebe custos fixos, horas/mês, lucro alvo. Botão "Gerar escopo com IA" usa o Gateway para sugerir entregáveis e cronograma.

### 5.10 `Install.tsx`
Detecta SO via `navigator.userAgent`. Android: dispara `beforeinstallprompt`. iOS: instruções visuais com ícone de Compartilhar.

---

## 6. Componente-chave: `SmartTransactionInput`

Entrada multi-modal de transações com revisão interativa:

- **Modos:** texto livre, voz (Web Speech API), upload de PDF (extrato), upload de foto (recibo).
- **Backend:** Edge Function `parse-transaction` recebe o conteúdo e devolve array de objetos `{description, amount, date, type, category_name, account_name, card_name, contact_name, recurrence, installments}`.
- **Fila interativa:** quando vêm múltiplas transações, entra em modo lote (`onBatchStart`). Cada uma popula o formulário; usuário ajusta e salva; `handleBatchNext()` carrega a próxima.
- **Aprendizado de categoria:** `saveCategoryOverride(description, categoryName)` em `localStorage` faz a próxima parse de descrição similar vir já categorizada (sem chamada de IA).
- **Ref imperativo:** `SmartTransactionInputHandle` expõe `handleConfirmCurrent()` e `handleBatchNext()` consumidos por `Transactions.tsx`.

---

## 7. Edge Functions (Deno)

Todas exigem JWT (`verify_jwt = true` em `supabase/config.toml`) e usam `Deno.env.get(...)` para secrets.

| Função | Propósito | Secrets/integrações |
|---|---|---|
| `ai-consultant` | Chat streaming com contexto completo do usuário (transações, saldos, metas). | `LOVABLE_API_KEY` |
| `analyze-deductions` | Identifica despesas dedutíveis no IR a partir das transações do ano. | `LOVABLE_API_KEY` |
| `detect-subscriptions` | Cruza 90 dias de despesas e detecta cobranças recorrentes. | `LOVABLE_API_KEY` |
| `generate-budget` | Sugere % por categoria com base na renda e histórico. | `LOVABLE_API_KEY` |
| `get-okx-balance` | Assina request com HMAC-SHA256, busca saldos OKX, converte para BRL. | `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE` |
| `ocr-receipt` | OCR + parsing de cupom fiscal em JSON. | `LOVABLE_API_KEY` |
| `parse-transaction` | NLU multi-modal (texto/voz/PDF/imagem) → JSON estruturado. | `LOVABLE_API_KEY` |

---

## 8. Funcionalidades de produto

### 8.1 Fatura de cartão
Despesas com `card_id` são agrupadas pelo `closing_day` do cartão (não pelo mês civil). O `useCardInvoice` calcula o ciclo via `getBillingPeriod` e soma despesas dentro da janela `(closingDay+1 do mês anterior … closingDay do mês corrente)`.

### 8.2 Dívidas / Quitação
Transações com `contact_id` movimentam `contacts.balance` apenas quando `is_paid = true`. Marcar como pago dispara `update_contact_balance`. O botão "Quitar" cria uma transação avulsa quitando o saldo.

### 8.3 Transações programadas / parceladas
Implementadas **como rows futuras no DB** (e não como um agendador externo). `recurring_group_id` agrupa o conjunto. Parceladas têm `installment_number/total_installments`; recorrentes têm `recurrence` setado e geram 12 ocorrências.

### 8.4 Orçamento por categoria
% sobre `profiles.monthly_income`. Front converte para BRL para comparar com gastos do mês.

### 8.5 Safe-to-Spend
Gauge: `monthly_income − sum(orçamentos do mês) − DCA planejado`.

### 8.6 Burn Rate
Linha receita vs despesa nos últimos meses; calcula meses de runway com base no saldo total.

### 8.7 Portfolio Health
Health monitor + stress test + Contribution Challenge baseado em metas de aporte mensal.

### 8.8 Simulador de Aposentadoria Cripto
Projeta valor de ativos OKX em 5/10/15/20 anos com taxas configuráveis.

### 8.9 IA Consultor
Streaming chat com contexto: transações recentes, saldos, metas, alocação. Botão flutuante no Dashboard abre o dialog.

### 8.10 Análise de Assinaturas
Detecta recorrências pelo padrão de descrição + valor + intervalo nos últimos 90 dias.

### 8.11 Calculadora de Engenharia / Hourly Rate
Inputs: custo fixo mensal, horas faturáveis, margem alvo. Output: R$/hora. Botão IA gera escopo de proposta.

### 8.12 Discreet Mode
`useAppSettings.discreteMode` substitui qualquer valor monetário por `••••` no front. Sem efeito no banco.

### 8.13 Ajuda Contextual
`InfoButton` consulta `helpContent.ts` (mapa key → `{title, body}`) e abre Dialog explicativo. Espalhado por cards e features.

---

## 9. Histórico de mudanças recentes (últimas iterações)

### 9.1 Divisão de conta no lançamento (split)
- Novo bloco no formulário de criação ("Dividir conta com…").
- Default 50/50; campo de % do usuário (vazio = 50). Campo do contato é calculado e desabilitado.
- Gera 2 lançamentos com descrição sufixada. Account total é debitada da conta do usuário; metade do contato vira saldo de dívida (se `is_paid`).

### 9.2 Filtro "Pessoa" em `/transactions`
Select com opções: **Todas as pessoas** / **Somente meus gastos** (`contact_id IS NULL`) / cada contato individualmente. Integra com o restante dos filtros avançados e conta no badge.

### 9.3 Integração quitação ↔ checkbox de pagamento
- Pendências de cada contato aparecem inline no card do `Profile` (`Collapsible`).
- Checkbox marca como pago; aplica delta atômico no `contact.balance`.
- Lista filtra `is_paid = false`, então marcado some imediatamente.
- Migração one-shot recalcula `contacts.balance` somando só `is_paid = true`.

### 9.4 Revisão e correção de bugs (2026-05-25)
Após auditoria, foram corrigidos:

| # | Bug | Status |
|---|---|---|
| 1 | Edição de transação não reconciliava `accounts.balance` quando mudavam valor/tipo/conta/is_paid | **Corrigido** — reconciliação dual (antes só contato) |
| 2 | Parcelado debitava conta com **valor total** mesmo só a 1ª parcela sendo paga (R$300 em 3x → conta -R$300 em vez de -R$100) | **Corrigido** — usa `amount/installments` |
| 3 | Mesmo bug do #2 afetava `contacts.balance` em parceladas | **Corrigido** junto com #2 |
| 4 | `togglePaid` no Profile tinha caminho de "desmarcar" inalcançável (UI `checked={false}` fixo) | **Simplificado** para `markPaid` (apenas marca) |
| 5 | Falta de comentário deixava ambíguo se `Profile.markPaid` deveria tocar em `accounts.balance` | Adicionado comentário explicando convenção (conta já debitada na criação) |
| 6 | `contacts.balance` desincronizado após mudança de regra | Migração SQL reaplicada |

---

## 10. Snippets críticos de código (estado atual)

### 10.1 `Transactions.handleSubmit` — edição com dupla reconciliação
```ts
const oldContactId = editingTx.contact_id || null;
const oldAccountId = editingTx.account_id || null;
const oldAmount    = Number(editingTx.amount);
const oldType      = editingTx.type;
const oldPaid      = !!editingTx.is_paid;
const newContactId = form.contact_id || null;
const newAccountId = form.account_id || null;
const newPaid      = !!form.is_paid;

// Contato: só conta quando pago
if (oldContactId && oldPaid) {
  const revert = oldType === 'expense' ? -oldAmount : oldAmount;
  await supabase.rpc('update_contact_balance', { p_contact_id: oldContactId, p_delta: revert });
}
if (newContactId && newPaid) {
  const apply = form.type === 'expense' ? amount : -amount;
  await supabase.rpc('update_contact_balance', { p_contact_id: newContactId, p_delta: apply });
}

// Conta: convenção atual debita na criação independentemente de is_paid.
// Na edição, reverte antigo e aplica novo.
if (oldAccountId) {
  const revertAcc = oldType === 'income' ? -oldAmount : oldAmount;
  await supabase.rpc('update_account_balance', { p_account_id: oldAccountId, p_delta: revertAcc });
}
if (newAccountId) {
  const applyAcc = form.type === 'income' ? amount : -amount;
  await supabase.rpc('update_account_balance', { p_account_id: newAccountId, p_delta: applyAcc });
}
```

### 10.2 `Transactions.handleSubmit` — split
```ts
const userPct = (form.split_user_percent.trim() === '') ? 50 : parseFloat(form.split_user_percent);
const contactPct = 100 - userPct;
const userAmount    = Math.round((amount * userPct)    / 100 * 100) / 100;
const contactAmount = Math.round((amount * contactPct) / 100 * 100) / 100;

const txsToInsert = [
  { ...baseShared, description: `${form.description} (sua parte ${userPct}%)`,
    amount: userAmount, contact_id: null },
  { ...baseShared, description: `${form.description} (${contactName} ${contactPct}%)`,
    amount: contactAmount, contact_id: form.split_contact_id },
];
await supabase.from('transactions').insert(txsToInsert);

if (form.account_id) {
  const delta = form.type === 'income' ? amount : -amount;
  await supabase.rpc('update_account_balance', { p_account_id: form.account_id, p_delta: delta });
}
if (contactAmount > 0 && form.is_paid) {
  const delta = form.type === 'expense' ? contactAmount : -contactAmount;
  await supabase.rpc('update_contact_balance', { p_contact_id: form.split_contact_id, p_delta: delta });
}
```

### 10.3 `Profile.markPaid`
```ts
const markPaid = async (tx: any) => {
  setTogglingTxId(tx.id);
  try {
    await supabase.from('transactions').update({ is_paid: true }).eq('id', tx.id);
    if (tx.contact_id) {
      const amount = Number(tx.amount);
      const delta = tx.type === 'expense' ? amount : -amount;
      await supabase.rpc('update_contact_balance', { p_contact_id: tx.contact_id, p_delta: delta });
    }
    toast.success('Lançamento marcado como pago!');
    loadData();
  } catch (err: any) { toast.error(getUserFriendlyError(err)); }
  finally { setTogglingTxId(null); }
};
```

### 10.4 `Profile.settleDebt`
```ts
const isPositive = Number(settleDialog.balance) > 0; // contato deve a mim
await supabase.from('transactions').insert({
  user_id: user.id,
  description: `Quitação - ${settleDialog.name}`,
  amount,
  date: new Date().toISOString().split('T')[0],
  type: isPositive ? 'income' : 'expense',
  contact_id: settleDialog.id,
  is_paid: true,
});
const delta = isPositive ? -amount : amount;
await supabase.rpc('update_contact_balance', { p_contact_id: settleDialog.id, p_delta: delta });
```

### 10.5 Filtro "Pessoa" em `Transactions`
```ts
if (filterContact === 'none' && tx.contact_id) return false;
if (filterContact !== 'all' && filterContact !== 'none' && tx.contact_id !== filterContact) return false;
```

### 10.6 RPC atômico (Postgres)
```sql
CREATE OR REPLACE FUNCTION public.update_contact_balance(p_contact_id UUID, p_delta NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE public.contacts SET balance = balance + p_delta
  WHERE id = p_contact_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
```

---

## 11. Restrições e itens fora de escopo conhecidos

- **Leaked Password Protection** do Supabase Auth precisa ser ativado manualmente no painel (memória `constraints/seguranca-manual`).
- **Split sem grupo:** os 2 lançamentos gerados pelo split não são vinculados por um `split_group_id` — editar a "sua parte" não reflete na "parte do contato". Mudança intencional, fora do escopo atual.
- **Convenção de saldo de conta:** débito na criação (independente de `is_paid`). Alinhar com a regra do contato exigiria migração ampla e está intencionalmente fora do escopo.
- **UI para desmarcar pagamento no Perfil:** apenas marca como pago; para reverter, usar a edição em `/transactions`.
- **Pluggy / Open Finance:** descartado — não re-propor.
- **Card standalone de DCA no Dashboard:** removido — não re-adicionar (substituído pela seção integrada).

---

## 12. Apêndice — URLs e identificadores

- **Preview:** `https://id-preview--c03407ca-30fa-4fd3-b7b9-7af90bdbcaed.lovable.app`
- **Publicado:** `https://pocket-fin-control.lovable.app`
- **Lovable project ID:** `c03407ca-30fa-4fd3-b7b9-7af90bdbcaed`
- **Supabase ref:** `peiwulcxpihozgcmbgua`
- **Secrets ativos:** `LOVABLE_API_KEY`, `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`.
