# 📦 Relatório de Release — FinMaster Desktop v1.2.0 & Mobile Android (Blindagem & IA Autoral)

**Data da Compilação:** 23/09/2026 10:15 (Horário Local)  
**Ambiente:** Windows 10/11 x64 (Electron 44.4.5, Node.js v24.12, Vite 5.4, React 18.3, Capacitor 8.5.1, TanStack Query v5)  
**Autor:** Luca Rodrigues Gomes de Sant'Anna (`lucasantannaeng@gmail.com`)

---

## 🎯 Arquitetura & Melhorias Implementadas Nesta Release

### 1. Blindagem de Conectividade e Resiliência Multiplataforma
- **`SingleInstanceLock` no Electron**: Injetado em `electron/main.cjs`. Previne abertura de múltiplas instâncias concorrentes de `FinMaster.exe`. Tentativas de abertura duplicada focam e restauram a janela ativa já existente e encerram o processo secundário imediatamente, eliminando disputas no `localStorage` e colisões de porta na porta local `54321`.
- **Persistência Offline (*Stale-While-Revalidate*)**: Integrados `@tanstack/react-query-persist-client` e `@tanstack/query-sync-storage-persister` em `src/App.tsx`. O app armazena todas as queries de saldo, transações, faturas e orçamentos no `localStorage` com TTL de 24h. Na ausência de sinal de internet (ou modo avião), o app inicializa instantaneamente em modo leitura sem telas em branco.
- **Auto-Healing de WebSocket & Monitor de Rede**: Implementado em `src/hooks/useRealtimeSync.tsx`. Escuta eventos de status do canal (`SUBSCRIBED`, `TIMED_OUT`, `CHANNEL_ERROR`, `CLOSED`) com tentativa exponencial de reconexão. Ao detectar o retorno da conectividade via ouvinte `online` do navegador, invalida automaticamente todas as queries do cache, forçando a reconciliação transparente de dados entre Desktop e Mobile.
- **Pílula de Sincronização em Tempo Real (`SyncStatusPill`)**: Exibida no cabeçalho de todas as telas em `src/components/AppLayout.tsx`:
  - 🟢 **Sincronizado** (Ponto pulsante verde indicando canal WebSocket ativo com Supabase)
  - 🟡 **Reconectando** (Ícone rotativo indicando recuperação de conexão)
  - ⚪ **Offline** (Aviso de operação sobre cache local persistido, com clique para forçar sincronização)

### 2. Autopreenchimento Inteligente de Comprovantes por IA (OCR + Auto-Fill)
- **Fluxo Integrado no Formulário de Transações** (`src/pages/Transactions.tsx`):
  - Ao anexar uma foto ou PDF no campo de comprovante fiscal, o sistema executa simultaneamente:
    1. Upload seguro para o bucket `receipts` no Supabase Storage via `src/services/receiptService.ts`.
    2. Conversão e envio do arquivo para a Edge Function `parse-transaction`.
  - A IA extrai e preenche automaticamente os campos: **Descrição**, **Valor (R$)**, **Data** e **Categoria**.
  - **Feedback Visual com Destaque**: Cada campo identificado recebe um badge visual sutil `✨ IA`, permitindo que o usuário identifique os campos preenchidos, ajuste qualquer detalhe e salve com 1 clique.

### 3. Lançamento Global Rápido por Voz (Audio-to-Transaction)
- **Componente Autoral `src/components/GlobalVoiceInput.tsx`**:
  - Disponibiliza entrada por voz no Header do Desktop e como Floating Action Button (FAB) no Mobile.
  - Transcrição em tempo real em português brasileiro via Web Speech API (`pt-BR`).
  - Interpretação semântica de frases complexas como *"Almoço 45 reais no débito hoje"* via IA.
  - Exibição de modal rápido de revisão e confirmação da transação com inserção direta no banco e atualização automática de saldos.
- **Permissões Nativas no Android**: Adicionadas `android.permission.RECORD_AUDIO`, `android.permission.MODIFY_AUDIO_SETTINGS` e `android.permission.CAMERA` em `android/app/src/main/AndroidManifest.xml` e sincronizadas via Capacitor.

### 4. Evolução do Consultor Financeiro (AI Consultant v2)
- **Contexto Patrimonial Expandido**:
  - Injeção de dívidas e faturas abertas de cartão de crédito (`totalCardDebt`), taxa de queima líquida mensal (`burnRateMonths`) e categorias com maior consumo (`topExpenseCategories`) em `src/components/dashboard/AIConsultantDialog.tsx` e `src/pages/Dashboard.tsx`.
- **Especialidades de Engenharia Financeira** em `supabase/functions/ai-consultant/index.ts`:
  - 📉 **Plano de Quitação de Dívidas**: Comparativo entre os métodos Bola de Neve e Avalanche, com projeção de economia de juros e cronograma mês a mês.
  - 💰 **Simulação de Aportes Mensais**: Alocação equilibrada entre Reserva de Emergência, Renda Fixa e Criptoativos.
  - ⚖️ **Rebalanceamento Patrimonial**: Ajustes de concentração fiduciária vs cripto e limites de exposição em ETH.
  - 🎯 **Independência Financeira**: Estimativa temporal via Regra dos 4% baseada no custo de vida real do usuário.
- **Gerenciamento Seguro de Chaves (Arquitetura Híbrida / BYOK)**:
  - Seção aprimorada em `src/pages/Settings.tsx` com seletor de provedor (Gemini gratuito, Groq, OpenAI, OpenRouter), badge de status (`Nuvem Padronizada` vs `BYOK Ativo`) e botão de restauração rápida para as credenciais padrão do servidor.

---

## 🎯 Binários e Pacotes Gerados

| Arquivo / Pacote | Tipo | Tamanho | Caminho Absoluto |
|---|---|---|---|
| ⚡ **`FinMaster.exe`** | Executável Standalone Desktop (x64) | **234,68 MB** (246.085.120 bytes) | `D:\Projetos\1.Autorais\FinMaster\release\win-unpacked\FinMaster.exe` |
| 🗜️ **`FinMaster-v1.1.0-win-x64.zip`** | Pacote Portátil Compactado (ZIP) | **152,28 MB** (159.680.671 bytes) | `D:\Projetos\1.Autorais\FinMaster\release\FinMaster-v1.1.0-win-x64.zip` |
| 📱 **Projeto Android Nativo** | Estrutura Gradle & Capacitor Sync | — | `D:\Projetos\1.Autorais\FinMaster\android\` |

---

## 🔒 Hashes de Integridade Criptográfica (SHA-256)

```
Arquivo: release\win-unpacked\FinMaster.exe
SHA-256: E20242D6BC869539499648438CCA0A9B6070BAC0B8CE36B37DE98FBFA8D5919C

Arquivo: release\FinMaster-v1.1.0-win-x64.zip
SHA-256: 16AF0BD6E625FBEB3E2FAE72B5264BB6E863C6A0AE2BF3AB4E661F213A947AAD
```

---

## 🧪 Validação e Testes Automatizados

- **Suíte de Testes Vitest**: **14/14 testes aprovados** com código de saída 0:
  - `src/test/example.test.ts` (1 teste aprovado)
  - `src/test/invoices.test.ts` (9 testes aprovados)
  - `src/test/resilience-and-ai.test.ts` (4 testes aprovados)
- **Compilação de Produção Vite**: Tempo total de **12.19s** (3.647 módulos transformados sem erros).
