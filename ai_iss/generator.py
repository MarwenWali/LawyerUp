"""
Stage-2 legal answer generation module.
This model expects a normalized Arabic question and answers based on Tunisian labor law.
"""

import logging
import os
import re
import json
import warnings
from collections import Counter
from difflib import SequenceMatcher
from typing import Optional

logger = logging.getLogger(__name__)

_torch = None
_torch_import_attempted = False
_torch_import_error = None
_AutoModelForCausalLM = None
_AutoTokenizer = None
_transformers_import_attempted = False
_transformers_import_error = None

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

LABOR_SCOPE_PATTERNS = [
    # EN / FR / Arabizi hints
    r"\b(work|job|labor|labour|employment|employee|employer|salary|wage|contract|dismiss(?:al)?|fired?|termination|overtime|leave|cnss|travail|emploi|salaire|contrat|licenciement)\b",
    r"\b(khedma|5edma|3amil|ajir|7a9|7ou9ou9|patron|khallas|salaire|contrat)\b",
    # Arabic labor-law scope hints (unicode escapes to avoid file-encoding issues)
    r"(\u0634\u063a\u0644|\u0639\u0645\u0644|\u0639\u0627\u0645\u0644|\u0639\u0645\u0627\u0644|\u0623\u062c\u064a\u0631|\u0623\u062c\u0631|\u0631\u0627\u062a\u0628|\u0637\u0631\u062f|\u0641\u0635\u0644|\u0639\u0642\u062f|\u0633\u0627\u0639\u0627\u062a\s*\u0625\u0636\u0627\u0641\u064a\u0629|\u0625\u062c\u0627\u0632\u0629|\u062a\u0639\u0648\u064a\u0636|\u062a\u0641\u0642\u062f\u064a\u0629\s*\u0627\u0644\u0634\u063a\u0644|\u0627\u0644\u0636\u0645\u0627\u0646\s*\u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a|cnss)",
]

DISALLOWED_TOPIC_PATTERNS = [
    r"\b(israel|israeli|palestin(?:e|ian)?|gaza|zion)\b",
    r"(\u0625\u0633\u0631\u0627\u0626\u064a\u0644|\u0627\u0633\u0631\u0627\u0626\u064a\u0644|\u0627\u0644\u0627\u0633\u0631\u0627\u0626\u064a\u0644\u064a|\u0641\u0644\u0633\u0637\u064a\u0646|\u063a\u0632\u0629|\u0627\u0644\u0642\u062f\u0633)",
]

TOPIC_RULES = [
    {
        "patterns": [
            r"\b(tared|taredni|fired?|fire|dismiss(?:al)?|termination|licenciement|طرد|فصل|تسريح)\b",
            r"\b(i3lem|notice|preavis|préavis|إشعار|إعلام|اعلام)\b",
        ],
        "basis": "وفق مجلة الشغل التونسية: لا يجوز الطرد التعسفي، ويجب احترام الإجراءات القانونية والإعلام المسبق، ومع عدم احترامها يثبت حق العامل في الطعن والتعويض.",
        "steps": [
            "اجمع عقد الشغل وكشوف الأجر وأي مراسلات تخص إنهاء العلاقة.",
            "قدّم تظلما كتابيا لصاحب العمل واطلب بيان سبب الطرد قانونيا.",
            "ارفع شكاية لدى تفقدية الشغل، ثم الطعن قضائيا عند الاقتضاء لطلب التعويض.",
        ],
    },
    {
        "patterns": [
            r"\b(salaire|salary|wage|pay|paie|خلص|خلاص|أجر|راتب)\b",
        ],
        "basis": "وفق مجلة الشغل التونسية: الأجر حق أساسي للعامل، وتأخير الأجر أو الامتناع عنه دون سند قانوني يعرّض المشغّل للمساءلة.",
        "steps": [
            "اطلب كشفا واضحا لمستحقاتك والأشهر غير المدفوعة.",
            "وجّه إنذارا كتابيا مع أجل محدد للخلاص.",
            "التجئ لتفقدية الشغل أو القضاء للمطالبة بالأجر والتعويض عند الضرر.",
        ],
    },
    {
        "patterns": [
            r"\b(cnss|social|sécurité|ضمان|الضمان\s*الاجتماعي)\b",
        ],
        "basis": "وفق قانون الضمان الاجتماعي في تونس: التصريح بالأجراء وخلاص المساهمات واجب قانوني على المشغّل، والإخلال به يضر حقوق العامل التأمينية.",
        "steps": [
            "تحقق من وضعيتك لدى CNSS وطباعة كشف المساهمات.",
            "اطلب من المشغّل تسوية التصريح فورا بصفة كتابية.",
            "قدّم مطلبا لدى CNSS وتفقدية الشغل لإثبات العلاقة الشغلية وتدارك الفترات.",
        ],
    },
    {
        "patterns": [
            r"\b(contrat|contract|عقد)\b",
        ],
        "basis": "وفق مجلة الشغل التونسية: عقد الشغل يحدد الحقوق والواجبات، وأي شرط مخالف للنظام العام الاجتماعي يمكن الطعن فيه.",
        "steps": [
            "راجع بنود العقد خصوصا الأجر والمدة والتجربة والإنهاء.",
            "اطلب تعديل البنود الغامضة أو المجحفة قبل الإمضاء.",
            "استشر مختصا أو تفقدية الشغل إذا وُجد شرط غير قانوني.",
        ],
    },
    {
        "patterns": [
            r"\b(overtime|heures?\s*suppl[eé]mentaires?|ساعات\s*إضافية)\b",
        ],
        "basis": "وفق مجلة الشغل التونسية: الساعات الإضافية تخضع لشروط قانونية ويترتب عنها أجر إضافي حسب النسب المعمول بها.",
        "steps": [
            "احتفظ بسجل فعلي لساعات العمل اليومية.",
            "طالب بتسوية مقابل الساعات الإضافية كتابيا.",
            "عند الرفض، قدّم شكاية لدى تفقدية الشغل مع الإثباتات.",
        ],
    },
    {
        "patterns": [
            r"\b(cong[eé]|leave|vacation|عطلة|إجازة|مرضية)\b",
        ],
        "basis": "وفق مجلة الشغل التونسية: للعامل حق في العطل القانونية (السنوية والمرضية) ضمن الشروط والإجراءات المنصوص عليها.",
        "steps": [
            "قدّم طلب العطلة أو الملف الطبي طبقا للإجراءات الداخلية.",
            "اطلب رفضا أو قبولا مكتوبا لتوثيق الوضعية.",
            "اعرض النزاع على تفقدية الشغل إذا تم رفض الحق دون موجب قانوني.",
        ],
    },
    {
        "patterns": [
            r"\b(harass|harc[eè]lement|تحرش)\b",
        ],
        "basis": "وفق التشريع التونسي ومجلة الشغل: التحرش أو الإيذاء في بيئة العمل سلوك ممنوع ويستوجب حماية العامل واتخاذ إجراءات ضد المعتدي.",
        "steps": [
            "وثّق الوقائع (تواريخ، رسائل، شهود) بدقة.",
            "أبلغ الإدارة كتابيا مع طلب حماية فورية.",
            "توجّه للجهات المختصة عند عدم المعالجة داخليا.",
        ],
    },
]

DEFAULT_BASIS = "وفق القواعد العامة في مجلة الشغل التونسية: لكل عامل حقوق تتعلق بالأجر، وظروف العمل، والحماية من التعسف، ويمكن المطالبة بها عبر المسارات الإدارية والقضائية."
DEFAULT_STEPS = [
    "حدّد الوقائع بدقة مع التواريخ والمستندات.",
    "قدّم طلبا أو تظلما كتابيا لصاحب العمل.",
    "التجئ إلى تفقدية الشغل، ثم القضاء عند الحاجة لحماية حقك.",
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

def _get_torch():
    global _torch, _torch_import_attempted, _torch_import_error

    if _torch is not None:
        return _torch
    if os.getenv("AI_ISS_DISABLE_TORCH", "").strip().lower() in {"1", "true", "yes"}:
        _torch_import_attempted = True
        logger.info("AI_ISS_DISABLE_TORCH is enabled; skipping PyTorch model runtime.")
        return None
    if _torch_import_attempted:
        return None

    _torch_import_attempted = True
    try:
        import torch as torch_module
        _torch = torch_module
        return _torch
    except Exception as exc:
        _torch_import_error = exc
        logger.warning("PyTorch is unavailable: %s", exc)
        return None


def _get_transformers_classes():
    global _AutoModelForCausalLM, _AutoTokenizer
    global _transformers_import_attempted, _transformers_import_error

    if _AutoModelForCausalLM is not None and _AutoTokenizer is not None:
        return _AutoModelForCausalLM, _AutoTokenizer
    if _transformers_import_attempted:
        return None, None

    _transformers_import_attempted = True
    try:
        from transformers import AutoModelForCausalLM as model_cls, AutoTokenizer as tokenizer_cls
        _AutoModelForCausalLM = model_cls
        _AutoTokenizer = tokenizer_cls
        return _AutoModelForCausalLM, _AutoTokenizer
    except Exception as exc:
        _transformers_import_error = exc
        logger.warning("transformers is unavailable: %s", exc)
        return None, None


def _runtime_dependency_error_message() -> str:
    if _torch_import_error is not None:
        return f"PyTorch import failed: {_torch_import_error}"
    if _transformers_import_error is not None:
        return f"Transformers import failed: {_transformers_import_error}"
    return "Model runtime dependencies are unavailable."


def get_device() -> str:
    """Determine the best device to use (GPU if available, otherwise CPU)."""
    torch_module = _get_torch()
    if torch_module is not None and torch_module.cuda.is_available():
        device = "cuda"
        logger.info("Using GPU: %s", torch_module.cuda.get_device_name(0))
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


def _is_disallowed_topic(text: str) -> bool:
    normalized = _normalize_for_match(text)
    if not normalized:
        return False
    for pattern in DISALLOWED_TOPIC_PATTERNS:
        if re.search(pattern, normalized):
            return True
    return False


def _is_labor_scope_text(text: str) -> bool:
    normalized = _normalize_for_match(text)
    if not normalized:
        return False
    for pattern in LABOR_SCOPE_PATTERNS:
        if re.search(pattern, normalized):
            return True
    return False


def _extract_semantic_hints(text: str) -> set:
    normalized = _normalize_for_match(text)
    hints = set()
    for pattern, hint in SEMANTIC_HINT_PATTERNS:
        if re.search(pattern, normalized):
            hints.add(hint)
    return hints


def _has_excessive_repetition(text: str) -> bool:
    tokens = re.findall(r"[\u0600-\u06FFa-z0-9]+", (text or "").lower())
    if len(tokens) < 12:
        return False

    token_counts = Counter(tokens)
    unique_ratio = len(token_counts) / len(tokens)
    if unique_ratio < 0.45:
        return True

    if token_counts and max(token_counts.values()) >= 6:
        return True

    if len(tokens) >= 9:
        tri_grams = [" ".join(tokens[i : i + 3]) for i in range(len(tokens) - 2)]
        tri_counts = Counter(tri_grams)
        if tri_counts and max(tri_counts.values()) >= 3:
            return True

    return False


def _looks_gibberish_text(text: str) -> bool:
    cleaned = _clean_explanation_text(text)
    if not cleaned:
        return True

    lowered = cleaned.lower()
    if "<extra_id_" in lowered:
        return True

    if _has_excessive_repetition(cleaned):
        return True

    if re.search(r"([\u0600-\u06FF]{4,})(?:\s+\1){2,}", cleaned):
        return True

    tokens = re.findall(r"[\u0600-\u06FFa-z0-9]+", lowered)
    if len(tokens) >= 10:
        long_tokens = [t for t in tokens if len(t) >= 5]
        if long_tokens:
            counts = Counter(long_tokens)
            if max(counts.values()) >= 4:
                return True

    # Common garbled pattern from mixed tokenization artifacts.
    if re.search(r"[\u0600-\u06FF]+'[a-z]", lowered):
        return True

    return False


def _detect_topic_rule(question: str, answer: str) -> dict:
    question_norm = _normalize_for_match(question)

    # Prefer topic signals from the user question.
    for rule in TOPIC_RULES:
        for pattern in rule["patterns"]:
            if re.search(pattern, question_norm):
                return rule

    return {
        "basis": DEFAULT_BASIS,
        "steps": DEFAULT_STEPS,
    }


def _clean_explanation_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "")).strip()
    cleaned = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -,:;\n\t")
    if len(cleaned) > 380:
        cleaned = cleaned[:380].rsplit(" ", 1)[0] + "..."
    return cleaned


def _format_legal_response(question: str, answer_text: str) -> str:
    rule = _detect_topic_rule(question, answer_text)
    explanation = _clean_explanation_text(answer_text)

    if _is_disallowed_topic(explanation):
        explanation = ""

    if _looks_gibberish_text(explanation):
        fallback_explanation = _retrieve_fallback_answer(question)
        if fallback_explanation and _contains_arabic(fallback_explanation) and not _looks_gibberish_text(fallback_explanation):
            explanation = _clean_explanation_text(fallback_explanation)

    if not explanation or len(explanation.split()) < 6:
        explanation = "القاعدة العامة: لا يكفي مجرد موقف شفوي لإسقاط حقوق العامل، ويجب احترام الإجراءات القانونية والإثباتات."

    if not _contains_arabic(explanation) or _looks_gibberish_text(explanation):
        explanation = "باختصار: " + rule["basis"].split(":", 1)[-1].strip()

    steps = rule["steps"]
    return (
        f"الأساس القانوني:\n{rule['basis']}\n\n"
        f"الشرح المبسّط:\n{explanation}\n\n"
        "ماذا تفعل الآن:\n"
        f"1) {steps[0]}\n"
        f"2) {steps[1]}\n"
        f"3) {steps[2]}"
    )


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
            if not (q and a):
                continue
            if _is_disallowed_topic(q) or _is_disallowed_topic(a):
                continue
            if not (_is_labor_scope_text(q) or _is_labor_scope_text(a)):
                continue
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
        if _is_disallowed_topic(candidate_q) or _is_disallowed_topic(candidate_a):
            continue
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
        if best_answer and not _is_disallowed_topic(best_answer):
            return best_answer

    # For clearly legal queries that generated poor text, accept a lower match threshold.
    if q_hints and best_score >= 0.42:
        logger.info("Using retrieval fallback answer with relaxed threshold (score=%.3f)", best_score)
        if best_answer and not _is_disallowed_topic(best_answer):
            return best_answer

    return None


def _is_low_quality_response(response: str) -> bool:
    text = (response or "").strip()
    if not text:
        return True

    if len(text.split()) < 6:
        return True

    if "<extra_id_" in text.lower():
        return True

    if "### question" in text.lower() or "### answer" in text.lower():
        return True

    if _has_excessive_repetition(text):
        return True

    if _looks_gibberish_text(text):
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

    torch_module = _get_torch()
    model_cls, tokenizer_cls = _get_transformers_classes()
    if torch_module is None or model_cls is None or tokenizer_cls is None:
        raise RuntimeError(_runtime_dependency_error_message())

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
    _tokenizer = tokenizer_cls.from_pretrained(model_path, local_files_only=True)

    logger.info("Loading legal model from %s...", model_path)
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=r"Unexpected keyword arguments .* for class LoraConfig.*",
                category=UserWarning,
            )
            _model = model_cls.from_pretrained(
                model_path,
                local_files_only=True,
                device_map="auto" if _device == "cuda" else "cpu",
                dtype=torch_module.float16 if _device == "cuda" else torch_module.float32,
            )
    except Exception as exc:
        logger.warning("Auto device load failed: %s. Falling back to standard load.", exc)
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=r"Unexpected keyword arguments .* for class LoraConfig.*",
                category=UserWarning,
            )
            _model = model_cls.from_pretrained(
                model_path,
                local_files_only=True,
                dtype=torch_module.float32,
            )
        if _device == "cuda":
            _model = _model.to(_device)

    _model.eval()
    logger.info("Legal model loaded successfully")
    return _tokenizer, _model, _device


def generate_legal_answer(question_msa: str, max_tokens: int = 256) -> str:
    """Generate a legal answer from a normalized Arabic question."""
    try:
        tokenizer, model, device = load_legal_model()
        torch_module = _get_torch()
        if torch_module is None:
            raise RuntimeError(_runtime_dependency_error_message())
    except Exception as exc:
        logger.warning("Model generation unavailable; using retrieval fallback: %s", exc)
        fallback = _retrieve_fallback_answer(question_msa)
        if fallback:
            return _format_legal_response(question_msa, fallback)
        return _format_legal_response(question_msa, DEFAULT_BASIS)

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

    with torch_module.no_grad():
        output = model.generate(
            **inputs,
            max_length=min(2048, inputs["input_ids"].shape[1] + max_tokens),
            do_sample=False,
            repetition_penalty=1.2,
            no_repeat_ngram_size=3,
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
        with torch_module.no_grad():
            strict_output = model.generate(
                **strict_inputs,
                max_length=min(2048, strict_inputs["input_ids"].shape[1] + max_tokens),
                do_sample=False,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3,
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
            response = fallback

    if not response:
        response = "لفهم حالتك القانونية بدقة، من فضلك قدّم تفاصيل أكثر عن عقد العمل والوضع الحالي."

    return _format_legal_response(question_msa, response)


# Backward-compatible aliases used by other modules.
def load_model(model_path: Optional[str] = None, force_cpu: bool = False):
    return load_legal_model(model_path=model_path, force_cpu=force_cpu)


def generate_answer(text: str, max_tokens: int = 256) -> str:
    return generate_legal_answer(question_msa=text, max_tokens=max_tokens)
