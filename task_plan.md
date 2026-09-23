# Task Plan — FinMaster Multiplataforma Independente

## Backlog Atômico

- [x] **Sprint 1: Desacoplamento da Lovable & Otimização do Vite**
  - [x] Remover `lovable-tagger` de `package.json` e `vite.config.ts`.
  - [x] Adicionar `base: './'` e `rollupOptions.output.manualChunks` em `vite.config.ts`.
  - [x] Higienizar meta tags, canonicals e referências Lovable em `index.html`, `Auth.tsx`, `Install.tsx` e `Trust.tsx`.
  - [x] Validar build estático limpo (`npm run build`).

- [x] **Sprint 2: Roteamento Híbrido & Autenticação Multiplataforma**
  - [x] Migrar de `BrowserRouter` para `HashRouter` em `src/App.tsx`.
  - [x] Implementar `src/services/authService.ts` com suporte unificado a Google OAuth (Electron loopback + Capacitor deep link + Web).
  - [x] Integrar botão "Continuar com o Google" em `src/pages/Auth.tsx`.
  - [x] Adicionar `NativeDeepLinkHandler` em `src/App.tsx` para interceptar retornos OAuth no Android.

- [x] **Sprint 3: Camada Desktop (.exe via Electron)**
  - [x] Adicionar dependências `electron` e `electron-builder` em `package.json`.
  - [x] Criar `electron/main.cjs` com gerenciamento de janelas, CORS headers e servidor loopback na porta 54321.
  - [x] Criar `electron/preload.cjs` com context isolation e bridge segura `electronAPI`.
  - [x] Configurar scripts e metadata de build no `package.json`.
  - [x] Compilar `FinMaster.exe` x64 e calcular integridade SHA-256.

- [x] **Sprint 4: Camada Mobile (Android via Capacitor)**
  - [x] Adicionar dependências `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`, `@capacitor/browser`.
  - [x] Criar `capacitor.config.ts` (`appId: com.autorais.finmaster`).
  - [x] Inicializar projeto Android (`npx cap add android`) e sincronizar (`npm run android:sync`).
  - [x] Injetar deep link intent-filter em `android/app/src/main/AndroidManifest.xml`.

- [x] **Sprint 5: Sincronização Realtime & Persistência de Comprovantes**
  - [x] Criar hook `useRealtimeSync` com Supabase Realtime nas tabelas `transactions`, `accounts`, `credit_cards` e `categories`.
  - [x] Criar script/migração SQL `supabase_security_setup.sql` para coluna `receipt_url` e bucket `receipts`.
  - [x] Criar `src/services/receiptService.ts` e integrar upload e botão de comprovante na listagem de transações.

- [x] **Sprint 6: Validação, DoD & Registro de Bordo**
  - [x] Executar suite de testes (`npm run test` com 10/10 aprovados).
  - [x] Validar integridade física dos executáveis no disco.
  - [x] Gerar `relatorio_versao_final_exe.md`.
  - [x] Gravar entrada no `04_Logbook/Logbook.md` do Obsidian Vault.
