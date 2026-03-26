import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type RagChunkRow = {
  chunk_type: "preamble" | "article";
  content: string;
  metadata: Record<string, unknown>;
};

type ConstitutionPreviewFile = RagChunkRow[];

const TITLE = "Constitution of the Tunisian Republic (2014, English translation)";
const JURISDICTION = "Tunisia";

// Keep batch size modest to reduce request size risks.
const BATCH_SIZE = 50;

async function main(): Promise<void> {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const ingestionDir = fileURLToPath(new URL(".", import.meta.url));
  const previewJsonPath = join(ingestionDir, "constitution_chunks.preview.json");

  const previewText = await readFile(previewJsonPath, "utf8");
  const chunks: ConstitutionPreviewFile = JSON.parse(previewText);

  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error(
      `Invalid preview file: expected a non-empty JSON array at ${previewJsonPath}`
    );
  }

  console.log(`Loaded ${chunks.length} parsed chunks from preview JSON.`);

  const documentId = await upsertRagDocumentByTitle({
    supabaseUrl,
    serviceRoleKey,
    title: TITLE,
    jurisdiction: JURISDICTION,
  });

  console.log(`Using rag_documents id: ${documentId}`);

  const deleted = await deleteOldRagChunks({
    supabaseUrl,
    serviceRoleKey,
    documentId,
  });
  console.log(`Deleted ${deleted} old rag_chunks for this document (rerun-safe).`);

  await insertRagChunksInBatches({
    supabaseUrl,
    serviceRoleKey,
    documentId,
    chunks,
  });

  console.log("Load completed successfully (no embeddings added).");
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function supabaseFetchJson(
  args: {
    supabaseUrl: string;
    serviceRoleKey: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    query?: string;
    body?: unknown;
    prefer?: string;
  }
): Promise<{ json: unknown; contentRange?: string | null }> {
  const base = args.supabaseUrl.replace(/\/+$/, "");
  const url = `${base}${args.path}${args.query ? `?${args.query}` : ""}`;

  const headers: Record<string, string> = {
    apikey: args.serviceRoleKey,
    Authorization: `Bearer ${args.serviceRoleKey}`,
    Accept: "application/json",
  };

  if (args.prefer) {
    headers["Prefer"] = args.prefer;
  }

  if (args.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: args.method,
    headers,
    body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Supabase REST request failed: ${res.status} ${res.statusText}\nURL: ${url}\nResponse: ${text}`
    );
  }

  const json = (await res.json().catch(() => null)) as unknown;
  return {
    json,
    contentRange: res.headers.get("content-range"),
  };
}

function encodeEq(value: string): string {
  // PostgREST values must be URI encoded inside the "eq." expression.
  return encodeURIComponent(value);
}

async function upsertRagDocumentByTitle(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  title: string;
  jurisdiction: string;
}): Promise<string> {
  // 1) Try to find an existing row by title.
  const selectQuery = `title=eq.${encodeEq(args.title)}&select=id,title&limit=1`;
  const existing = await supabaseFetchJson({
    supabaseUrl: args.supabaseUrl,
    serviceRoleKey: args.serviceRoleKey,
    method: "GET",
    path: "/rest/v1/rag_documents",
    query: selectQuery,
  });

  const rows = (existing.json ?? []) as Array<{ id?: string }>;
  const existingId = rows?.[0]?.id;
  if (existingId) return existingId;

  // 2) Insert a new document row. We only set columns that are known in schema.
  // Title is NOT NULL; jurisdiction is nullable but included for correctness.
  const insertBody = {
    title: args.title,
    jurisdiction: args.jurisdiction,
  };

  const inserted = await supabaseFetchJson({
    supabaseUrl: args.supabaseUrl,
    serviceRoleKey: args.serviceRoleKey,
    method: "POST",
    path: "/rest/v1/rag_documents",
    query: "select=id",
    body: insertBody,
    prefer: "return=representation",
  });

  const insertedRows = (inserted.json ?? []) as Array<{ id?: string }>;
  const insertedId = insertedRows?.[0]?.id;
  if (!insertedId) {
    throw new Error("Failed to create rag_documents row (no id returned).");
  }

  return insertedId;
}

async function deleteOldRagChunks(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  documentId: string;
}): Promise<number> {
  // Delete by document_id so reruns are safe.
  const query = `document_id=eq.${args.documentId}&select=id`;

  const deleted = await supabaseFetchJson({
    supabaseUrl: args.supabaseUrl,
    serviceRoleKey: args.serviceRoleKey,
    method: "DELETE",
    path: "/rest/v1/rag_chunks",
    query,
    prefer: "return=representation",
  });

  const rows = (deleted.json ?? []) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function insertRagChunksInBatches(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  documentId: string;
  chunks: ConstitutionPreviewFile;
}): Promise<void> {
  // Build DB rows expected by rag_chunks.
  const rows = args.chunks.map((chunk, i) => {
    return {
      document_id: args.documentId,
      chunk_index: i, // keep deterministic order: matches preview array order
      content: chunk.content,
      // Embedding intentionally NULL for this first safe step.
      embedding: null,
      metadata: chunk.metadata,
    };
  });

  const total = rows.length;
  const numBatches = Math.ceil(total / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < numBatches; batchIndex += 1) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, total);
    const batch = rows.slice(start, end);

    console.log(
      `Inserting batch ${batchIndex + 1}/${numBatches} (chunk_index ${start}..${end - 1})`
    );

    await supabaseFetchJson({
      supabaseUrl: args.supabaseUrl,
      serviceRoleKey: args.serviceRoleKey,
      method: "POST",
      path: "/rest/v1/rag_chunks",
      query: "select=chunk_index",
      body: batch,
      prefer: "return=minimal",
    });
  }
}

main().catch((err: unknown) => {
  console.error("Load failed.");
  console.error(err);
  process.exit(1);
});

