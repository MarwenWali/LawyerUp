"""
Evaluate the two-stage Tunisian legal assistant pipeline.

Stage 1:
- Translation quality (Tunisian Darija/Arabizi -> MSA Arabic)

Stage 2:
- Legal answer relevance (normalized Arabic question -> legal answer)
"""

import argparse
import json
import logging
import random
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Callable, Dict, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default dataset paths if config import fails.
DEFAULT_TRANSLATION_DATASET_PATH = "data/translator_train.json"
DEFAULT_LEGAL_DATASET_PATH = "data/legal_train_ar.json"

ARABIC_STOPWORDS = {
    "في", "من", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "التي",
    "الذي", "هل", "ما", "ماذا", "ثم", "او", "أو", "ان", "إن", "قد", "كان", "كانت",
    "يكون", "يمكن", "تم", "كما", "بعد", "قبل", "عند", "اي", "أي", "حسب", "انه",
}

LEGAL_TERMS = [
    "قانون", "الشغل", "عمل", "عقد", "محكمة", "تعويض", "راتب", "أجر", "طرد",
    "استقالة", "ضمان", "اجتماعي", "CNSS", "حقوق", "شكوى", "تفقدية",
]


def load_paths_from_config() -> Dict[str, str]:
    try:
        from config import LEGAL_DATASET_PATH, TRANSLATION_DATASET_PATH
        return {
            "translation": TRANSLATION_DATASET_PATH,
            "legal": LEGAL_DATASET_PATH,
        }
    except Exception:
        return {
            "translation": DEFAULT_TRANSLATION_DATASET_PATH,
            "legal": DEFAULT_LEGAL_DATASET_PATH,
        }


def load_json_examples(path: str) -> List[Dict]:
    dataset_path = Path(path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    with dataset_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError(f"Dataset must be a JSON list: {dataset_path}")

    examples = []
    for row in data:
        if not isinstance(row, dict):
            continue
        if "input" not in row or "output" not in row:
            continue
        examples.append(row)

    return examples


def maybe_sample(examples: List[Dict], limit: int, seed: int) -> List[Dict]:
    if limit <= 0 or len(examples) <= limit:
        return examples
    rng = random.Random(seed)
    return rng.sample(examples, limit)


def normalize_text(text: str) -> str:
    text = (text or "").strip().lower()

    # Remove Arabic diacritics.
    text = re.sub(r"[\u0617-\u061A\u064B-\u0652]", "", text)

    # Keep Arabic letters, latin letters, digits, and spaces.
    text = re.sub(r"[^\u0600-\u06FFa-z0-9\s]", " ", text)

    # Normalize whitespace.
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str) -> List[str]:
    return [tok for tok in normalize_text(text).split() if tok]


def token_f1(prediction: str, reference: str) -> float:
    pred_tokens = tokenize(prediction)
    ref_tokens = tokenize(reference)

    if not pred_tokens and not ref_tokens:
        return 1.0
    if not pred_tokens or not ref_tokens:
        return 0.0

    pred_count = Counter(pred_tokens)
    ref_count = Counter(ref_tokens)
    overlap = sum((pred_count & ref_count).values())

    precision = overlap / len(pred_tokens)
    recall = overlap / len(ref_tokens)

    if precision + recall == 0:
        return 0.0
    return (2 * precision * recall) / (precision + recall)


def char_similarity(prediction: str, reference: str) -> float:
    pred = normalize_text(prediction)
    ref = normalize_text(reference)
    if not pred and not ref:
        return 1.0
    return SequenceMatcher(None, pred, ref).ratio()


def has_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def content_tokens(text: str) -> List[str]:
    return [tok for tok in tokenize(text) if tok not in ARABIC_STOPWORDS and len(tok) > 1]


def overlap_ratio(question: str, answer: str) -> float:
    q_tokens = set(content_tokens(question))
    a_tokens = set(content_tokens(answer))

    if not q_tokens:
        return 0.0
    return len(q_tokens & a_tokens) / len(q_tokens)


def contains_legal_term(answer: str) -> float:
    normalized = normalize_text(answer)
    return 1.0 if any(term.lower() in normalized for term in LEGAL_TERMS) else 0.0


def resolve_translator() -> Dict:
    try:
        from translator import translate_tunisian_to_msa
        return {
            "function": translate_tunisian_to_msa,
            "backend": "translator_model_or_rule_based",
            "error": None,
        }
    except Exception as exc:
        logger.warning("Translator module unavailable: %s", exc)

    def fallback(text: str, max_tokens: int = 96) -> str:
        try:
            from slang_converter import understand_slang_input
            return understand_slang_input(text)
        except Exception:
            return text

    return {
        "function": fallback,
        "backend": "fallback_rule_only",
        "error": "translator import failed",
    }


def resolve_legal_generator() -> Dict:
    try:
        from generator import generate_legal_answer
        return {
            "function": generate_legal_answer,
            "backend": "legal_model",
            "error": None,
        }
    except Exception as exc:
        logger.warning("Legal generator unavailable: %s", exc)
        return {
            "function": None,
            "backend": "unavailable",
            "error": str(exc),
        }


def evaluate_translation_quality(
    examples: List[Dict],
    translate_fn: Callable[[str], str],
) -> Dict:
    exact_matches = 0
    token_f1_scores = []
    char_scores = []

    for row in examples:
        source = row["input"]
        reference = row["output"]

        prediction = translate_fn(source)

        pred_norm = normalize_text(prediction)
        ref_norm = normalize_text(reference)
        exact_matches += int(pred_norm == ref_norm)

        token_f1_scores.append(token_f1(prediction, reference))
        char_scores.append(char_similarity(prediction, reference))

    count = len(examples)
    if count == 0:
        return {
            "count": 0,
            "exact_match": 0.0,
            "avg_token_f1": 0.0,
            "avg_char_similarity": 0.0,
        }

    return {
        "count": count,
        "exact_match": exact_matches / count,
        "avg_token_f1": sum(token_f1_scores) / count,
        "avg_char_similarity": sum(char_scores) / count,
    }


def evaluate_legal_relevance(
    examples: List[Dict],
    legal_fn: Optional[Callable[[str], str]],
    max_new_tokens: int,
) -> Dict:
    if legal_fn is None:
        return {
            "count": 0,
            "status": "skipped",
            "reason": "legal model function unavailable",
        }

    non_empty_scores = []
    arabic_scores = []
    legal_term_scores = []
    q_a_overlap_scores = []
    ref_f1_scores = []

    for idx, row in enumerate(examples, start=1):
        question = row["input"]
        reference = row["output"]

        try:
            prediction = legal_fn(question, max_tokens=max_new_tokens)
        except Exception as exc:
            logger.warning("Legal generation failed at example %s: %s", idx, exc)
            return {
                "count": idx - 1,
                "status": "partial",
                "reason": str(exc),
                "non_empty": sum(non_empty_scores) / max(1, len(non_empty_scores)),
                "arabic_output_rate": sum(arabic_scores) / max(1, len(arabic_scores)),
                "legal_term_presence": sum(legal_term_scores) / max(1, len(legal_term_scores)),
                "query_answer_overlap": sum(q_a_overlap_scores) / max(1, len(q_a_overlap_scores)),
                "reference_token_f1": sum(ref_f1_scores) / max(1, len(ref_f1_scores)),
                "composite_relevance": 0.0,
            }

        non_empty_scores.append(1.0 if prediction.strip() else 0.0)
        arabic_scores.append(1.0 if has_arabic(prediction) else 0.0)
        legal_term_scores.append(contains_legal_term(prediction))
        q_a_overlap_scores.append(overlap_ratio(question, prediction))
        ref_f1_scores.append(token_f1(prediction, reference))

    count = len(examples)
    if count == 0:
        return {
            "count": 0,
            "status": "ok",
            "non_empty": 0.0,
            "arabic_output_rate": 0.0,
            "legal_term_presence": 0.0,
            "query_answer_overlap": 0.0,
            "reference_token_f1": 0.0,
            "composite_relevance": 0.0,
        }

    non_empty = sum(non_empty_scores) / count
    arabic_rate = sum(arabic_scores) / count
    legal_term = sum(legal_term_scores) / count
    overlap = sum(q_a_overlap_scores) / count
    ref_f1 = sum(ref_f1_scores) / count

    # Weighted composite relevance score focused on legal grounding and question coverage.
    composite = (0.35 * legal_term) + (0.35 * overlap) + (0.30 * ref_f1)

    return {
        "count": count,
        "status": "ok",
        "non_empty": non_empty,
        "arabic_output_rate": arabic_rate,
        "legal_term_presence": legal_term,
        "query_answer_overlap": overlap,
        "reference_token_f1": ref_f1,
        "composite_relevance": composite,
    }


def pct(value: float) -> str:
    return f"{value * 100:.2f}%"


def print_report(report: Dict) -> None:
    stage1 = report["stage1_translation"]
    stage2 = report["stage2_legal"]

    print("\n" + "=" * 80)
    print("TWO-STAGE EVALUATION REPORT")
    print("=" * 80)

    print("\n[Stage 1] Translation Quality")
    print(f"backend: {report['stage1_backend']}")
    print(f"examples: {stage1['count']}")
    print(f"exact_match: {pct(stage1['exact_match'])}")
    print(f"avg_token_f1: {pct(stage1['avg_token_f1'])}")
    print(f"avg_char_similarity: {pct(stage1['avg_char_similarity'])}")

    print("\n[Stage 2] Legal Answer Relevance")
    print(f"backend: {report['stage2_backend']}")
    print(f"status: {stage2['status']}")
    print(f"examples: {stage2['count']}")

    if stage2["status"] in {"ok", "partial"}:
        print(f"non_empty: {pct(stage2['non_empty'])}")
        print(f"arabic_output_rate: {pct(stage2['arabic_output_rate'])}")
        print(f"legal_term_presence: {pct(stage2['legal_term_presence'])}")
        print(f"query_answer_overlap: {pct(stage2['query_answer_overlap'])}")
        print(f"reference_token_f1: {pct(stage2['reference_token_f1'])}")
        print(f"composite_relevance: {pct(stage2['composite_relevance'])}")

    if "reason" in stage2:
        print(f"note: {stage2['reason']}")

    print("=" * 80 + "\n")


def main() -> None:
    default_paths = load_paths_from_config()

    parser = argparse.ArgumentParser(description="Evaluate translation and legal relevance separately")
    parser.add_argument("--translation-data", default=default_paths["translation"], help="Path to translation evaluation JSON")
    parser.add_argument("--legal-data", default=default_paths["legal"], help="Path to legal evaluation JSON")
    parser.add_argument("--limit", type=int, default=0, help="Max examples per stage (0 means all)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sampling")
    parser.add_argument("--max-new-tokens", type=int, default=192, help="Max generated tokens for legal answers")
    parser.add_argument("--translation-only", action="store_true", help="Run only stage-1 translation evaluation")
    parser.add_argument("--legal-only", action="store_true", help="Run only stage-2 legal evaluation")
    parser.add_argument("--output-json", default="", help="Optional output JSON report path")
    args = parser.parse_args()

    run_stage1 = not args.legal_only
    run_stage2 = not args.translation_only

    report = {
        "stage1_backend": "skipped",
        "stage2_backend": "skipped",
        "stage1_translation": {
            "count": 0,
            "exact_match": 0.0,
            "avg_token_f1": 0.0,
            "avg_char_similarity": 0.0,
        },
        "stage2_legal": {
            "count": 0,
            "status": "skipped",
            "reason": "not requested",
        },
    }

    if run_stage1:
        translator = resolve_translator()
        translation_examples = load_json_examples(args.translation_data)
        translation_examples = maybe_sample(translation_examples, args.limit, args.seed)

        report["stage1_backend"] = translator["backend"]
        report["stage1_translation"] = evaluate_translation_quality(
            translation_examples,
            translator["function"],
        )

    if run_stage2:
        legal_gen = resolve_legal_generator()
        legal_examples = load_json_examples(args.legal_data)
        legal_examples = maybe_sample(legal_examples, args.limit, args.seed)

        report["stage2_backend"] = legal_gen["backend"]
        report["stage2_legal"] = evaluate_legal_relevance(
            legal_examples,
            legal_gen["function"],
            max_new_tokens=args.max_new_tokens,
        )

    print_report(report)

    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        logger.info("Saved report to %s", output_path)


if __name__ == "__main__":
    main()
