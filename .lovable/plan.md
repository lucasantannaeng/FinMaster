# Plano aprovado: Fallback OpenRouter → Groq nas 6 Edge Functions

Escopo, streaming, secrets e regra de visão confirmados. Executo abaixo em modo build.

## 1. Novo helper — `supabase/functions/_shared/ai-fallback.ts`

Exporta duas APIs OpenAI-compatíveis:

- `callChatCompletion(payload, opts?)` → JSON (não-streaming).
- `callChatCompletionStream(payload, opts?)` → `Response` com body SSE.

Regras internas:
- **Primária:** `POST https://openrouter.ai/api/v1/chat/completions`, header `Authorization: Bearer ${OPENROUTER_API_KEY}`, `model: "google/gemini-2.5-flash"`.
- **Fallback:** `POST https://api.groq.com/openai/v1/chat/completions`, header `Authorization: Bearer ${GROQ_API_KEY}`.
- **Seleção dinâmica de modelo no Groq (regra de visão):** helper varre `payload.messages[].content[]` procurando qualquer bloco `{ type: "image_url" }`. Se encontrar → `llama-3.2-90b-vision-preview`. Caso contrário → `llama-3.3-70b-versatile`.
- **Timeout:** `AbortController` com 30 s por rota (cobre "falha de rede ou timeout").
- **`try/catch` duplo:** primário lança em status ≠ 2xx, erro de rede ou timeout; `catch` chama Groq. Se Groq também falhar, lança `AI upstream failure (<status>)` para o handler da função converter em resposta 500 padrão.
- **Auditoria silenciosa:** `console.warn("OpenRouter falhou (<motivo>), acionando Groq...")` no momento do fallback; `console.error(...)` só quando ambos falham.
- **Preservação de contrato:** o payload do chamador é repassado intacto (messages, tools, tool_choice, response_format, temperature, stream). O helper apenas injeta/sobrescreve o campo `model` conforme a rota.
- Nenhuma dependência nova; usa `fetch` + `AbortController` nativos do Deno.

## 2. Refatoração das 6 Edge Functions

Para cada arquivo: remover uso de `LOVABLE_API_KEY` + `fetch("https://ai.gateway.lovable.dev/...")` e substituir por `callChatCompletion(...)` (ou `callChatCompletionStream` no caso do `ai-consultant`). Erros 429/402 do gateway antigo deixam de existir; se ambas as rotas falharem, retorna 500 genérico `"Erro ao processar com IA"` (não muda o shape do erro para o frontend).

Arquivos e chamadas específicas:

| Arquivo | Uso |
|---|---|
| `supabase/functions/parse-transaction/index.ts` | `callChatCompletion` com `tools` + `tool_choice` (tool calling preservado). Multimodal quando `imageBase64` é enviado. |
| `supabase/functions/ocr-receipt/index.ts` | `callChatCompletion` com bloco `image_url` (dispara Groq vision no fallback). |
| `supabase/functions/analyze-deductions/index.ts` | `callChatCompletion` texto puro. |
| `supabase/functions/generate-budget/index.ts` | `callChatCompletion` texto puro. |
| `supabase/functions/detect-subscriptions/index.ts` | `callChatCompletion` texto puro. |
| `supabase/functions/ai-consultant/index.ts` | `callChatCompletionStream` — retorna `response.body` como `text/event-stream` (mesmo comportamento atual). Fallback só ocorre se OpenRouter falhar antes do 200; depois do primeiro chunk, erros de stream propagam normalmente. |

## 3. Preservado explicitamente
- CORS (`APP_ORIGIN` em `parse-transaction`; `*` nas demais) — nenhuma alteração.
- System prompts, tools, `tool_choice`, `response_format`, temperaturas, formatos JSON de resposta.
- Validação Zod / sanitização / regras de auth (`getClaims` / `getUser`).
- `supabase/config.toml`.
- `LOVABLE_API_KEY` continua no cofre (não removo o secret), mas deixa de ser lido no código.

## 4. Verificação pós-deploy
1. `supabase--deploy_edge_functions` nas 6 funções.
2. `supabase--curl_edge_functions` em `parse-transaction` (texto simples) e `analyze-deductions` para confirmar shape de resposta.
3. `supabase--edge_function_logs` para checar que nenhum `console.warn` de fallback aparece no caminho feliz.

Pronto para implementar assim que você mudar para build mode.
