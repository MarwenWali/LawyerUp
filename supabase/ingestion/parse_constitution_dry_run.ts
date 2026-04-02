import { access, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildParseDebugSummary, parseConstitutionPdf } from "./constitutionPdfParser";

const PDF_FILE_CANDIDATES = [
  "2014.01.26_-_final_constitution_english_idea_final.pdf",
  "2014.01.26_-_final_constitution_english_idea_final.pdf.pdf",
];

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
  const candidateDirs = [
    ingestionDir,
    join(ingestionDir, "..", "..", "ai_iss"),
    join(ingestionDir, "..", "..", "database", "ingestion"),
  ];

  // 1) Fast path: check canonical candidates in preferred directories.
  for (const dir of candidateDirs) {
    for (const name of PDF_FILE_CANDIDATES) {
      const candidatePath = join(dir, name);
      try {
        await access(candidatePath);
        if (dir !== ingestionDir) {
          console.warn(`Using fallback Constitution PDF: ${candidatePath}`);
        }
        return candidatePath;
      } catch {
        // Continue searching.
      }
    }
  }

  // 2) Last resort: scan supabase/ingestion for any PDF file.
  const files = await readdir(ingestionDir);
  const pdfs = files.filter((file) => file.toLowerCase().endsWith(".pdf"));
  if (pdfs.length > 0) {
    const chosen = join(ingestionDir, pdfs[0]);
    await access(chosen);
    console.warn(`Using first available PDF in supabase/ingestion: ${chosen}`);
    return chosen;
  }

  throw new Error(
    [
      "Could not find the Constitution PDF.",
      "Checked these directories:",
      ...candidateDirs.map((d) => `- ${d}`),
      "Expected one of these file names:",
      ...PDF_FILE_CANDIDATES.map((n) => `- ${n}`),
    ].join("\n")
  );
}

main().catch((error: unknown) => {
  console.error("Dry-run failed.");
  console.error(error);
  process.exit(1);
});