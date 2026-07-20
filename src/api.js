// Thin client for the RAG edge functions deployed on InsForge.
// The functions are public and reached through the API proxy path:
//   ${VITE_INSFORGE_API_URL}/functions/<slug>

const BASE = (import.meta.env.VITE_INSFORGE_API_URL || "").replace(/\/$/, "");

if (!BASE) {
  // Surface a clear message during development instead of failing on fetch.
  console.warn(
    "VITE_INSFORGE_API_URL is not set. Add it to .env.local (see .env.example).",
  );
}

const fnUrl = (slug) => `${BASE}/functions/${slug}`;

async function request(slug, { method = "POST", body } = {}) {
  let res;
  try {
    res = await fetch(fnUrl(slug), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`No se pudo conectar con el backend (${slug}): ${err.message}`);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response.
  }

  if (!res.ok) {
    const detail =
      payload?.error || payload?.detail || `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return payload;
}

// Ingest one document: chunk + embed + store. Returns { source, chunks_inserted, ... }.
export function ingestText(text, source) {
  return request("ingest", { body: { text, source } });
}

// Ask a question grounded in the knowledge base.
// Returns { answer, sources, matches, models }.
export function askQuestion(question, options = {}) {
  return request("ask", { body: { question, ...options } });
}

// List the knowledge base grouped by source.
// Returns { documents: [{ source, chunks, tokens, last_ingested }], ... }.
export function listDocuments() {
  return request("documents", { method: "GET" });
}
