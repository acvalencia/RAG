// Edge function: documents
// Lists the knowledge base grouped by source (one entry per ingested file),
// with chunk count, total tokens and last ingestion time. Read-only.
import { createAdminClient } from 'npm:@insforge/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

type Row = { source: string; token_count: number | null; created_at: string };

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed. Use GET.' }, 405);
  }

  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  const adminKey = Deno.env.get('API_KEY');
  if (!baseUrl || !adminKey) {
    return json({ error: 'Missing server configuration' }, 500);
  }

  try {
    const insforge = createAdminClient({ baseUrl, apiKey: adminKey });
    const { data, error } = await insforge.database
      .from('documents')
      .select('source, token_count, created_at')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      return json({ error: 'Database read failed', detail: error }, 500);
    }

    // Group chunk rows into one entry per source.
    const bySource = new Map<
      string,
      { source: string; chunks: number; tokens: number; last_ingested: string }
    >();
    for (const row of (data ?? []) as Row[]) {
      const entry = bySource.get(row.source) ?? {
        source: row.source,
        chunks: 0,
        tokens: 0,
        last_ingested: row.created_at,
      };
      entry.chunks += 1;
      entry.tokens += row.token_count ?? 0;
      if (row.created_at > entry.last_ingested) entry.last_ingested = row.created_at;
      bySource.set(row.source, entry);
    }

    const documents = [...bySource.values()].sort((a, b) =>
      a.last_ingested < b.last_ingested ? 1 : -1,
    );

    return json({
      documents,
      total_documents: documents.length,
      total_chunks: documents.reduce((sum, d) => sum + d.chunks, 0),
    });
  } catch (err) {
    return json({ error: 'List failed', detail: String(err) }, 500);
  }
}
