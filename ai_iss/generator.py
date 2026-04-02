"""
Answer generation module for Tunisian Arabic Legal Assistant
Loads fine-tuned model and generates responses
"""

from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Attempt to import slang converter, but make it optional
try:
    from slang_converter import convert_to_slang, add_tunisian_flavor, understand_slang_input
    HAS_SLANG_CONVERTER = True
except ImportError:
    HAS_SLANG_CONVERTER = False
    logger.warning("slang_converter not available, using basic text processing")

# Model paths to try (in order of preference)
MODEL_PATHS = [
    os.path.join(os.getcwd(), "legal-model"),  # Primary: newly fine-tuned model
    os.path.join(os.getcwd(), "models", "legal-model"),  # Fallback: old location
]

# Device configuration
def get_device():
    """Determine the best device to use (GPU if available, otherwise CPU)"""
    if torch.cuda.is_available():
        device = "cuda"
        logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
        try:
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"GPU Memory: {gpu_memory:.1f} GB")
        except:
            pass
    else:
        device = "cpu"
        logger.info("Using CPU (GPU not available)")
    
    return device

# Global model and tokenizer (loaded once)
_model = None
_tokenizer = None
_device = None


def _contains_cjk(text: str) -> bool:
    """Detect Chinese/Japanese/Korean Unified Ideographs in text."""
    if not text:
        return False
    return re.search(r"[\u4e00-\u9fff]", text) is not None

def load_model(model_path: Optional[str] = None, force_cpu: bool = False):
    """
    Load model and tokenizer
    
    Args:
        model_path: Custom path to model (if None, tries default paths)
        force_cpu: Force CPU usage even if GPU available
        
    Returns:
        Tuple of (tokenizer, model, device)
    """
    global _model, _tokenizer, _device
    
    if _model is not None and _tokenizer is not None:
        return _tokenizer, _model, _device
    
    # Find model path
    if model_path is None:
        model_path = None
        for path in MODEL_PATHS:
            if os.path.exists(path):
                model_path = path
                logger.info(f"Found model at: {model_path}")
                break
    
    if model_path is None:
        raise ValueError(f"Model not found in any of: {MODEL_PATHS}")
    
    # Determine device
    _device = "cpu" if force_cpu else get_device()
    
    # Load tokenizer
    logger.info(f"Loading tokenizer from {model_path}...")
    _tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
    
    # Load model
    logger.info(f"Loading model from {model_path}...")
    try:
        # Try with auto device map first
        _model = AutoModelForCausalLM.from_pretrained(
            model_path,
            local_files_only=True,
            device_map="auto" if _device == "cuda" else "cpu",
            dtype=torch.float16 if _device == "cuda" else torch.float32,
        )
    except Exception as e:
        logger.warning(f"Auto device load failed: {e}, trying standard load...")
        _model = AutoModelForCausalLM.from_pretrained(
            model_path,
            local_files_only=True,
            dtype=torch.float32
        )
        if _device == "cuda":
            _model = _model.to(_device)
    
    _model.eval()
    logger.info("✓ Model loaded successfully!")
    
    return _tokenizer, _model, _device

def generate_answer(text: str, max_tokens: int = 256) -> str:
    """
    Generate answer for Tunisian Arabic query
    
    Args:
        text: User question in any supported language
        max_tokens: Maximum tokens to generate
        
    Returns:
        Generated answer
    """
    # Load model if not already loaded
    tokenizer, model, device = load_model()
    
    # Convert slang input to formal Arabic if converter available
    if HAS_SLANG_CONVERTER:
        formal_text = understand_slang_input(text)
    else:
        formal_text = text
    
    # Keep inference format aligned with the format used during training.
    prompt = f"""### Instruction:
{formal_text}

### Response:
"""
    
    # Tokenize
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    ).to(device)
    
    # Generate
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_length=min(2048, inputs["input_ids"].shape[1] + max_tokens),
            do_sample=False,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )
    
    # Decode
    result = tokenizer.decode(output[0], skip_special_tokens=True)
    
    # Extract response part
    if "### Response:" in result:
        response = result.split("### Response:")[-1].strip()
    else:
        response = result.replace(prompt, "").strip()

    # If model drifts to CJK despite non-CJK user input, retry with a stricter instruction.
    if _contains_cjk(response) and not _contains_cjk(formal_text):
        strict_prompt = f"""### Instruction:
{formal_text}

### Response:
Respond only in the same language as the user (Darija/Arabic/French/English)."""
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
        if "### Response:" in strict_result:
            response = strict_result.split("### Response:")[-1].strip()
        else:
            response = strict_result.replace(strict_prompt, "").strip()
    
    # Fallback if empty
    if not response:
        response = "نفهم سؤالك القانوني. رجاء تفضل بتوضيح المزيد."
    
    # Convert to Tunisian slang if converter available
    if HAS_SLANG_CONVERTER:
        response = add_tunisian_flavor(response)
    
    return response