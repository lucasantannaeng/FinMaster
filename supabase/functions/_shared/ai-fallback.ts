// Shared AI orchestration helper.
// Primary route: OpenRouter (google/gemini-2.5-flash — multimodal).
// Fallback route: Groq — llama-3.3-70b-versatile for text; llama-3.2-90b-vision-preview when the payload contains images.
//
// The helper preserves the caller's payload verbatim (messages, tools, tool_choice,
// response_format, temperature, etc.) and only rewrites the `model` field to match
// the route being used. Callers keep their existing system prompts and JSON contracts.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const OPENROUTER_MODEL = "google/gemini-2.5-flash";
const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = "llama-3.2-90b-vision-preview";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface ChatPayload {
  messages: any[];
  tools?: any;
  tool_choice?: any;
  response_format?: any;
  temperature?: number;
  stream?: boolean;
  // `model` is intentionally omitted from the required shape — the helper injects the correct one per route.
  [key: string]: unknown;
}

/** Detect whether any message carries a multimodal image block. */
function payloadHasImages(payload: ChatPayload): boolean {
  if (!Array.isArray(payload.messages)) return false;
  for (const msg of payload.messages) {
    const content = (msg as any)?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === "object" && (part as any).type === "image_url") {
          return true;
        }
      }
    }
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildInit(apiKey: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

async function readErrorSnippet(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 300);
  } catch {
    return "";
  }
}

/**
 * Non-streaming chat completion with OpenRouter -> Groq fallback.
 * Returns the parsed JSON body (OpenAI-compatible shape) from whichever provider succeeded.
 */
export async function callChatCompletion(
  payload: ChatPayload,
  opts: { timeoutMs?: number } = {},
): Promise<any> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");

  // --- Primary: OpenRouter (multimodal-capable) ---
  try {
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY não configurada");
    const body = { ...payload, model: OPENROUTER_MODEL };
    const res = await fetchWithTimeout(OPENROUTER_URL, buildInit(openrouterKey, body), timeoutMs);
    if (!res.ok) {
      const snippet = await readErrorSnippet(res);
      throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}`);
    }
    return await res.json();
  } catch (primaryErr) {
    const reason = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(`OpenRouter falhou (${reason}), acionando Groq...`);

    // --- Fallback: Groq. Vision-capable model when the payload contains images. ---
    if (!groqKey) {
      console.error("Groq indisponível: GROQ_API_KEY não configurada");
      throw new Error("AI upstream failure: both providers unavailable");
    }
    const groqModel = payloadHasImages(payload) ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;
    const body = { ...payload, model: groqModel };
    const res = await fetchWithTimeout(GROQ_URL, buildInit(groqKey, body), timeoutMs);
    if (!res.ok) {
      const snippet = await readErrorSnippet(res);
      console.error(`Groq também falhou (Status ${res.status})${snippet ? ` — ${snippet}` : ""}`);
      throw new Error(`AI upstream failure (${res.status})`);
    }
    return await res.json();
  }
}

/**
 * Streaming variant. Returns the raw `Response` whose body is an SSE stream in
 * OpenAI-compatible format. Falls back to Groq only if the primary provider
 * fails BEFORE returning a 200 (network error, timeout, non-2xx status). Once
 * OpenRouter starts streaming, individual chunk failures propagate to the caller.
 */
export async function callChatCompletionStream(
  payload: ChatPayload,
  opts: { timeoutMs?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");

  const streamingPayload: ChatPayload = { ...payload, stream: true };

  try {
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY não configurada");
    const body = { ...streamingPayload, model: OPENROUTER_MODEL };
    const res = await fetchWithTimeout(
      OPENROUTER_URL,
      buildInit(openrouterKey, body),
      timeoutMs,
    );
    if (!res.ok) {
      const snippet = await readErrorSnippet(res);
      throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}`);
    }
    return res;
  } catch (primaryErr) {
    const reason = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(`OpenRouter (stream) falhou (${reason}), acionando Groq...`);

    if (!groqKey) {
      console.error("Groq indisponível: GROQ_API_KEY não configurada");
      throw new Error("AI upstream failure: both providers unavailable");
    }
    const groqModel = payloadHasImages(streamingPayload) ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;
    const body = { ...streamingPayload, model: groqModel };
    const res = await fetchWithTimeout(GROQ_URL, buildInit(groqKey, body), timeoutMs);
    if (!res.ok) {
      const snippet = await readErrorSnippet(res);
      console.error(`Groq (stream) também falhou (Status ${res.status})${snippet ? ` — ${snippet}` : ""}`);
      throw new Error(`AI upstream failure (${res.status})`);
    }
    return res;
  }
}
