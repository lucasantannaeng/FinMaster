# Contexto Técnico — FinMaster v2

> Documento de arquitetura vivo. Última revisão: 07/07/2026.
> Público-alvo: engenharia de dados, backend, produto.
> Escopo: descrição fiel do que **existe hoje** no repositório, sem roadmap especulativo (salvo seção 7).

---

## 1. Visão Geral e Objetivo

FinMaster é um **PWA mobile-first de controle financeiro pessoal avançado** para o mercado brasileiro (moeda base BRL), voltado a usuários que combinam vida financeira tradicional (contas, cartões, salário) com **exposição a cripto** (via OKX) e obrigações fiscais (IRPF).

### Capacidades atuais em produção

| Área | Funcionalidade |
|------|----------------|
| **Lançamentos** | CRUD de transações (receita / despesa / transferência), parcelamento em N vezes, recorrências (mensal / semanal / anual) materializadas em linhas futuras, marcação `is_paid`. |
| **Entrada Inteligente (IA)** | `SmartTransactionInput` — entrada multi-modal por texto livre, voz (Web Speech API), foto de comprovante e PDF. Fila de revisão interativa antes de persistir. |
| **Cartão de Crédito** | Faturas calculadas dinamicamente por `closing_day` / `due_day`. Navegador de faturas com filtros (categoria, terceiro, pago/pendente, busca). Suporte a gastos de terceiros dentro da fatura com débito consolidado. |
| **Terceiros (Dívidas)** | Contatos com saldo devedor. Transações vinculadas a `contact_id` atualizam o saldo do terceiro via RPC atômica; edição/exclusão reverte o saldo. |
| **Orçamento por Categoria** | Percentual do `monthly_income` alocado por categoria; barra de progresso mensal comparando gastos reais vs. teto. |
| **Dashboard Analítico** | Saúde do portfólio, Burn Rate, alocação de ativos, Safe-to-Spend (gauge), simulador de aposentadoria cripto, DCA performance, desafio de poupança, simulador de cenários. |
| **Consultor IA** | Chat com streaming SSE (`ai-consultant`) que recebe contexto completo do portfólio (fiat + cripto + fluxo). |
| **Imposto de Renda** | Aba de análise de deduções por IA, OCR de comprovantes, listagem de ativos cripto (GCAP) com alerta > R$ 35.000 / mês. |
| **Integração OKX** | Edge Function assinada com HMAC-SHA256 lê saldos e converte para BRL em tempo real. |
| **Assinaturas** | `detect-subscriptions` analisa 90 dias e sinaliza gastos recorrentes suspeitos. |
| **Segurança & UX** | WebAuthn (biometria), Discreet Mode (mascara valores com `••••`), auth Supabase, RLS por `auth.uid()`. |
| **PWA** | Instalação nativa Android, tutorial manual iOS Safari. |
| **Extras** | Calculadora de Hora do Engenheiro (com geração de escopo por IA), sistema de ajuda contextual via `InfoButton` mapeado em `helpContent.ts`. |

---

## 2. Stack Tecnológica

### Frontend

| Camada | Tecnologia | Versão / Nota |
|--------|-----------|---------------|
| Build | Vite 5 | dev server porta 8080 |
| Linguagem | TypeScript 5 | `strict` habilitado |
| UI Framework | React 18 | function components + hooks |
| Estilo | Tailwind CSS v3 | tema `Fintech Premium` (grafite/teal) |
| Design System | shadcn/ui + Radix Primitives | tokens semânticos em `src/index.css` |
| Ícones | lucide-react | — |
| Roteamento | react-router-dom v6 | `<BrowserRouter>` em `main.tsx` |
| Data Fetching | @tanstack/react-query v5 | `staleTime` explícito por query |
| Formulários / Validação | Zod | schemas em `src/lib/validation.ts` |
| Charts | recharts | dashboards e simuladores |
| Markdown | react-markdown | render de respostas do consultor IA |
| Toasts | sonner | canonical (`use-toast` legado disponível) |
| Auth Client | @supabase/supabase-js v2 | `src/integrations/supabase/client.ts` |
| Datas | date-fns + helper `parseLocalDate` | evita bug de UTC offset em `YYYY-MM-DD` |

### Backend

| Camada | Tecnologia |
|--------|-----------|
| Banco | Supabase Postgres (schema `public`) |
| Auth | Supabase Auth (email/password + JWT) |
| Segurança | RLS por `user_id = auth.uid()` em todas as tabelas de usuário |
| Serverless | Supabase Edge Functions (Deno runtime) |
| IA | OpenRouter (primário) → Groq (fallback), via helper `_shared/ai-fallback.ts` |
| Integrações | OKX API v5 (HMAC-SHA256) |

### Ferramentas / Qualidade

ESLint 9 (flat config) · typescript-eslint · react-hooks · vitest · Playwright (via sandbox) · bun (package manager).

---

## 3. Arquitetura de UI/UX

### 3.1 Mapa de Rotas (`src/App.tsx`)

```
/                    → Dashboard          (analytics + consultor IA)
/transactions        → Transactions       (CRUD + fila de revisão IA)
/cards               → Cards              (faturas por closing_day)
/categories          → Categories         (orçamento % da renda)
/tax                 → TaxReport          (IRPF + OCR + cripto)
/profile             → Profile            (perfil + WebAuthn)
/settings            → Settings           (OKX API + Discreet Mode)
/hourly-rate         → HourlyRate         (calculadora engenharia)
/auth                → Auth               (login / signup)
/install             → Install            (PWA onboarding)
/trust               → Trust              (política de dados)
*                    → NotFound
```

### 3.2 Shell da Aplicação

- `AppLayout` — layout raiz autenticado.
- `AppSidebar` — sidebar desktop; em mobile, drawer/sheet acionado do topo.
- `NavLink` — item de navegação com estado ativo.
- `PageSkeleton` — placeholder consistente durante fetch.

### 3.3 Componentes Centrais

| Componente | Papel |
|-----------|-------|
| `SmartTransactionInput` | Entrada multi-modal (texto, voz, foto, PDF). Envia payload à Edge Function `parse-transaction`, recebe estrutura JSON, popula fila de revisão. Aceita batch de múltiplos itens com alertas contextuais. |
| `AIConsultantDialog` | Modal de chat streaming SSE contra `ai-consultant`. Recebe `portfolioContext` completo (fiat + cripto + fluxo mensal + exposição ETH). |
| `InvoiceNavigator` / `InvoiceSummary` / `InvoiceFilters` / `InvoiceTransactionList` | Composição da tela de fatura de cartão. Navegação mês-a-mês, filtros locais (busca, categoria, contato, is_paid), agrupamento por terceiro. |
| Dashboard: `PortfolioHealthCard`, `BurnRateChart`, `SafeToSpendCard`, `AssetAllocationChart`, `ExpenseByCategoryChart`, `CryptoRetirementSimulator`, `DCAPerformanceCard`, `SavingsChallengeCard`, `ScenarioSimulator` | Widgets analíticos. Ordem definida em memória: Fatura Atual → Categorias → Burn Rate → Cripto. |
| Tax: `OverviewTab`, `AIDeductionsTab`, `CryptoAssetsTab`, `OCRScannerTab` | Composição da tela IRPF. |
| `InfoButton` | Abre `Dialog` com conteúdo de `src/lib/helpContent.ts` (ajuda contextual). |
| `CryptoCard` | Card individual de ativo cripto com preço, variação 24h, valor em BRL. |
| `SubscriptionAlerts` | Lista assinaturas recorrentes detectadas por IA. |

### 3.4 Estado Global

- `AuthProvider` (`useAuth`) — sessão Supabase + `onAuthStateChange`.
- `AppSettingsProvider` (`useAppSettings`) — Discreet Mode + moeda base, persistidos em `localStorage`.
- React Query Cache — chaves `card-invoice`, `categories`, `transactions`, `okx-balance`, etc.

### 3.5 Fluxo de Interação Típico

1. Usuário abre `/` → Dashboard busca em paralelo saldos OKX (Edge), transações do mês, categorias, orçamentos.
2. Toca no FAB “+ Lançamento” → `SmartTransactionInput` aparece.
3. Grava por voz → transcrição PT-BR → `parse-transaction` → resposta JSON com N itens → fila de revisão.
4. Confirma → INSERT em `transactions` + RPC de atualização de saldo (`update_account_balance` ou `update_contact_balance`).
5. React Query invalida `card-invoice` / dashboards → UI reflete imediatamente.

---

## 4. Esquema de Dados (Supabase — schema `public`)

Todas as tabelas usam `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL` (referência lógica a `auth.users.id`), `created_at`/`updated_at timestamptz default now()`, e possuem **RLS habilitada** com política `user_id = auth.uid()`.

### 4.1 `profiles`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| full_name | text | YES | — |
| avatar_url | text | YES | — |
| currency | text | NO | `'BRL'` |
| monthly_income | numeric | NO | `0` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

Criado automaticamente pelo trigger `handle_new_user()` a cada signup. 3 políticas RLS (select/insert/update próprios).

### 4.2 `accounts`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| name | text | NO | — |
| type | text | NO | `'checking'` |
| balance | numeric | NO | `0` |
| color | text | YES | `'#0EA5E9'` |
| icon | text | YES | `'wallet'` |
| created_at / updated_at | timestamptz | NO | `now()` |

Saldo mutado apenas via RPC `update_account_balance(p_account_id, p_delta)`.

### 4.3 `categories`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| name | text | NO | — |
| icon | text | YES | `'tag'` |
| color | text | YES | `'#6366F1'` |
| type | text | NO | `'expense'` (`income` \| `expense`) |
| created_at | timestamptz | NO | `now()` |

10 categorias-semente inseridas via trigger `create_default_categories()` no signup.

### 4.4 `category_budgets`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| category_id | uuid | NO | FK lógica → `categories.id` |
| percentage | numeric | NO | `0` |
| created_at / updated_at | timestamptz | NO | `now()` |

Orçamento em % da `profiles.monthly_income`. Conversão para BRL feita no client.

### 4.5 `contacts`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| name | text | NO | — |
| balance | numeric | NO | `0` (positivo = deve ao usuário) |
| avatar_url | text | YES | — |
| created_at / updated_at | timestamptz | NO | `now()` |

Mutado apenas por `update_contact_balance(p_contact_id, p_delta)` — chamado somente quando a transação está `is_paid = true`.

### 4.6 `credit_cards`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| name | text | NO | — |
| card_limit | numeric | NO | `0` |
| closing_day | integer | NO | 1–31 |
| due_day | integer | NO | 1–31 |
| color | text | YES | `'#8B5CF6'` |
| created_at / updated_at | timestamptz | NO | `now()` |

### 4.7 `transactions`
| Coluna | Tipo | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | — |
| description | text | NO | — |
| amount | numeric | NO | — (sempre positivo; sinal deriva de `type`) |
| date | date | NO | `CURRENT_DATE` |
| type | text | NO | `income` \| `expense` \| `transfer` |
| category_id | uuid | YES | FK lógica → `categories.id` |
| account_id | uuid | YES | FK lógica → `accounts.id` |
| card_id | uuid | YES | FK lógica → `credit_cards.id` (mutuamente exclusivo com `account_id`) |
| contact_id | uuid | YES | FK lógica → `contacts.id` (gasto de terceiro) |
| is_paid | boolean | NO | `true` |
| installment_number | integer | YES | 1..N |
| total_installments | integer | YES | N |
| recurring_group_id | uuid | YES | agrupa parcelas / recorrências |
| recurrence | text | YES | `monthly` \| `weekly` \| `yearly` |
| notes | text | YES | — |
| created_at / updated_at | timestamptz | NO | `now()` |

**Todas** as parcelas e recorrências são materializadas como linhas físicas em `transactions` no momento da criação — não há geração dinâmica em runtime.

### 4.8 Funções e Triggers Ativos

- `handle_new_user()` — cria row em `profiles` no signup.
- `create_default_categories()` — cria 10 categorias-padrão no signup.
- `update_updated_at_column()` — trigger genérica.
- `update_account_balance(uuid, numeric)` — SECURITY DEFINER, escopa por `auth.uid()`.
- `update_contact_balance(uuid, numeric)` — idem.
- `rls_auto_enable()` — event trigger DDL que ativa RLS automaticamente em qualquer nova tabela criada em `public`.

### 4.9 Storage & Realtime

- Storage buckets: **nenhum** (comprovantes trafegam apenas em memória durante o OCR, não persistidos).
- Realtime: nenhuma tabela publicada em `supabase_realtime`.

---

## 5. Motor de IA (Edge Functions)

### 5.1 Filosofia Arquitetural

O gateway histórico `ai.gateway.lovable.dev` foi **completamente desativado** no backend. Toda chamada a LLM passa pelo helper centralizado `supabase/functions/_shared/ai-fallback.ts`, que orquestra um padrão de tolerância a falhas de dois provedores gratuitos:

```
[Edge Function] → callChatCompletion() → OpenRouter (primário)
                                            │
                                            └─ on failure (timeout / 5xx / 4xx)
                                                    ↓
                                                  Groq (fallback)
```

### 5.2 Helper `_shared/ai-fallback.ts`

Exporta duas APIs OpenAI-compatíveis:

- **`callChatCompletion(payload)`** — retorna JSON (não-stream). Preserva `messages`, `tools`, `tool_choice`, `response_format`, `temperature` do caller; injeta apenas o campo `model`.
- **`callChatCompletionStream(payload)`** — retorna `Response` SSE bruto para repasse ao frontend.

**Seleção dinâmica de modelo:**

| Provedor | Modelo texto | Modelo com imagem |
|----------|--------------|-------------------|
| OpenRouter (primário) | `google/gemini-2.5-flash` | `google/gemini-2.5-flash` (multimodal nativo) |
| Groq (fallback) | `llama-3.3-70b-versatile` | `llama-3.2-90b-vision-preview` |

A função `payloadHasImages()` inspeciona blocos `type: "image_url"` nas `messages` e comuta o modelo Groq dinamicamente para blindar contra crash em modelos text-only.

**Resiliência:**
- `fetchWithTimeout()` via `AbortController`, timeout 30 s.
- Duplo `try/catch`: `console.warn("OpenRouter falhou (Status X), acionando Groq...")` no primeiro erro; `console.error` só se **ambos** falharem.
- `readErrorSnippet()` extrai 300 chars do corpo de erro para diagnóstico.
- Erros do gateway antigo (429/402) mapeados de forma uniforme para `{"error":"Erro ao processar com IA"}` HTTP 500.

**Secrets consumidos:** `OPENROUTER_API_KEY`, `GROQ_API_KEY` (ambos configurados).

### 5.3 Inventário de Edge Functions

| Função | Modo | Payload | Responsabilidade |
|--------|------|---------|------------------|
| **`parse-transaction`** | JSON + tool-calling | texto \| áudio-transcrito \| imagem \| PDF | Extrai lista de transações estruturadas (`description`, `amount`, `date`, `type`, `category_hint`, `installments`). Contrato JSON estrito via `tools`. Consumida por `SmartTransactionInput`. |
| **`ocr-receipt`** | JSON (vision) | image_url | Extrai valor total, data, estabelecimento e itens de comprovante. Alimenta `OCRScannerTab` na tela de IR. |
| **`analyze-deductions`** | JSON | ano-calendário + array de transações | Classifica despesas potencialmente dedutíveis no IRPF (Saúde, Educação, Previdência, Doações), com justificativa. |
| **`generate-budget`** | JSON | `monthly_income` + categorias | Sugere alocação percentual por categoria (regra 50/30/20 adaptada). |
| **`detect-subscriptions`** | JSON | 90 dias de transações | Detecta padrões recorrentes (mesmo valor ± tolerância, mesma descrição fuzzy) e retorna assinaturas suspeitas. |
| **`ai-consultant`** | **Streaming SSE** | histórico de mensagens + `portfolioContext` | Chat conversacional; contexto inclui saldo fiat, patrimônio cripto em BRL, exposição ETH, renda e despesa do mês. Usa `callChatCompletionStream`. |
| **`get-okx-balance`** | JSON | — (auth Supabase) | Assina requisição OKX v5 com HMAC-SHA256 (`OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`), retorna saldos por moeda + preço em USDT convertido para BRL. **Não usa IA.** |

Todas exigem **Supabase Auth** (`Authorization: Bearer <access_token>`) e CORS restrito a `APP_ORIGIN`.

### 5.4 Contratos Preservados na Migração

Durante a migração para o fallback, foram mantidos intactos: CORS, `system prompt`, estrutura de `tools`, `response_format: { type: "json_object" }`, shapes de erro esperadas pelo frontend e o formato SSE do consultor.

---

## 6. Lógicas de Negócio Críticas

### 6.1 Fatura de Cartão de Crédito

Definida em `useBillingPeriod.ts` e consumida por `useCardInvoice.ts`.

Dado um `credit_cards.closing_day = D` e uma data-alvo `T`:

```
janelaFatura(T, D) = [ dataFechamentoAnterior(T, D) + 1 dia,
                       dataFechamentoAtual(T, D) ]
```

- `dataFechamentoAtual` = último dia ≤ T cujo `getDate() === D` (com clamp para meses de 28/30 dias).
- Todas as transações com `card_id = X` e `date` dentro da janela compõem a fatura.
- **Total da fatura ignora filtros** (`totalBill` em `useCardInvoice`), enquanto `filteredTotal` responde aos filtros da UI.
- Marcar como pago (`is_paid = true`) dispara `update_contact_balance` **somente se** houver `contact_id` — o saldo do terceiro só reflete transações efetivamente pagas.

### 6.2 Parcelamentos

No momento do INSERT via `SmartTransactionInput` ou formulário manual:

- Se `total_installments = N > 1`, são criadas **N linhas físicas** em `transactions`, todas com o mesmo `recurring_group_id` (UUID gerado no client).
- `installment_number` varia de 1 a N; `date` é incrementada em +1 mês por parcela (respeitando `parseLocalDate` para evitar deslocamento UTC).
- `amount` é dividido igualmente; centavos residuais ficam na última parcela.
- Cancelar a série remove todas as linhas com o mesmo `recurring_group_id` e reverte saldos correspondentes.

### 6.3 Recorrências

Análogas ao parcelamento, mas usam `recurrence ∈ {weekly, monthly, yearly}` e materializam um horizonte fixo de linhas futuras. Não há job de replicação — se o usuário quiser estender, precisa reabrir a série.

### 6.4 Orçamento por Categoria

- `category_budgets.percentage` é uma fração de `profiles.monthly_income`.
- Teto BRL = `monthly_income * percentage / 100`.
- Consumo do mês = soma de `transactions` onde `type = 'expense'` AND `category_id = X` AND `date` no mês corrente.
- Barra de progresso em `Categories.tsx`; ultrapassagem sinalizada visualmente.

### 6.5 Integridade de Saldos (Concorrência)

- **Nunca** o client aplica `UPDATE accounts SET balance = balance + delta`.
- Toda mutação de saldo passa por RPC SECURITY DEFINER (`update_account_balance`, `update_contact_balance`) que aplica o delta atomicamente em uma única query, evitando race condition entre leitura e escrita.
- Edição/exclusão de transação reverte o delta anterior antes de aplicar o novo (padrão compensatório).

### 6.6 Discreet Mode

Flag booleana em `localStorage['pf_discrete']`, exposta via `useAppSettings`. O hook `useDiscreteValue(v)` retorna `'••••'` quando ativa; usado em todos os cards de saldo, patrimônio e valores sensíveis.

### 6.7 Precisão de Cripto

Valores cripto exibidos com **5 casas decimais**. Conversão USDT → BRL feita em runtime na Edge Function `get-okx-balance` usando o próprio ticker da OKX (não há cotação de terceiros).

---

## 7. Limitações e Próximos Passos

### 7.1 Limitações Conhecidas

- **Sem storage persistente** de comprovantes: OCR é fire-and-forget; a imagem original não é arquivada.
- **Sem Realtime**: qualquer atualização em outra aba exige refetch manual (React Query `staleTime` mitiga, mas não elimina).
- **FKs lógicas** (`user_id`, `category_id`, `account_id`, etc.) não são `FOREIGN KEY` no schema — a integridade é garantida por RLS e código, não pelo Postgres. Um `DELETE CASCADE` real inexiste.
- **Leaked Password Protection** do Supabase Auth é ativada **manualmente** no painel (constraint de deploy, não versionada).
- **Recorrências** não têm auto-extensão; horizonte é fixo no momento da criação.
- **Gateway Lovable AI legado** (`LOVABLE_API_KEY`) ainda existe como secret mas não é mais chamado — pode ser removido em uma limpeza futura.
- **Modelos Groq** estão em preview (`llama-3.2-90b-vision-preview`); estabilidade depende do provedor.

### 7.2 Próximos Passos Sugeridos

| Prioridade | Item | Descrição |
|-----------|------|-----------|
| Alta | **Módulo Investimentos OKX completo** | Ir além do saldo: histórico de trades, P&L realizado por ativo, base de custo GCAP para IRPF automatizada. |
| Alta | **Dashboard analítico avançado** | Cash flow projetado 90/180 dias, análise de sazonalidade, alertas preditivos de estouro de orçamento. |
| Média | **Storage de comprovantes** | Bucket `receipts/` com política RLS por `user_id`; anexar `receipt_url` em `transactions`. |
| Média | **Foreign Keys reais** | Migrar FKs lógicas para constraints reais com `ON DELETE` explícito (`SET NULL` para categorias, `CASCADE` para parcelas). |
| Média | **Realtime seletivo** | Publicar `transactions` e `accounts` em `supabase_realtime` para sync multi-aba / multi-device. |
| Média | **Broker adicional** | Abstrair `get-okx-balance` para suportar Binance / Mercado Bitcoin via strategy pattern. |
| Baixa | **Rate limiting nas Edge Functions de IA** | Contador por `user_id` em tabela `ai_usage` para evitar abuso mesmo com provedores gratuitos. |
| Baixa | **i18n** | Extração de strings PT-BR hardcoded para suportar EN/ES. |
| Baixa | **Limpeza** | Remover `LOVABLE_API_KEY` dos secrets; deletar código morto residual do gateway antigo. |

---

*Fim do documento — `contexto_finmaster_v2.md`.*
