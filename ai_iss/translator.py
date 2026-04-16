"""
Stage-1 translator module.
Converts Tunisian Darija/Arabizi input into normalized Modern Standard Arabic (MSA).
"""

import logging
import os
from typing import Optional

import torch

try:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    HAS_TRANSFORMERS = True
except Exception:
    HAS_TRANSFORMERS = False

logger = logging.getLogger(__name__)

try:
    from slang_converter import understand_slang_input
except Exception:
    def understand_slang_input(text: str) -> str:
        return text


TRANSLATOR_PATHS = [
    os.path.join(os.getcwd(), "translator-model"),
    os.path.join(os.getcwd(), "models", "translator-model"),
]

_BASE_TRANSLATOR_MODEL = "google/mt5-small"

_translator_model = None
_translator_tokenizer = None
_translator_device = None


def _has_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def _looks_tunisian_or_arabizi(text: str) -> bool:
    lowered = text.lower()
    has_digits = any(ch.isdigit() for ch in lowered)
    has_latin = any("a" <= ch <= "z" for ch in lowered)
    return has_digits or (has_latin and not _has_arabic(lowered))


def _is_invalid_translation(candidate: str) -> bool:
    lowered = (candidate or "").strip().lower()
    if not lowered:
        return True
    if "<extra_id_" in lowered:
        return True
    if lowered in {".", "؟", "?"}:
        return True
    return False


def _get_device(force_cpu: bool = False) -> str:
    if force_cpu:
        return "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_translation_model(model_path: Optional[str] = None, force_cpu: bool = False):
    """Load stage-1 translation model if available on disk."""
    global _translator_model, _translator_tokenizer, _translator_device

    if _translator_model is not None and _translator_tokenizer is not None:
        return _translator_tokenizer, _translator_model, _translator_device

    if not HAS_TRANSFORMERS:
        logger.warning("transformers is not available; using rule-based fallback translation")
        return None, None, None

    if model_path is None:
        for path in TRANSLATOR_PATHS:
            if os.path.exists(path):
                model_path = path
                logger.info("Found translator model at: %s", model_path)
                break

    if model_path is None:
        logger.warning(
            "Translator model not found in %s. Falling back to rule-based normalization.",
            TRANSLATOR_PATHS,
        )
        return None, None, None

    _translator_device = _get_device(force_cpu=force_cpu)
    _translator_tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
    _translator_model = AutoModelForSeq2SeqLM.from_pretrained(model_path, local_files_only=True)
    if _translator_device == "cuda":
        _translator_model = _translator_model.to("cuda")

    _translator_model.eval()
    return _translator_tokenizer, _translator_model, _translator_device


def translate_tunisian_to_msa(text: str, max_tokens: int = 96) -> str:
    """
    Translate Tunisian Darija/Arabizi to MSA Arabic.

    Falls back to rule-based slang normalization when no trained translator model is found.
    """
    if not text:
        return text

    # First-pass normalization with lightweight rules.
    normalized = understand_slang_input(text).strip()

    # If input already looks like Arabic script, keep the normalized form.
    if _has_arabic(normalized) and not _looks_tunisian_or_arabizi(normalized):
        return normalized

    tokenizer, model, device = load_translation_model()
    if tokenizer is None or model is None:
        return normalized

    prompt = f"حوّل الجملة التونسية التالية إلى العربية الفصحى فقط: {normalized}"
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=256,
    )
    if device == "cuda":
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            num_beams=4,
            do_sample=False,
            repetition_penalty=1.1,
        )

    translated = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
    if _is_invalid_translation(translated):
        logger.warning("Translator produced invalid output; using normalized fallback.")
        return normalized

    return translated if translated else normalized
