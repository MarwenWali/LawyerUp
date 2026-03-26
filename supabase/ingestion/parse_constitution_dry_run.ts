import { access, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildParseDebugSummary, parseConstitutionPdf } from "./constitutionPdfParser";

/**
 * Dry-run parser test:
 * - Reads the Tunisian Constitution PDF (single file)
 * - Parses into preamble + Article 1..149 chunks
 * - Prints debug summary
 * - Writes preview JSON (no DB writes, no embeddings)
 */
async function main(): Promise<void> {
  const ingestionDir = fileURLToPath(new URL(".", import.meta.url));
  const previewOutputPath = join(ingestionDir, "constitution_chunks.preview.json");

  const pdfPath = await findPdfPath(ingestionDir);
  console.log(`Using PDF: ${pdfPath}`);

  const chunks = await parseConstitutionPdf(pdfPath);
  const debug = buildParseDebugSummary(chunks);

  const articleNumbers = chunks
    .filter((c) => c.chunk_type === "article" && c.metadata.article_number !== null)
    .map((c) => c.metadata.article_number as number);

  console.log(`Total chunk count: ${debug.total_chunks}`);
  console.log(`Chunk count excluding preamble: ${debug.article_chunk_count}`);
  console.log(`Unique article count: ${debug.unique_article_count}`);
  console.log(
    `Duplicate article numbers: ${
      debug.duplicate_article_numbers.length > 0
        ? debug.duplicate_article_numbers.join(", ")
        : "(none)"
    }`
  );
  console.log(
    `Missing article numbers (1..149): ${
      debug.missing_article_numbers.length > 0
        ? debug.missing_article_numbers.join(", ")
        : "(none)"
    }`
  );
  console.log(`Article 149 exists: ${debug.has_article_149 ? "yes" : "no"}`);

  const first10 = articleNumbers.slice(0, 10);
  const last10 = articleNumbers.slice(-10);

  console.log(
    `First 10 article numbers: ${
      first10.length > 0 ? first10.join(", ") : "(none)"
    }`
  );
  console.log(
    `Last 10 article numbers: ${last10.length > 0 ? last10.join(", ") : "(none)"}`
  );

  await writeFile(previewOutputPath, JSON.stringify(chunks, null, 2), "utf8");
  console.log(`Preview JSON saved to: ${previewOutputPath}`);
}

async function findPdfPath(ingestionDir: string): Promise<string> {
  // Prefer supabase/ingestion/ local file (what you intended).
  const files = await readdir(ingestionDir);
  const pdfs = files.filter((file) => file.toLowerCase().endsWith(".pdf"));

  if (pdfs.length > 0) {
    const canonicalFileName = "2014.01.26_-_final_constitution_english_idea_final.pdf";
    const preferred = pdfs.find(
      (f) => f.toLowerCase() === canonicalFileName.toLowerCase()
    );

    if (preferred) {
      const chosen = join(ingestionDir, preferred);
      await access(chosen);
      return chosen;
    }
  }

  // Fallback: repo already contains the Constitution PDF under database/ingestion/.
  const pdfFileName = "2014.01.26_-_final_constitution_english_idea_final.pdf";
  const fallback = join(ingestionDir, "..", "..", "database", "ingestion", pdfFileName);
  await access(fallback);
  console.warn(`No PDF in supabase/ingestion; using fallback: ${fallback}`);
  return fallback;
}

main().catch((error: unknown) => {
  console.error("Dry-run failed.");
  console.error(error);
  process.exit(1);
});