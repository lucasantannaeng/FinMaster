import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callChatCompletion } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawYear = (body as any).year;
    const parsedYear = typeof rawYear === "number" ? rawYear : parseInt(String(rawYear ?? ""), 10);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      return new Response(JSON.stringify({ error: "Ano inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const year = parsedYear;

    // Fetch transactions + categories
    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions")
        .select("id, description, amount, date, type, category_id, is_paid")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`)
        .order("date", { ascending: true }),
      supabase.from("categories").select("id, name, type"),
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

    if (transactions.length === 0) {
      return new Response(JSON.stringify({ deductions: [], alerts: [], summary: "Nenhuma transação encontrada no período." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare compact transaction list for AI
    const txList = transactions.map((tx: any) => ({
      id: tx.id,
      desc: tx.description,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      category: catMap.get(tx.category_id) || "Sem categoria",
    }));

    // AI provider is orchestrated by _shared/ai-fallback (OpenRouter → Groq).


    const systemPrompt = `Você é um especialista em Imposto de Renda brasileiro. Analise as transações e identifique:

1. DESPESAS DEDUTÍVEIS: saúde (médicos, dentistas, hospitais, exames, terapias, psicólogos), educação (escolas, faculdades, cursos regulares), previdência privada (PGBL), pensão alimentícia, doações incentivadas.

2. ALERTAS: transações que PARECEM dedutíveis mas precisam de confirmação do usuário.

Regras da Receita Federal:
- Saúde: sem limite de dedução, mas precisa de recibo com CPF/CNPJ
- Educação: limite de R$ 3.561,50 por dependente/titular (2024)
- PGBL: limite de 12% da renda bruta tributável
- Plano de saúde pago pelo empregador NÃO é dedutível
- Medicamentos comprados em farmácia NÃO são dedutíveis (exceto se na nota do hospital)

Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "deductions": [
    {
      "transaction_id": "uuid",
      "description": "descrição da transação",
      "amount": 123.45,
      "date": "2024-01-15",
      "category_rf": "saude|educacao|previdencia|pensao|doacao",
      "confidence": "high|medium|low",
      "rf_description": "Descrição formatada para o programa da Receita Federal"
    }
  ],
  "alerts": [
    {
      "transaction_id": "uuid",
      "description": "descrição",
      "amount": 123.45,
      "reason": "Motivo pelo qual pode ser dedutível"
    }
  ],
  "summary": "Resumo textual das deduções encontradas com totais por categoria"
}`;

    let aiResult: any;
    try {
      aiResult = await callChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Ano-calendário: ${year}\n\nTransações (${txList.length} itens):\n${JSON.stringify(txList)}` },
        ],
        temperature: 0.1,
      });
    } catch (aiErr) {
      console.error("analyze-deductions AI failure:", aiErr);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const content = aiResult.choices?.[0]?.message?.content || "{}";
    
    // Extract JSON from response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      parsed = { deductions: [], alerts: [], summary: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-deductions error:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
