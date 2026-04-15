"""
Stage-2 legal answer generation module.
This model expects a normalized Arabic question and answers based on Tunisian labor law.
"""

import logging
import os
import re
import json
import warnings
from difflib import SequenceMatcher
from typing import Optional

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger(__name__)

# Model paths to try (in order of preference)
MODEL_PATHS = [
    os.path.join(os.getcwd(), "legal-model"),
    os.path.join(os.getcwd(), "models", "legal-model"),
]

_model = None
_tokenizer = None
_device = None
_fallback_qa_cache = None

FALLBACK_DATA_PATHS = [
    os.path.join(os.getcwd(), "data", "legal_train_ar.json"),
    os.path.join(os.getcwd(), "data", "tunisian_legal.json"),
]

LEGAL_SIGNAL_TERMS = [
    "قانون",
    "حقوق",
    "عقد",
    "شغل",
    "عمل",
    "محكمة",
    "تعويض",
    "أجر",
    "CNSS",
]

# Cross-language legal intent hints to improve retrieval matching.
SEMANTIC_HINT_PATTERNS = [
    (r"\b(7a9|7a9i|ha9|ha9i|rights?|droit|droits?|حق|حقوق|حقي)\b", "حقوق"),
    (r"\b(khedma|5edma|travail|work|job|emploi|خدمة|عمل|شغل)\b", "عمل"),
    (r"\b(tared|taredni|fired?|fire|licenciement|dismiss(?:al)?|termination|طرد|فصل|تسرح)\b", "طرد"),
    (r"\b(i3lem|notice|preavis|préavis|إعلام|اعلام)\b", "اعلام"),
    (r"\b(employer|boss|patron|company|entreprise|صاحب\s*العمل)\b", "صاحب_العمل"),
    (r"\b(kanoun|law|legal|juridique|قانون)\b", "قانون"),
]


def get_device() -> str:
    """Determine the best device to use (GPU if available, otherwise CPU)."""
    if torch.cuda.is_available():
        device = "cuda"
        logger.info("Using GPU: %s", torch.cuda.get_device_name(0))
        return device

    logger.info("Using CPU (GPU not available)")
    return "cpu"


def _contains_cjk(text: str) -> bool:
    """Detect Chinese/Japanese/Korean Unified Ideographs in text."""
    if not text:
        return False
    return re.search(r"[\u4e00-\u9fff]", text) is not None


def _contains_arabic(text: str) -> bool:
    if not text:
        return False
    return re.search(r"[\u0600-\u06FF]", text) is not None


def _normalize_for_match(text: str) -> str:
    lowered = (text or "").lower().strip()
    lowered = lowered.replace("؟", "?")
    lowered = re.sub(r"[^a-z0-9\u0600-\u06FF\s?]", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _extract_semantic_hints(text: str) -> set:
    normalized = _normalize_for_match(text)
    hints = set()
    for pattern, hint in SEMANTIC_HINT_PATTERNS:
        if re.search(pattern, normalized):
            hints.add(hint)
    return hints


def _load_fallback_qa_pairs():
    global _fallback_qa_cache

    if _fallback_qa_cache is not None:
        return _fallback_qa_cache

    pairs = []
    for path in FALLBACK_DATA_PATHS:
        if not os.path.exists(path):
            continue

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            logger.warning("Could not read fallback data from %s: %s", path, exc)
            continue

        if not isinstance(data, list):
            continue

        for item in data:
            if not isinstance(item, dict):
                continue
            q = (item.get("input") or "").strip()
            a = (item.get("output") or "").strip()
            if q and a:
                pairs.append((q, a))

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for q, a in pairs:
        key = (q, a)
        if key not in seen:
            seen.add(key)
            deduped.append((q, a))

    _fallback_qa_cache = deduped
    logger.info("Loaded %d fallback QA pairs", len(_fallback_qa_cache))
    return _fallback_qa_cache


def _retrieve_fallback_answer(question: str) -> Optional[str]:
    pairs = _load_fallback_qa_pairs()
    if not pairs:
        return None

    q_norm = _normalize_for_match(question)
    if not q_norm:
        return None

    q_tokens = set(q_norm.split())
    q_hints = _extract_semantic_hints(question)
    best_score = 0.0
    best_answer = None

    for candidate_q, candidate_a in pairs:
        c_norm = _normalize_for_match(candidate_q)
        if not c_norm:
            continue

        seq = SequenceMatcher(None, q_norm, c_norm).ratio()
        c_tokens = set(c_norm.split())
        overlap = len(q_tokens & c_tokens) / max(len(q_tokens | c_tokens), 1)
        c_hints = _extract_semantic_hints(candidate_q)
        hint_overlap = len(q_hints & c_hints) / max(len(q_hints | c_hints), 1) if (q_hints or c_hints) else 0.0
        contains_bonus = 0.12 if q_norm in c_norm or c_norm in q_norm else 0.0

        score = 0.55 * seq + 0.2 * overlap + 0.25 * hint_overlap + contains_bonus
        if score > best_score:
            best_score = score
            best_answer = candidate_a

    if best_score >= 0.58:
        logger.info("Using retrieval fallback answer (score=%.3f)", best_score)
        return best_answer

    # For clearly legal queries that generated poor text, accept a lower match threshold.
    if q_hints and best_score >= 0.42:
        logger.info("Using retrieval fallback answer with relaxed threshold (score=%.3f)", best_score)
        return best_answer

    return None


def _is_low_quality_response(response: str) -> bool:
    text = (response or "").strip()
    if not text:
        return True

    if len(text.split()) < 6:
        return True

    if "### question" in text.lower() or "### answer" in text.lower():
        return True

    if not _contains_arabic(text):
        return True

    if not any(term in text for term in LEGAL_SIGNAL_TERMS):
        return True

    return False


def load_legal_model(model_path: Optional[str] = None, force_cpu: bool = False):
    """Load legal model and tokenizer once and reuse them."""
    global _model, _tokenizer, _device

    if _model is not None and _tokenizer is not None:
        return _tokenizer, _model, _device

    if model_path is None:
        for path in MODEL_PATHS:
            if os.path.exists(path):
                model_path = path
                logger.info("Found legal model at: %s", model_path)
                break

    if model_path is None:
        raise ValueError(f"Legal model not found in any of: {MODEL_PATHS}")

    _device = "cpu" if force_cpu else get_device()

    logger.info("Loading tokenizer from %s...", model_path)
    _tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)

    logger.info("Loading legal model from %s...", model_path)
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=r"Unexpected keyword arguments .* for class LoraConfig.*",
                category=UserWarning,
            )
            _model = AutoModelForCausalLM.from_pretrained(
                model_path,
                local_files_only=True,
                device_map="auto" if _device == "cuda" else "cpu",
                dtype=torch.float16 if _device == "cuda" else torch.float32,
            )
    except Exception as exc:
        logger.warning("Auto device load failed: %s. Falling back to standard load.", exc)
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=r"Unexpected keyword arguments .* for class LoraConfig.*",
                category=UserWarning,
            )
            _model = AutoModelForCausalLM.from_pretrained(
                model_path,
                local_files_only=True,
                dtype=torch.float32,
            )
        if _device == "cuda":
            _model = _model.to(_device)

    _model.eval()
    logger.info("Legal model loaded successfully")
    return _tokenizer, _model, _device


def generate_legal_answer(question_msa: str, max_tokens: int = 256) -> str:
    """Generate a legal answer from a normalized Arabic question."""
    tokenizer, model, device = load_legal_model()

    prompt = f"""### Instruction:
أجب باللغة العربية الفصحى وفق قانون الشغل التونسي. قدّم جوابا واضحا ومختصرا.

### Question:
{question_msa}

### Answer:
"""

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512,
    ).to(device)

    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_length=min(2048, inputs["input_ids"].shape[1] + max_tokens),
            do_sample=False,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    result = tokenizer.decode(output[0], skip_special_tokens=True)
    if "### Answer:" in result:
        response = result.split("### Answer:")[-1].strip()
    else:
        response = result.replace(prompt, "").strip()

    if _contains_cjk(response):
        strict_prompt = f"""### Instruction:
أجب بالعربية الفصحى فقط وفق قانون الشغل التونسي.

### Question:
{question_msa}

### Answer:
"""
        strict_inputs = tokenizer(
            strict_prompt,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=512,
        ).to(device)
        with torch.no_grad():
            strict_output = model.generate(
                **strict_inputs,
                max_length=min(2048, strict_inputs["input_ids"].shape[1] + max_tokens),
                do_sample=False,
                repetition_penalty=1.1,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        strict_result = tokenizer.decode(strict_output[0], skip_special_tokens=True)
        if "### Answer:" in strict_result:
            response = strict_result.split("### Answer:")[-1].strip()
        else:
            response = strict_result.replace(strict_prompt, "").strip()

    if _is_low_quality_response(response):
        fallback = _retrieve_fallback_answer(question_msa)
        if fallback:
            return fallback

    if not response:
        response = "لفهم حالتك القانونية بدقة، من فضلك قدّم تفاصيل أكثر عن عقد العمل والوضع الحالي."

    return response


# Backward-compatible aliases used by other modules.
def load_model(model_path: Optional[str] = None, force_cpu: bool = False):
    return load_legal_model(model_path=model_path, force_cpu=force_cpu)


def generate_answer(text: str, max_tokens: int = 256) -> str:
    return generate_legal_answer(question_msa=text, max_tokens=max_tokens)