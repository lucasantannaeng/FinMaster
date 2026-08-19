import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "http://localhost:8080",
  "https://pocket-fin-control.lovable.app",
  Deno.env.get("APP_ORIGIN") || "",
].filter(Boolean));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isLovablePreview = /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(origin);
  const isLovableApp = /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin);

  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || isLovablePreview || isLovableApp
      ? origin
      : "https://pocket-fin-control.lovable.app",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  return crypto.subtle
    .importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, enc.encode(message)))
    .then((sig) => btoa(String.fromCharCode(...new Uint8Array(sig))));
}

async function okxRequest(path: string, apiKey: string, secretKey: string, passphrase: string) {
  const timestamp = new Date().toISOString();
  const sign = await hmacSha256Base64(secretKey, timestamp + "GET" + path);
  const res = await fetch(`https://www.okx.com${path}`, {
    headers: {
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    
    // 1. Tenta extrair credenciais do usuário do corpo da requisição ou profile
    let bodyData: any = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        bodyData = await req.json();
      }
    } catch { /* sem body */ }

    const apiKey = bodyData.apiKey || Deno.env.get(`OKX_API_KEY_${userId}`);
    const secretKey = bodyData.secretKey || Deno.env.get(`OKX_SECRET_KEY_${userId}`);
    const passphrase = bodyData.passphrase || Deno.env.get(`OKX_PASSPHRASE_${userId}`);

    if (!apiKey || !secretKey || !passphrase) {
      return new Response(
        JSON.stringify({ 
          error: "Credenciais OKX não configuradas para este usuário.", 
          requiresSetup: true,
          totalEquity: 0,
          assets: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch balance and tickers in parallel
    const [balanceData, tickersData] = await Promise.all([
      okxRequest("/api/v5/account/balance", apiKey, secretKey, passphrase),
      fetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT").then(r => r.json()),
    ]);

    if (balanceData.code !== "0") {
      return new Response(
        JSON.stringify({ error: "OKX API error", details: balanceData.msg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build ticker maps (price + 24h change)
    const tickerMap = new Map<string, { price: number; change24h: number }>();
    for (const t of tickersData.data || []) {
      if (t.instId?.endsWith("-USDT")) {
        const ccy = t.instId.replace("-USDT", "");
        const last = parseFloat(t.last || "0");
        const open24h = parseFloat(t.open24h || "0");
        const change = open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;
        tickerMap.set(ccy, { price: last, change24h: change });
      }
    }

    // BRL rate — NO static fallback; hard-fail if exchange unavailable.
    let usdBrl: number | null = null;
    try {
      const fxRes = await fetch("https://www.okx.com/api/v5/market/index-tickers?instId=BRL-USD");
      const fxData = await fxRes.json();
      const fxPrice = parseFloat(fxData.data?.[0]?.idxPx || "0");
      if (fxPrice > 0) usdBrl = 1 / fxPrice;
    } catch { /* handled below */ }

    if (!usdBrl || !isFinite(usdBrl) || usdBrl <= 0) {
      return new Response(
        JSON.stringify({ error: "Câmbio indisponível no momento. Tente novamente." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountData = balanceData.data?.[0];
    const totalEq = parseFloat(accountData?.totalEq || "0");

    const assets = (accountData?.details || [])
      .map((d: any) => {
        const equity = parseFloat(d.eq || "0");
        const ticker = tickerMap.get(d.ccy);
        return {
          currency: d.ccy,
          equity,
          availableBalance: parseFloat(d.availBal || "0"),
          priceUsdt: ticker?.price ?? (d.ccy === "USDT" ? 1 : 0),
          change24h: ticker?.change24h ?? 0,
          valueBrl: equity * (ticker?.price ?? (d.ccy === "USDT" ? 1 : 0)) * usdBrl,
        };
      })
      .filter((a: any) => a.equity > 0)
      .sort((a: any, b: any) => (b.equity * b.priceUsdt) - (a.equity * a.priceUsdt));

    return new Response(
      JSON.stringify({ totalEquity: totalEq, assets, usdBrl, totalBrl: totalEq * usdBrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
