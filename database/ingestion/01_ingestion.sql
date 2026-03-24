alter table public.rag_documents
  add column if not exists source_type text
    check (source_type in ('pdf','image','url','blog','text')),
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists original_language text,
  add column if not exists detected_language text,
  add column if not exists extraction_status text not null default 'pending'
    check (extraction_status in ('pending','processing','done','failed')),
  add column if not exists extraction_error text,
  add column if not exists extracted_text text,
  add column if not exists normalized_text text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_rag_documents_status
  on public.rag_documents (extraction_status, created_at desc);

  insert into public.rag_documents (
  title,
  source_type,
  storage_bucket,
  storage_path,
  mime_type,
  original_language,
  detected_language,
  jurisdiction,
  published_date,
  extraction_status,
  metadata
)
values (
  'Constitution of the Tunisian Republic (2014, English translation)',
  'pdf',
  'legal-sources',
  'laws/tunisia/constitution/2014_constitution_en_undp_idea.pdf',
  'application/pdf',
  'en',
  'en',
  'Tunisia',
  '2014-01-26',
  'pending',
  jsonb_build_object(
    'country', 'Tunisia',
    'document_kind', 'constitution',
    'is_translation', true,
    'officiality', 'unofficial translation',
    'prepared_by', 'UNDP',
    'reviewed_by', 'International IDEA',
    'structure', 'preamble_titles_articles',
    'article_count', 149
  )
);