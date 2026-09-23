# 📦 Relatório de Release — FinMaster Desktop v1.1.0 & Mobile Android (Supabase Cloud Unificado)

**Data da Compilação:** 23/09/2026 09:30 (Horário Local)  
**Ambiente:** Windows 10/11 x64 (Electron 44.4.5, Node.js v24.12, Vite 5.4, React 18.3, Capacitor 8.5.1)  
**Autor:** Luca Rodrigues Gomes de Sant'Anna (`lucasantannaeng@gmail.com`)

---

## 🎯 Arquitetura & Melhorias Implementadas Nesta Release

### 1. Desacoplamento Total e Definitivo da Lovable
- Remoção do plugin `lovable-tagger` de `package.json` e `vite.config.ts`.
- Higienização completa de metadados, links canônicos e tags OpenGraph em `index.html`, `Auth.tsx`, `Install.tsx` e `Trust.tsx`.
- Configuração de `base: './'` no Vite, habilitando carregamento autônomo sem dependência de domínios externos ou infraestruturas proprietárias.

### 2. Roteamento Híbrido Resiliente (`HashRouter`) & Deep Linking
- Migração de `BrowserRouter` para `HashRouter` em `src/App.tsx`. Isso elimina quaisquer erros 404 ao recarregar a tela ou navegar rotas internas dentro do protocolo de arquivos locais (`file://`) no Electron e no webview do Android (`capacitor://`).
- Inclusão do `NativeDeepLinkHandler` via `@capacitor/app` e `@capacitor/browser`: escuta o esquema customizado `com.autorais.finmaster://login-callback` e processa sessões retornadas por autenticação externa de forma transparente.

### 3. Autenticação Multiplataforma (Google OAuth + Email/Senha)
- Serviço unificado `src/services/authService.ts`:
  - **No Desktop Windows (.exe)**: Inicia um servidor HTTP local efêmero na porta `54321` (`start-desktop-oauth`), abre o navegador padrão do sistema para login seguro no Google e intercepta o callback via loopback em `http://127.0.0.1:54321/callback`, injetando os tokens no Supabase com segurança.
  - **No Mobile Android**: Abre o Chrome Custom Tabs via `@capacitor/browser` e redireciona para `com.autorais.finmaster://login-callback`.
  - **Na Web**: Redirecionamento padrão para `window.location.origin`.
- Botão "Continuar com o Google" integrado visualmente na tela de login `src/pages/Auth.tsx`.

### 4. Sincronização em Tempo Real (Supabase Realtime)
- Hook `src/hooks/useRealtimeSync.ts` acoplado ao ciclo autenticado do app:
  - Assina o canal WebSocket `realtime-user-<id>` nas tabelas `transactions`, `accounts`, `credit_cards` e `categories`.
  - Ao lançar uma transação pelo celular na rua, o painel do Desktop no computador atualiza instantaneamente seus saldos, faturas e gráficos analíticos sem necessidade de pressionar F5.

### 5. Persistência e Armazenamento Seguro de Comprovantes
- Script de segurança e migração oficial `supabase_security_setup.sql`:
  - Adiciona coluna `receipt_url text` na tabela `transactions`.
  - Provisiona o bucket `receipts` no Supabase Storage com políticas de RLS isoladas por usuário (`auth.uid()`).
- Módulo `src/services/receiptService.ts`:
  - Upload automático de fotos e PDFs para `receipts/<user_id>/<timestamp>_<filename>`.
  - Visualizador direto integrado nas linhas da tabela de transações (`src/pages/Transactions.tsx`) via ícone de comprovante.

### 6. Otimização de Performance e Chunk Splitting no Vite
- Divisão inteligente de bundles pesados em `vite.config.ts`:
  - Chunk isolado para `recharts` (410 kB).
  - Chunk isolado para primitivos Radix UI (217 kB).
  - Redução drástica do chunk do Dashboard de **595 kB** para **185 kB**.
  - Tempo total de compilação reduzido de 33.6s para **16.1s** (mais de 50% de ganho de velocidade).

---

## 🎯 Binários e Pacotes Gerados

| Arquivo / Pacote | Tipo | Tamanho | Caminho Absoluto |
|---|---|---|---|
| ⚡ **`FinMaster.exe`** | Executável Standalone Desktop (x64) | **234,68 MB** | `D:\Projetos\1.Autorais\FinMaster\release\win-unpacked\FinMaster.exe` |
| 🗜️ **`FinMaster-v1.1.0-win-x64.zip`** | Pacote Portátil Compactado (ZIP) | **152,28 MB** | `D:\Projetos\1.Autorais\FinMaster\release\FinMaster-v1.1.0-win-x64.zip` |
| 📱 **Projeto Android Nativo** | Estrutura Gradle & Capacitor Sync | — | `D:\Projetos\1.Autorais\FinMaster\android\` |

---

## 🔒 Hashes de Integridade Criptográfica (SHA-256)

```
Arquivo: release\win-unpacked\FinMaster.exe
SHA-256: 43CE37FA8FA20468599831CD92D26AD6EB187E2AA52CE96B820344720F376894

Arquivo: release\FinMaster-v1.1.0-win-x64.zip
SHA-256: 452D7962C18937C16546F72E881D593BC6353D5A9B6B6BDB102BA22BD3C42A6C
```
