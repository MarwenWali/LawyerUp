import { readFile } from "node:fs/promises";
import * as pdfParseModule from "pdf-parse";

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

export type ConstitutionParseDebugSummary = {
  total_chunks: number; // including preamble
  article_chunk_count: number; // excluding preamble
  unique_article_count: number;
  duplicate_article_numbers: number[];
  missing_article_numbers: number[]; // from 1..149
  has_article_149: boolean;
};

/**
 * Parse a single PDF and return structured chunks:
 * - 1 preamble chunk
 * - 1 chunk per Constitution article (Article 1..149)
 *
 * Notes for safety / simplicity:
 * - No DB writes
 * - No embeddings
 * - Article headings are detected only at start-of-line boundaries
 */
export async function parseConstitutionPdf(
  pdfPath: string
): Promise<ConstitutionChunk[]> {
  const pdfBuffer = await readFile(pdfPath);
  const parsed = await extractPdfText(pdfBuffer);
  const rawText = (parsed.text ?? "").replace(/\r\n?/g, "\n");

  const cleanedText = basicNormalize(rawText);
  const bodyStartIndex = detectRealBodyStart(cleanedText);
  if (bodyStartIndex < 0) return [];

  const preambleStartIndex = findLastHeadingLineIndex(
    cleanedText,
    /^preamble\b/im,
    bodyStartIndex
  );

  const preambleEndIndex = bodyStartIndex;

  const articleRegion = cleanedText.slice(bodyStartIndex);

  const articleHeadingCandidates = collectArticleHeadingCandidates(articleRegion);

  // Select canonical headings 1..149 to avoid duplicates and TOC double-captures.
  const selectedHeadings = selectCanonicalArticleHeadings(
    articleHeadingCandidates,
    149
  );

  const chunks: ConstitutionChunk[] = [];

  if (preambleStartIndex >= 0) {
    const preambleContent = cleanedText
      .slice(preambleStartIndex, preambleEndIndex)
      .trim();
    if (preambleContent.length > 0) {
      chunks.push(makeChunk("preamble", preambleContent, null));
    }
  }

  // Slice from each selected heading to the next selected heading.
  for (let i = 0; i < selectedHeadings.length; i += 1) {
    const current = selectedHeadings[i];
    const next = selectedHeadings[i + 1];
    const start = current.startIndex;
    const end = next ? next.startIndex : articleRegion.length;
    const content = articleRegion.slice(start, end).trim();
    if (content.length === 0) continue;
    chunks.push(makeChunk("article", content, current.articleNumber));
  }

  return chunks;
}

export function buildParseDebugSummary(
  chunks: ConstitutionChunk[]
): ConstitutionParseDebugSummary {
  const articleNumbers = chunks
    .filter((c) => c.chunk_type === "article" && c.metadata.article_number !== null)
    .map((c) => c.metadata.article_number as number);

  const counts = new Map<number, number>();
  for (const n of articleNumbers) counts.set(n, (counts.get(n) ?? 0) + 1);

  const duplicateArticleNumbers = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([n]) => n)
    .sort((a, b) => a - b);

  const missingArticleNumbers: number[] = [];
  for (let n = 1; n <= 149; n += 1) {
    if (!counts.has(n)) missingArticleNumbers.push(n);
  }

  return {
    total_chunks: chunks.length,
    article_chunk_count: articleNumbers.length,
    unique_article_count: counts.size,
    duplicate_article_numbers: duplicateArticleNumbers,
    missing_article_numbers: missingArticleNumbers,
    has_article_149: counts.has(149),
  };
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

function basicNormalize(text: string): string {
  // Light cleanup: collapse long whitespace and keep meaningful line breaks.
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Detect the real constitution body start by finding the best "Article 1"
 * candidate that is followed by "Article 2" with a long body-like gap.
 *
 * We don't trust the first occurrence of "Article 1" because TOC pages include it.
 */
function detectRealBodyStart(text: string): number {
  const article1Candidates = collectHeadingStartIndexes(text, /^article\s*1\b/im);
  if (article1Candidates.length === 0) return -1;

  let best: { index: number; score: number } | null = null;

  for (const idx of article1Candidates) {
    const after = text.slice(idx);
    const m2 = findNextHeadingStartIndex(after, /^article\s*2\b/im);
    if (m2 < 0) continue;

    const between = after.slice(0, m2);
    const betweenLen = between.replace(/\s+/g, "").length;

    // TOC gaps are usually tiny; body gaps are much larger.
    const score = betweenLen;
    if (!best || score > best.score) best = { index: idx, score };
  }

  if (!best) {
    // Fallback: use the last "Article 1" candidate.
    return article1Candidates[article1Candidates.length - 1];
  }

  return best.index;
}

function collectArticleHeadingCandidates(
  articleRegionText: string
): { articleNumber: number; startIndex: number }[] {
  const candidates: { articleNumber: number; startIndex: number }[] = [];

  // IMPORTANT: heading-only boundary.
  // - start-of-line anchor
  // - "Article <number>" at beginning
  // - allow optional punctuation/title text after the number
  //
  // This avoids matching inline references like "according to Article 74".
  // Some PDF extractions break headings across two lines (e.g. "Article" then the number).
  const headingRegex =
    /^[ \t]*article[ \t]*(?:\n[ \t]*)?(\d{1,3})\b[^\n]*/gim;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(articleRegionText)) !== null) {
    const articleNumber = Number(match[1]);
    if (!Number.isFinite(articleNumber)) continue;
    candidates.push({ articleNumber, startIndex: match.index });
  }

  return candidates;
}

function selectCanonicalArticleHeadings(
  candidates: { articleNumber: number; startIndex: number }[],
  maxArticleNumber: number
): { articleNumber: number; startIndex: number }[] {
  // Keep first occurrence of each article number (prevents duplicates).
  const firstByNumber = new Map<number, number>();
  const picked: { articleNumber: number; startIndex: number }[] = [];

  // Candidates are already in document order because we scan with a global regex.
  for (const c of candidates) {
    if (c.articleNumber < 1 || c.articleNumber > maxArticleNumber) continue;
    if (firstByNumber.has(c.articleNumber)) continue;
    firstByNumber.set(c.articleNumber, c.startIndex);
    picked.push({ articleNumber: c.articleNumber, startIndex: c.startIndex });
  }

  // Now build canonical list 1..maxArticleNumber in increasing order.
  const canonical: { articleNumber: number; startIndex: number }[] = [];
  let lastIndex = -1;
  for (let n = 1; n <= maxArticleNumber; n += 1) {
    const idx = firstByNumber.get(n);
    if (idx === undefined) continue;
    // Guard against any weird re-ordering if extraction inserts headings strangely.
    if (idx <= lastIndex) continue;
    canonical.push({ articleNumber: n, startIndex: idx });
    lastIndex = idx;
  }

  return canonical;
}

function findLastHeadingLineIndex(
  text: string,
  headingRegex: RegExp,
  beforeIndex: number
): number {
  // We want "last match before body start", and we require line boundary.
  const global = new RegExp(headingRegex.source, headingRegex.flags.includes("g") ? headingRegex.flags : `${headingRegex.flags}g`);
  let last = -1;
  let match: RegExpExecArray | null;

  while ((match = global.exec(text)) !== null) {
    if (match.index < beforeIndex) last = match.index;
    else break;
  }
  return last;
}

function collectHeadingStartIndexes(text: string, regex: RegExp): number[] {
  const global = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  const indexes: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    if (typeof match.index === "number") indexes.push(match.index);
  }
  return indexes;
}

function findNextHeadingStartIndex(text: string, regex: RegExp): number {
  // returns index relative to provided text
  const global = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  const match = global.exec(text);
  return match?.index ?? -1;
}

/**
 * Handles multiple `pdf-parse` export styles:
 * - classic callable default export: pdfParse(buffer)
 * - class API: new PDFParse({ data }).getText()
 */
async function extractPdfText(dataBuffer: Buffer): Promise<{ text?: string }> {
  const callable = resolvePdfParseCallable();
  if (callable) return callable(dataBuffer);

  const classResult = await tryPdfParseClassApi(dataBuffer);
  if (classResult) return classResult;

  throw new Error(
    "Unsupported pdf-parse API in current environment (no callable export or PDFParse class API found)."
  );
}

function resolvePdfParseCallable():
  | ((dataBuffer: Buffer) => Promise<{ text?: string }>)
  | null {
  const candidateA = pdfParseModule as unknown;
  const candidateB = (pdfParseModule as { default?: unknown }).default;

  if (typeof candidateA === "function") {
    return candidateA as (dataBuffer: Buffer) => Promise<{ text?: string }>;
  }

  if (typeof candidateB === "function") {
    return candidateB as (dataBuffer: Buffer) => Promise<{ text?: string }>;
  }

  return null;
}

async function tryPdfParseClassApi(
  dataBuffer: Buffer
): Promise<{ text?: string } | null> {
  const rawModule = pdfParseModule as Record<string, unknown>;
  const defaultModule =
    (pdfParseModule as { default?: unknown }).default ?? {};

  const maybePdfParseClass =
    (rawModule.PDFParse as unknown) ??
    ((defaultModule as Record<string, unknown>).PDFParse as unknown);

  if (typeof maybePdfParseClass !== "function") return null;

  const parser = new (maybePdfParseClass as new (options: { data: Buffer }) => {
    getText?: () => Promise<string | { text?: string }>;
    destroy?: () => Promise<void> | void;
  })({ data: dataBuffer });

  if (typeof parser.getText !== "function") return null;

  const textResult = await parser.getText();
  const text =
    typeof textResult === "string" ? textResult : (textResult?.text ?? "");

  if (typeof parser.destroy === "function") {
    await parser.destroy();
  }

  return { text };
}

