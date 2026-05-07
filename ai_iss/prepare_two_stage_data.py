"""
Prepare two-stage datasets from the mixed Tunisian legal JSON file.

Stage 1 dataset:
- Tunisian Darija/Arabizi input -> MSA Arabic output

Stage 2 dataset:
- Normalized Arabic legal question -> Arabic legal answer
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, List

try:
    from config import LEGAL_DATASET_PATH, RAW_DATASET_PATH, TRANSLATION_DATASET_PATH
except Exception:
    RAW_DATASET_PATH = "data/tunisian_legal.json"
    TRANSLATION_DATASET_PATH = "data/translator_train.json"
    LEGAL_DATASET_PATH = "data/legal_train_ar.json"

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

try:
    from slang_converter import understand_slang_input
except Exception:
    def understand_slang_input(text: str) -> str:
        return text


LEGAL_HINTS = [
    "قانون",
    "حقوق",
    "عقد",
    "شغل",
    "عمل",
    "تعويض",
    "طرد",
    "محكمة",
    "cnss",
    "contrat",
    "travail",
    "salaire",
    "tribunal",
    "licenciement",
    "overtime",
    "retirement",
    "resign",
    "labor",
    "law",
]

TUNISIAN_CUES = {
    "chnowa",
    "chniya",
    "chneya",
    "najem",
    "nheb",
    "na3",
    "n3",
    "kifeh",
    "3andi",
    "sahbi",
    "brabi",
    "winek",
    "rani",
    "mouch",
    "hakka",
    "tounes",
    "khdema",
    "5edma",
    "cnss",
    "boss",
}

STRONG_TUNISIAN_CUES = {
    "chnowa",
    "chniya",
    "chneya",
    "najem",
    "nheb",
    "kifeh",
    "3andi",
    "sahbi",
    "brabi",
    "winek",
    "rani",
    "mouch",
    "hakka",
    "tounes",
}

# Useful transliteration/keyword replacements to normalize common Tunisian legal queries.
ARABIZI_TO_MSA = {
    "chnowa": "ما هي",
    "chniya": "ما هي",
    "chneya": "ما هي",
    "chni": "ما",
    "najem": "هل يمكنني",
    "nheb": "أريد",
    "na3ref": "أعرف",
    "n3ref": "أعرف",
    "n3amel": "أبرم",
    "na3mel": "أبرم",
    "na5ou": "آخذ",
    "n5dm": "أعمل",
    "nst9il": "أستقيل",
    "n7ot": "أقدّم",
    "7a9i": "حقوقي",
    "fil": "في",
    "fi": "في",
    "tounes": "تونس",
    "sans": "بدون",
    "accord": "موافقة",
    "avocat": "محامي",
    "droit": "حق",
    "congé": "إجازة",
    "chômage": "بطالة",
    "plainte": "شكوى",
    "contre": "ضد",
    "payé": "مدفوعة",
    "w": "و",
    "mta3": "المتعلق ب",
    "5edma": "عمل",
    "khdema": "العمل",
    "travail": "العمل",
    "contrat": "عقد عمل",
    "boss": "صاحب العمل",
    "cnss": "الضمان الاجتماعي",
    "overtime": "الساعات الإضافية",
    "notice": "مدة الإعلام",
    "retraite": "التقاعد",
}


def has_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def looks_tunisian_or_arabizi(text: str) -> bool:
    lowered = text.lower()
    has_digits = any(ch.isdigit() for ch in lowered)
    has_latin = any("a" <= ch <= "z" for ch in lowered)
    return has_digits or (has_latin and not has_arabic(lowered))


def is_tunisian_like(text: str) -> bool:
    lowered = (text or "").lower()

    if has_arabic(lowered):
        return True

    if any(ch.isdigit() for ch in lowered):
        return True

    if any(cue in lowered for cue in STRONG_TUNISIAN_CUES):
        return True

    latin_words = re.findall(r"[a-zA-Z']+", lowered)
    if len(latin_words) > 4:
        return False

    return any(cue in lowered for cue in TUNISIAN_CUES)


def normalize_tunisian_input(text: str) -> str:
    normalized = understand_slang_input(text or "")

    # Replace latin tokens first.
    for token, replacement in sorted(ARABIZI_TO_MSA.items(), key=lambda kv: len(kv[0]), reverse=True):
        normalized = re.sub(rf"\b{re.escape(token)}\b", replacement, normalized, flags=re.IGNORECASE)

    # Compact whitespace.
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def is_legal_example(example: Dict) -> bool:
    instruction = (example.get("instruction") or "").strip().lower()
    input_text = (example.get("input") or "").strip().lower()
    output_text = (example.get("output") or "").strip().lower()

    if instruction:
        return True

    haystack = f"{input_text} {output_text}"
    return any(hint in haystack for hint in LEGAL_HINTS)


def dedupe_examples(examples: List[Dict]) -> List[Dict]:
    seen = set()
    unique = []
    for item in examples:
        key = (item.get("instruction", ""), item.get("input", ""), item.get("output", ""))
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def build_translation_dataset(records: List[Dict]) -> List[Dict]:
    examples = []

    for row in records:
        source = (row.get("input") or "").strip()
        target = (row.get("output") or "").strip()
        if not source or not target:
            continue

        if row.get("instruction"):
            # For legal rows, create pseudo translation target from normalized input itself.
            if not is_tunisian_like(source):
                continue

            pseudo_target = normalize_tunisian_input(source)
            if has_arabic(pseudo_target) and pseudo_target != source:
                examples.append(
                    {
                        "input": source,
                        "output": pseudo_target,
                    }
                )
            continue

        # Keep pairs where target is Arabic and source is Darija/Arabizi-ish.
        if has_arabic(target) and is_tunisian_like(source):
            examples.append(
                {
                    "input": source,
                    "output": target,
                }
            )

    return dedupe_examples(examples)


def build_legal_dataset(records: List[Dict]) -> List[Dict]:
    examples = []

    for row in records:
        if not is_legal_example(row):
            continue

        source = (row.get("input") or "").strip()
        target = (row.get("output") or "").strip()
        if not source or not target:
            continue

        # Stage-2 model is Arabic-centric, so keep Arabic legal answers only.
        if not has_arabic(target):
            continue

        normalized_question = normalize_tunisian_input(source)
        if not has_arabic(normalized_question):
            continue

        examples.append(
            {
                "instruction": "أجب بالعربية الفصحى وفق قانون الشغل التونسي.",
                "input": normalized_question,
                "output": target,
            }
        )

    return dedupe_examples(examples)


def save_json(path: Path, data: List[Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main() -> None:
    raw_path = Path(RAW_DATASET_PATH)
    if not raw_path.exists():
        raise FileNotFoundError(
            f"Raw dataset not found: {RAW_DATASET_PATH}. Expected to run from ai_iss folder."
        )

    with raw_path.open("r", encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        raise ValueError("Raw dataset must be a JSON list of examples")

    translation_data = build_translation_dataset(records)
    legal_data = build_legal_dataset(records)

    translation_path = Path(TRANSLATION_DATASET_PATH)
    legal_path = Path(LEGAL_DATASET_PATH)

    save_json(translation_path, translation_data)
    save_json(legal_path, legal_data)

    logger.info("Prepared stage-1 translation dataset: %s examples -> %s", len(translation_data), translation_path)
    logger.info("Prepared stage-2 legal dataset: %s examples -> %s", len(legal_data), legal_path)


if __name__ == "__main__":
    main()
