# Findings — Descobertas Técnicas e Arquitetura FinMaster

## 1. Estado Inicial do Projeto
- Projeto 100% funcional com build Vite em 33s e 10/10 testes passando no Vitest.
- Supabase já está em instância proprietária (`peiwulcxpihozgcmbgua.supabase.co`).
- Todas as 7 Edge Functions já rodam no Deno com `ai-fallback.ts` (OpenRouter Gemini 2.5 Flash + Groq Llama 3.3/3.2 Vision). O gateway da Lovable já foi desativado no backend.

## 2. Padrão SolarCAD para Desktop & Mobile
- **Desktop**: Electron com `preload.cjs` expondo `window.electronAPI.startDesktopOAuth`, manipulando redirecionamento na porta 54321 via servidor HTTP loopback nativo (`http.createServer`).
- **Mobile**: Capacitor com `@capacitor/app` ouvindo evento `appUrlOpen` e disparando `supabase.auth.setSession(...)`.
- **Roteamento**: `HashRouter` no lugar de `BrowserRouter` garante compatibilidade total com carregamento via protocolo de arquivo `file://` no Electron e `capacitor://` no Android.
- **Vite Base**: `base: './'` permite que todos os scripts e assets css/js sejam referenciados de forma relativa, impedindo telas brancas no Electron.
