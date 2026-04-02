/**
 * AI Engine Service
 *
 * Uses constitution chunks parsed from the 2014 Tunisian Constitution PDF
 * to provide grounded answers with article citations.
 */

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:8000";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONSTITUTION_CHUNKS_PATH = path.join(
  __dirname,
  "../../supabase/ingestion/constitution_chunks.preview.json",
);

let cachedConstitutionChunks = null;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "what",
  "when",
  "where",
  "which",
  "about",
  "into",
  "their",
  "they",
  "them",
  "can",
  "could",
  "would",
  "should",
  "please",
  "need",
  "help",
]);

const CASE_TOPICS = [
  {
    name: "work",
    keywords: [
      "work",
      "worker",
      "employee",
      "salary",
      "wage",
      "job",
      "dismiss",
      "employment",
      "labor",
      "travail",
      "travailleur",
      "salaire",
      "emploi",
      "عمل",
      "عامل",
      "راتب",
      "أجر",
    ],
    guidance:
      "Gather your contract, salary slips, and employer communications. Ask for written reasons for any dismissal or wage issue.",
  },
  {
    name: "fair_trial",
    keywords: [
      "arrest",
      "detention",
      "trial",
      "judge",
      "court",
      "defense",
      "evidence",
      "criminal",
      "tribunal",
      "procès",
      "arrestation",
      "محكمة",
      "محاكمة",
      "دفاع",
      "إيقاف",
    ],
    guidance:
      "Request legal counsel early, keep copies of all case papers, and document any procedural violations by date.",
  },
  {
    name: "freedom_expression",
    keywords: [
      "speech",
      "expression",
      "opinion",
      "press",
      "media",
      "publish",
      "censor",
      "censorship",
      "liberté",
      "presse",
      "تعبير",
      "رأي",
      "صحافة",
      "إعلام",
    ],
    guidance:
      "Keep records of what was said or published, who restricted it, and the legal reason given for restriction.",
  },
  {
    name: "privacy",
    keywords: [
      "privacy",
      "home",
      "search",
      "phone",
      "data",
      "surveillance",
      "private",
      "vie",
      "privée",
      "données",
      "خصوصية",
      "تفتيش",
      "بيانات",
    ],
    guidance:
      "Preserve evidence of the intrusion (messages, notices, screenshots) and note whether there was judicial authorization.",
  },
  {
    name: "religion_conscience",
    keywords: [
      "religion",
      "belief",
      "conscience",
      "worship",
      "mosque",
      "faith",
      "religieuse",
      "religion",
      "معتقد",
      "دين",
      "ضمير",
      "عبادة",
    ],
    guidance:
      "Write down the exact restriction, the authority involved, and how it affected your freedom of belief or worship.",
  },
  {
    name: "equality",
    keywords: [
      "equality",
      "discrimination",
      "equal",
      "gender",
      "race",
      "equalité",
      "discrimination",
      "égalité",
      "مساواة",
      "تمييز",
      "جنس",
    ],
    guidance:
      "Document comparative treatment (who was treated differently), dates, and any discriminatory statements or policies.",
  },
];

async function loadConstitutionChunks() {
  if (cachedConstitutionChunks) return cachedConstitutionChunks;
  const raw = await readFile(CONSTITUTION_CHUNKS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Constitution chunks file is empty or invalid JSON array.");
  }
  cachedConstitutionChunks = parsed;
  return cachedConstitutionChunks;
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function detectCaseTopic(text) {
  const lowered = (text || "").toLowerCase();
  let best = null;

  for (const topic of CASE_TOPICS) {
    let score = 0;
    for (const keyword of topic.keywords) {
      if (lowered.includes(keyword.toLowerCase())) score += 1;
    }

    if (!best || score > best.score) {
      best = { ...topic, score };
    }
  }

  return best && best.score > 0 ? best : null;
}

function scoreChunk(queryTokens, chunk, topic) {
  const content = (chunk.content || "").toLowerCase();
  const articleNumber = chunk?.metadata?.article_number;
  const heading = getArticleHeading(chunk.content || "").toLowerCase();
  const chunkTokens = tokenize(content);
  const chunkTokenSet = new Set(chunkTokens);
  let score = 0;

  const uniqueQueryTokens = Array.from(new Set(queryTokens));
  let overlapCount = 0;

  for (const token of uniqueQueryTokens) {
    if (chunkTokenSet.has(token) || content.includes(token)) overlapCount += 1;
  }

  // Core lexical overlap.
  score += overlapCount * 3;

  // Density favors focused articles over broad, generic long sections.
  const density = overlapCount / Math.max(25, chunkTokens.length);
  score += density * 220;

  const articleMention = content.match(/^article\s+(\d+)/im);
  if (articleMention && queryTokens.includes(`article${articleMention[1]}`)) {
    score += 5;
  }

  if (
    typeof articleNumber === "number" &&
    queryTokens.includes(`art${articleNumber}`)
  ) {
    score += 5;
  }

  if (topic) {
    for (const keyword of topic.keywords) {
      const lowered = keyword.toLowerCase();
      if (content.includes(lowered)) score += 2;
      if (heading.includes(lowered)) score += 7;
    }
  }

  if (chunkTokens.length > 420) {
    score -= 4;
  }

  return score;
}

function extractArticleHints(message) {
  const hints = [];
  const matches =
    (message || "").toLowerCase().match(/article\s*(\d{1,3})/g) || [];
  for (const m of matches) {
    const n = Number(m.replace(/\D/g, ""));
    if (Number.isFinite(n)) {
      hints.push(`article${n}`);
      hints.push(`art${n}`);
    }
  }
  return hints;
}

function compactExcerpt(content, maxLen = 420) {
  const clean = (content || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
}

function getArticleHeading(chunkContent) {
  const firstLine = (chunkContent || "").split("\n")[0]?.trim() || "";
  return firstLine.replace(/\s+/g, " ");
}

function buildSimpleExplanation(userMessage, primaryChunk, topic) {
  const heading = getArticleHeading(primaryChunk?.content || "");
  const excerpt = compactExcerpt(primaryChunk?.content || "", 320);

  const topicLine = topic
    ? `Your case seems related to ${topic.name.replace("_", " ")}.`
    : "Your case appears to involve constitutional rights and duties.";

  return `${topicLine} The closest constitutional provision is ${heading}. In simple terms, this article says: ${excerpt}`;
}

function countKeywordHits(text, keywords) {
  const lowered = (text || "").toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    if (lowered.includes(keyword.toLowerCase())) hits += 1;
  }
  return hits;
}

function rankChunksByTopic(chunks, topic, queryTokens) {
  if (!topic) return [];

  return chunks
    .map((chunk) => {
      const content = (chunk.content || "").toLowerCase();
      const heading = getArticleHeading(chunk.content || "").toLowerCase();
      const contentHits = countKeywordHits(content, topic.keywords);
      const headingHits = countKeywordHits(heading, topic.keywords);

      let queryHeadingHits = 0;
      let queryContentHits = 0;
      for (const token of queryTokens) {
        if (heading.includes(token)) queryHeadingHits += 1;
        if (content.includes(token)) queryContentHits += 1;
      }

      const chunkLenPenalty = Math.max(0, tokenize(content).length - 420) / 120;
      const score =
        headingHits * 14 +
        contentHits * 2 +
        queryHeadingHits * 10 +
        queryContentHits -
        chunkLenPenalty;

      return { chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function formatGroundedAnswer(userMessage, topChunks) {
  if (!topChunks.length) {
    return (
      "I could not find a sufficiently relevant article in the Tunisian Constitution chunks yet. " +
      "Please rephrase your question with more detail (for example: rights, duties, elections, judiciary, or a specific article number)."
    );
  }

  const primary = topChunks[0];
  const topic = detectCaseTopic(userMessage);
  const primaryArticle = primary?.metadata?.article_number
    ? `Article ${primary.metadata.article_number}`
    : "Preamble";

  const matchingLawLine = `Most relevant law for your case: ${primaryArticle} (${getArticleHeading(primary?.content || "")}).`;
  const explanationLine = `Why it applies: ${buildSimpleExplanation(userMessage, primary, topic)}`;

  const bullets = topChunks
    .map((chunk) => {
      const article = chunk?.metadata?.article_number;
      const label = article ? `Article ${article}` : "Preamble";
      return `- ${label}: ${compactExcerpt(chunk.content)}`;
    })
    .join("\n");

  const references = topChunks
    .map((chunk) => {
      const article = chunk?.metadata?.article_number;
      return article ? `Article ${article}` : "Preamble";
    })
    .join(", ");

  const nextSteps = topic
    ? topic.guidance
    : "Collect key documents and dates, then consult a lawyer to apply these constitutional principles to your exact facts.";

  return [
    matchingLawLine,
    explanationLine,
    "",
    "Relevant legal provisions:",
    bullets,
    "",
    `Practical next step: ${nextSteps}`,
    `Legal references: ${references}`,
  ].join("\n");
}

async function tryRemoteAiEngine(userMessage, history = [], context = {}) {
  try {
    const res = await fetch(`${AI_ENGINE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history, context }),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const text = data?.response || data?.answer || data?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Send a user message and conversation history to the AI engine
 * and return the AI's response text.
 *
 * @param {string} userMessage - The latest user message
 * @param {Array<{sender: string, content: string}>} history - Prior messages in the session
 * @param {object} [context] - Optional context (e.g. user role, case info, lawyer profiles)
 * @returns {Promise<string>} - The AI response text
 */
export async function getAIResponse(userMessage, history = [], context = {}) {
  if (!userMessage || !userMessage.trim()) {
    throw new Error("userMessage is required");
  }

  const remote = await tryRemoteAiEngine(userMessage, history, context);
  if (remote) return remote;

  const chunks = await loadConstitutionChunks();
  const historyContext = history
    .filter((m) => m?.sender === "user" && typeof m?.content === "string")
    .slice(-2)
    .map((m) => m.content)
    .join(" ");

  const fullQuery = `${historyContext} ${userMessage}`.trim();
  const topic = detectCaseTopic(fullQuery);
  const queryTokens = [
    ...tokenize(fullQuery),
    ...extractArticleHints(fullQuery),
  ];

  const topicRanked = rankChunksByTopic(chunks, topic, queryTokens)
    .slice(0, 3)
    .map((x) => x.chunk);

  if (topicRanked.length > 0) {
    return formatGroundedAnswer(userMessage, topicRanked);
  }

  const scored = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(queryTokens, chunk, topic) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.chunk);

  return formatGroundedAnswer(userMessage, scored);
}

/**
 * Analyze a legal case description and return a structured summary.
 *
 * @param {object} caseData - { subject, description, category }
 * @returns {Promise<object>} - { summary, suggestedLawyerSpecialization, urgencyLevel }
 */
export async function analyzeCase(caseData) {
  const text =
    `${caseData?.subject || ""}\n${caseData?.description || ""}`.trim();
  if (!text) {
    return {
      summary: "No case details were provided.",
      suggestedLawyerSpecialization: "General Practice",
      urgencyLevel: "low",
    };
  }

  const summary = await getAIResponse(text);
  return {
    summary,
    suggestedLawyerSpecialization: "Constitutional Law",
    urgencyLevel: "medium",
  };
}

/**
 * Given a user's legal query, return a ranked list of matching lawyer IDs.
 *
 * @param {string} query - Natural language description of the user's legal need
 * @param {Array<object>} lawyers - Available lawyers from the database
 * @returns {Promise<string[]>} - Ordered array of lawyer IDs
 */
export async function matchLawyers(query, lawyers) {
  if (!Array.isArray(lawyers) || lawyers.length === 0) return [];

  const q = (query || "").toLowerCase();
  const constitutionalSignals = [
    "constitution",
    "article",
    "rights",
    "freedom",
    "election",
    "judiciary",
  ];
  const hasConstitutionSignal = constitutionalSignals.some((k) =>
    q.includes(k),
  );

  if (!hasConstitutionSignal) {
    return lawyers.map((l) => l.id).filter(Boolean);
  }

  const ranked = [...lawyers].sort((a, b) => {
    const aScore = `${a?.specialization || ""}`
      .toLowerCase()
      .includes("constitution")
      ? 1
      : 0;
    const bScore = `${b?.specialization || ""}`
      .toLowerCase()
      .includes("constitution")
      ? 1
      : 0;
    return bScore - aScore;
  });

  return ranked.map((l) => l.id).filter(Boolean);
}
