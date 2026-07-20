// Edge function: ask
// Receives a question, embeds it with text-embedding-3-small, retrieves the top
// matching chunks via the match_documents RPC, and asks an LLM (Model Gateway)
// to answer strictly from that context, returning the answer plus its sources.
import { createAdminClient } from 'npm:@insforge/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const EMBEDDING_MODEL =
  Deno.env.get('OPENROUTER_EMBEDDING_MODEL') ?? 'openai/text-embedding-3-small';
const CHAT_MODEL = Deno.env.get('OPENROUTER_CHAT_MODEL') ?? 'openai/gpt-4o-mini';
const FALLBACK_ANSWER = 'no tengo esa información en mis documentos';

type Match = { id: number; content: string; source: string; score: number };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function embedQuery(input: string): Promise<number[]> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter embeddings failed (${res.status}): ${await res.text()}`);
  }
  const payload = await res.json();
  return payload.data[0].embedding;
}

async function generateAnswer(question: string, context: string): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const systemPrompt = [
    'Eres un asistente que responde ÚNICAMENTE con la información contenida en el CONTEXTO proporcionado.',
    'Reglas estrictas:',
    '1. Si la respuesta está en el contexto, respóndela de forma concisa y en el mismo idioma de la pregunta.',
    `2. Si la información NO está en el contexto, responde EXACTAMENTE: "${FALLBACK_ANSWER}" y nada más.`,
    '3. No uses conocimiento externo ni inventes datos.',
    '',
    'CONTEXTO:',
    context,
  ].join('\n');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter chat failed (${res.status}): ${await res.text()}`);
  }
  const payload = await res.json();
  return payload.choices?.[0]?.message?.content?.trim() || FALLBACK_ANSWER;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  const adminKey = Deno.env.get('API_KEY');
  if (!baseUrl || !adminKey || !Deno.env.get('OPENROUTER_API_KEY')) {
    return json({ error: 'Missing server configuration' }, 500);
  }

  let body: { question?: string; match_count?: number; match_threshold?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return json({ error: 'Field "question" is required and must be non-empty.' }, 400);
  }
  const matchCount = Number.isFinite(body.match_count) ? Number(body.match_count) : 5;
  const matchThreshold = Number.isFinite(body.match_threshold)
    ? Number(body.match_threshold)
    : 0;

  try {
    const embedding = await embedQuery(question);

    const insforge = createAdminClient({ baseUrl, apiKey: adminKey });
    const { data, error } = await insforge.database.rpc('match_documents', {
      // Pass the pgvector text literal so PostgREST casts text -> vector.
      query_embedding: JSON.stringify(embedding),
      match_count: matchCount,
      match_threshold: matchThreshold,
    });

    if (error) {
      return json({ error: 'Vector search failed', detail: error }, 500);
    }

    const matches = (data ?? []) as Match[];
    if (matches.length === 0) {
      return json({ answer: FALLBACK_ANSWER, sources: [], matches: [] });
    }

    const context = matches
      .map((m, i) => `[${i + 1}] (fuente: ${m.source})\n${m.content}`)
      .join('\n\n');

    const answer = await generateAnswer(question, context);

    return json({
      answer,
      // De-duplicated list of source names used to build the context.
      sources: [...new Set(matches.map((m) => m.source))],
      matches: matches.map((m) => ({
        id: m.id,
        source: m.source,
        score: Number(m.score.toFixed(4)),
        preview: m.content.slice(0, 160),
      })),
      models: { embedding: EMBEDDING_MODEL, chat: CHAT_MODEL },
    });
  } catch (err) {
    return json({ error: 'Ask failed', detail: String(err) }, 500);
  }
}
