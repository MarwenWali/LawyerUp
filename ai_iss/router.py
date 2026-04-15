"""
Request routing module - detects intent and routes to appropriate handler
Supports Tunisian Arabic (Darija), Modern Standard Arabic, French, and English
"""

import logging
from generator import generate_legal_answer

try:
    from translator import translate_tunisian_to_msa
except ImportError:
    def translate_tunisian_to_msa(text: str, max_tokens: int = 96) -> str:
        return text

logger = logging.getLogger(__name__)

# Attempt to import slang converter, optional (intent helper only)
try:
    from slang_converter import understand_slang_input
except ImportError:
    logger.warning("slang_converter not available")
    
    def understand_slang_input(text):
        """Fallback: just return text as-is"""
        return text

# Legal keywords in Tunisian Arabic, Arabic, French, and English/Arabizi
LEGAL_KEYWORDS = [
    # Arabizi/Transliteration (Darija)
    "cnss", "khedma", "contrat", "bank", "banque", "police", "7ou9ouq",
    "kanoun", "droit", "credit", "karhba", "ijara", "moukri", "salaire",
    "mchkel", "mochkla", "tashkiya", "tribunal", "justice", "law", "legal",
    "travail", "hadhi", "7a9i", "najem", "chnowa", "chnow", "nheb",
    "5edma", "3amil", "darar", "mohim", "mahkama", "avocate", "avocat",
    
    # Modern Standard Arabic (MSA)
    "قانون", "القانون", "حق", "حقوق", "حقي", "قضية", "محكمة", "محامي", "قاضي",
    "شكوى", "دعوى", "عقد", "خدمة", "عمل", "خدام", "صاحب", "مالك", "راتب",
    "أجر", "جرية", "خلاص", "خلص", "يخلص", "تعويض", "ضريبة", "تأمين",
    "كراء", "إيجار", "اجارة", "شرطة", "حكم", "قرار", "حكم", "عامل",
    
    # French
    "travail", "droit", "salaire", "contrat", "avocat", "tribunal", "legal",
    "congé", "assurance", "retraite", "licenciement", "formation",

    # English
    "right", "rights", "labor", "labour", "employment", "employer", "employee",
    "salary", "wage", "contract", "dismissal", "fired", "fire", "terminate",
    "termination", "notice", "overtime", "leave", "compensation", "lawsuit",
]

# Simple affirmation/continuation words
YES_WORDS = ["ey", "oui", "yes", "yeah", "اي", "ايي", "نعم", "آه", "okay", "ok"]

# Continuation words in Tunisian slang
FOLLOW_UP_WORDS = [
    "زيد", "كمل", "واصل", "فسر", "وضح", "more", "continue", "again",
    "ekhtar", "ezid", "7adha", "plus"
]

# Common legal question patterns
LEGAL_PATTERNS = [
    "شنية حقوق", "شنو حقوق", "ما خلصنيش", "ما يخلصنيش", "مخلصنيش",
    "chnowa", "najem", "is it legal", "ai-je le droit",
    "what are my rights", "can i be fired", "fired without notice",
    "my employer", "employment contract", "labor law", "labour law"
]

# Track conversation context
_LAST_LEGAL_QUERY = ""
_CONVERSATION_CONTEXT = []

def detect_intent(text: str) -> str:
    """
    Detect if query is legal-related or casual
    
    Args:
        text: User input text
        
    Returns:
        'legal' or 'casual'
    """
    text = (text or "").strip().lower()
    
    if not text:
        return "casual"
    
    # Check for legal patterns
    for pattern in LEGAL_PATTERNS:
        if pattern in text:
            logger.info(f"Legal pattern detected: {pattern}")
            return "legal"
    
    # Check for legal keywords
    for word in LEGAL_KEYWORDS:
        if word in text:
            logger.info(f"Legal keyword detected: {word}")
            return "legal"
    
    return "casual"


def is_follow_up(text: str) -> bool:
    """
    Check if this is a follow-up to previous query (yes, continue, more, etc.)
    
    Args:
        text: User input text
        
    Returns:
        True if follow-up, False otherwise
    """
    lowered = (text or "").strip().lower()
    if not lowered:
        return False
    
    # Remove punctuation and split into tokens
    tokens = [t for t in lowered.replace("؟", " ").replace("!", " ").replace(".", " ").split() if t]
    if not tokens:
        return False
    
    # Short follow-ups (yes, continue, more, etc.)
    if len(tokens) <= 3:
        if any(w in lowered for w in YES_WORDS + FOLLOW_UP_WORDS):
            return True
    
    return False


def handle_request(text: str) -> str:
    """
    Main request handler - routes query to appropriate processor
    
    Args:
        text: User input in any supported language
        
    Returns:
        Response text
    """
    global _LAST_LEGAL_QUERY, _CONVERSATION_CONTEXT
    
    logger.info(f"Handling request: {text[:60]}...")
    
    # Stage-1 normalization: Tunisian/Arabizi -> MSA Arabic
    translated_text = translate_tunisian_to_msa(text)

    # Lightweight extra normalization for intent detection
    formal_text = understand_slang_input(translated_text)
    
    # Store in conversation context
    _CONVERSATION_CONTEXT.append(text)
    if len(_CONVERSATION_CONTEXT) > 5:
        _CONVERSATION_CONTEXT.pop(0)
    
    # Check if this is a follow-up to previous legal query
    if is_follow_up(text) and _LAST_LEGAL_QUERY:
        logger.info("Detected follow-up to previous legal query")
        continuation_prompt = (
            f"السؤال السابق: {_LAST_LEGAL_QUERY}\n"
            f"سؤال المتابعة: {formal_text}\n"
            "أكمل الإجابة بشكل عملي وفق قانون الشغل التونسي."
        )
        response = generate_legal_answer(continuation_prompt)
        return response
    
    # Detect intent (legal or casual)
    intent = detect_intent(text)
    if intent != "legal":
        # Also try on normalized text
        intent = detect_intent(formal_text)
    
    if intent == "legal":
        logger.info("LEGAL query detected - using legal model")
        _LAST_LEGAL_QUERY = formal_text
        response = generate_legal_answer(formal_text)
        return response
    else:
        # Casual response - encourage legal questions
        logger.info("CASUAL query - not legal related")
        casual_response = (
            "نجم نعاونك في حاجة قانونية ولاّ؟ 🇹🇳\n"
            "Can I help you with a legal question?\n"
            "Je peux t'aider avec une question légale?"
        )
        return casual_response