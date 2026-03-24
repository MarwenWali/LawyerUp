import { readFile } from "node:fs/promises";
import pdfParse from "pdf-parse";

export type ConstitutionChunk = {
  chunk_type: "preamble" | "article";
  content: string;
  metadata: {
    article_number: number | null;
    language: "en";
    source_type: "pdf";
    document_kind: "constitution";
    jurisdiction: "Tunisia";
    is_translation: true;
  };
};

/**
 * Extracts and structures the Tunisian Constitution PDF into semantic chunks.
 *
 * Output contract:
 * - 1 preamble chunk (if preamble is found)
 * - 1 chunk per article ("Article 1", "Article 2", etc.)
 *
 * This parser is intentionally "safe first-step":
 * - no database calls
 * - no external app integration
 * - deterministic metadata
 */
export async function parseConstitutionPdf(
  pdfPath: string
): Promise<ConstitutionChunk[]> {
  const pdfBuffer = await readFile(pdfPath);
  const parsed = await pdfParse(pdfBuffer);

  // 1) Raw extraction from PDF.
  const rawText = parsed.text ?? "";

  // 2) Cleanup + TOC removal before we split into sections.
  const cleanedText = normalizeAndRemoveToc(rawText);

  // 3) Detect preamble and articles.
  return buildStructuredChunks(cleanedText);
}

function normalizeAndRemoveToc(text: string): string {
  // Normalize line endings so regex and splitting behave consistently on all OSes.
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  const keptLines: string[] = [];
  let inToc = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const compactLine = line.replace(/\s+/g, " ");

    // TOC start markers.
    if (/^(table of contents|contents)$/i.test(compactLine)) {
      inToc = true;
      continue;
    }

    // TOC end markers: once we hit real body headings, we exit TOC mode.
    if (
      inToc &&
      (/^preamble\b/i.test(compactLine) || /^article\s+\d+\b/i.test(compactLine))
    ) {
      inToc = false;
    }

    if (inToc) {
      continue;
    }

    // Skip standalone page numbers and visual separators that are common in PDFs.
    if (/^\d+$/.test(compactLine)) continue;
    if (/^[.\-_=]{3,}$/.test(compactLine)) continue;

    keptLines.push(rawLine);
  }

  // Light normalization:
  // - collapse 3+ blank lines
  // - normalize repeated spaces/tabs (but keep line boundaries)
  return keptLines
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildStructuredChunks(cleanText: string): ConstitutionChunk[] {
  const chunks: ConstitutionChunk[] = [];

  const articleHeadingRegex = /^article\s+(\d+)\b/im;
  const firstArticleMatch = cleanText.match(articleHeadingRegex);
  const firstArticleIndex = firstArticleMatch?.index ?? -1;

  // Locate "Preamble" heading if present.
  const preambleHeadingMatch = cleanText.match(/\bpreamble\b/i);
  const preambleHeadingIndex = preambleHeadingMatch?.index ?? -1;

  let articleRegionStart = firstArticleIndex >= 0 ? firstArticleIndex : cleanText.length;

  // Build preamble chunk (only when we can confidently locate preamble content).
  if (preambleHeadingIndex >= 0 && firstArticleIndex > preambleHeadingIndex) {
    const preambleContent = cleanText
      .slice(preambleHeadingIndex, firstArticleIndex)
      .trim();

    if (preambleContent.length > 0) {
      chunks.push(makeChunk("preamble", preambleContent, null));
    }
  } else if (preambleHeadingIndex < 0 && firstArticleIndex > 0) {
    // Fallback heuristic: if no explicit "Preamble" word was found,
    // treat everything before Article 1 as preamble-like front matter.
    const preambleFallback = cleanText.slice(0, firstArticleIndex).trim();
    if (preambleFallback.length > 0) {
      chunks.push(makeChunk("preamble", preambleFallback, null));
    }
  }

  // Build one chunk per article using non-greedy section capture.
  // This captures from "Article N" up to the next "Article M" or end-of-text.
  const articleRegion = cleanText.slice(articleRegionStart);
  const articleBlockRegex = /(^article\s+(\d+)\b[\s\S]*?)(?=^article\s+\d+\b|\Z)/gim;

  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articleBlockRegex.exec(articleRegion)) !== null) {
    const rawArticleBlock = articleMatch[1].trim();
    const articleNumber = Number(articleMatch[2]);

    if (!Number.isFinite(articleNumber) || rawArticleBlock.length === 0) {
      continue;
    }

    chunks.push(makeChunk("article", rawArticleBlock, articleNumber));
  }

  return chunks;
}

function makeChunk(
  chunkType: "preamble" | "article",
  content: string,
  articleNumber: number | null
): ConstitutionChunk {
  return {
    chunk_type: chunkType,
    content,
    metadata: {
      article_number: articleNumber,
      language: "en",
      source_type: "pdf",
      document_kind: "constitution",
      jurisdiction: "Tunisia",
      is_translation: true,
    },
  };
}

