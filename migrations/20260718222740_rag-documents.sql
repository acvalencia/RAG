CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  match_threshold DOUBLE PRECISION DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  source TEXT,
  score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    public.documents.id,
    public.documents.content,
    public.documents.source,
    1 - (public.documents.embedding <=> query_embedding) AS score
  FROM public.documents
  WHERE 1 - (public.documents.embedding <=> query_embedding) >= match_threshold
  ORDER BY public.documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_documents(vector, INTEGER, DOUBLE PRECISION)
TO anon, authenticated;

CREATE INDEX IF NOT EXISTS documents_source_idx
ON public.documents (source);

CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
ON public.documents
USING hnsw (embedding vector_cosine_ops);
