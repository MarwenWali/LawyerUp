-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the legal_knowledge table
create table if not exists public.legal_knowledge (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb,
  embedding vector(768)
);

-- Enable Row Level Security (RLS)
alter table public.legal_knowledge enable row level security;

-- Create a policy that allows authenticated users to read the legal documents
create policy "Allow read access for authenticated users"
  on public.legal_knowledge
  for select
  to authenticated
  using (true);

-- Create an HNSW index for faster similarity searches using cosine distance
create index if not exists legal_knowledge_embedding_idx 
  on public.legal_knowledge 
  using hnsw (embedding vector_cosine_ops);

-- Create the match_legal_docs RPC function
create or replace function public.match_legal_docs (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    legal_knowledge.id,
    legal_knowledge.content,
    legal_knowledge.metadata,
    1 - (legal_knowledge.embedding <=> query_embedding) as similarity
  from public.legal_knowledge
  where 1 - (legal_knowledge.embedding <=> query_embedding) > match_threshold
  order by legal_knowledge.embedding <=> query_embedding
  limit match_count;
$$;
