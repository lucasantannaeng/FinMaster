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

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Imagem obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof imageBase64 !== "string" || imageBase64.length > 10_000_000) {
      return new Response(JSON.stringify({ error: "Arquivo muito grande (máx ~7MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
    const safeMime = typeof mimeType === "string" && ALLOWED_MIME.includes(mimeType) ? mimeType : "image/jpeg";

    // AI provider is orchestrated by _shared/ai-fallback (OpenRouter → Groq vision).


    const systemPrompt = `Você é um sistema OCR especializado em extrair dados de recibos, notas fiscais e comprovantes brasileiros.

Extraia os seguintes dados da imagem:
- cnpj_cpf: CNPJ ou CPF do prestador/emissor
- nome_prestador: Nome do prestador/empresa
- valor: Valor total (número)
- data: Data do documento (formato YYYY-MM-DD)
- descricao: Descrição do serviço/produto
- categoria_sugerida: saude, educacao, alimentacao, transporte, moradia, lazer, outros
- is_deductible: true/false - se é potencialmente dedutível no IR
- deduction_type: saude, educacao, previdencia, pensao, doacao ou null

Responda EXCLUSIVAMENTE em JSON válido:
{
  "cnpj_cpf": "XX.XXX.XXX/XXXX-XX",
  "nome_prestador": "Nome",
  "valor": 150.00,
  "data": "2024-03-15",
  "descricao": "Consulta médica",
  "categoria_sugerida": "saude",
  "is_deductible": true,
  "deduction_type": "saude",
  "confidence": "high|medium|low",
  "raw_text": "Texto extraído relevante do documento"
}

Se não conseguir extrair algum campo, use null. Se a imagem não for um recibo/comprovante, retorne {"error": "Imagem não reconhecida como recibo ou comprovante"}.`;

    let aiResult: any;
    try {
      aiResult = await callChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste recibo/comprovante:" },
              {
                type: "image_url",
                image_url: {
                  url: `data:${safeMime};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      });
    } catch (aiErr) {
      console.error("ocr-receipt AI failure:", aiErr);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const content = aiResult.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      parsed = { error: "Falha ao processar resposta da IA", raw: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-receipt error:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
