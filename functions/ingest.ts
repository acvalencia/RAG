// Edge function: ingest
// Receives raw text, splits it into ~500-token chunks with overlap, generates
// embeddings with text-embedding-3-small through the OpenRouter Model Gateway,
// and inserts one row per chunk into public.documents.
import { createAdminClient } from 'npm:@insforge/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const EMBEDDING_MODEL =
  Deno.env.get('OPENROUTER_EMBEDDING_MODEL') ?? 'openai/text-embedding-3-small';

// ~4 characters per token is a good approximation for English/Spanish prose.
const CHARS_PER_TOKEN = 4;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));

// Split text into word-boundary chunks of ~targetTokens with ~overlapTokens of
// shared context between consecutive chunks.
function chunkText(
  text: string,
  targetTokens = 500,
  overlapTokens = 50,
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const words = normalized.split(' ');
  const maxChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const word of words) {
    const addLen = word.length + (current.length ? 1 : 0);
    if (currentLen + addLen > maxChars && current.length > 0) {
      chunks.push(current.join(' '));
      // Seed the next chunk with the tail of the current one for overlap.
      const overlap: string[] = [];
      let olen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const w = current[i];
        const wl = w.length + (overlap.length ? 1 : 0);
        if (olen + wl > overlapChars) break;
        overlap.unshift(w);
        olen += wl;
      }
      current = overlap;
      currentLen = olen;
    }
    current.push(word);
    currentLen += addLen;
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
}

// Call the OpenRouter embeddings endpoint for a batch of inputs.
async function embedBatch(inputs: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter embeddings failed (${res.status}): ${detail}`);
  }

  const payload = await res.json();
  // Preserve input order; OpenRouter returns items with an `index` field.
  return payload.data
    .slice()
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
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

  let body: { text?: string; source?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const source =
    typeof body.source === 'string' && body.source.trim()
      ? body.source.trim()
      : 'untitled';
  const metadata = body.metadata ?? {};

  if (!text) {
    return json({ error: 'Field "text" is required and must be non-empty.' }, 400);
  }

  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return json({ error: 'No chunks produced from the provided text.' }, 400);
    }

    const embeddings = await embedBatch(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Embedding count (${embeddings.length}) != chunk count (${chunks.length}).`,
      );
    }

    const insforge = createAdminClient({ baseUrl, apiKey: adminKey });

    const rows = chunks.map((content, i) => ({
      content,
      source,
      // pgvector's text input form is "[v1,v2,...]"; PostgREST casts text -> vector.
      embedding: JSON.stringify(embeddings[i]),
      embedding_model: EMBEDDING_MODEL,
      chunk_index: i,
      token_count: estimateTokens(content),
      metadata,
    }));

    const { data, error } = await insforge.database
      .from('documents')
      .insert(rows)
      .select('id, source, chunk_index, token_count');

    if (error) {
      return json({ error: 'Database insert failed', detail: error }, 500);
    }

    return json({
      source,
      chunks_inserted: data?.length ?? rows.length,
      embedding_model: EMBEDDING_MODEL,
      chunks: (data ?? []).map(
        (r: { id: number; chunk_index: number; token_count: number }) => ({
          id: r.id,
          chunk_index: r.chunk_index,
          token_count: r.token_count,
        }),
      ),
    });
  } catch (err) {
    return json({ error: 'Ingestion failed', detail: String(err) }, 500);
  }
}
