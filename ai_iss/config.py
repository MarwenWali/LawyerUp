# Tunisian Arabic Fine-tuning Configuration (STABLE VERSION)

import torch
from transformers import AutoTokenizer

# ============================================================================
# TOKENIZER CONFIGURATION (FIXED)
# ============================================================================

def setup_arabic_tokenizer(model_name: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)

    # 🔥 CRITICAL FIXES
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    return tokenizer

# ============================================================================
# MODEL CONFIGURATION (FIXED FOR RTX 3050)
# ============================================================================

DEVICE_MAP = "auto"

# 🔥 IMPORTANT: use float32 to avoid NaN
TORCH_DTYPE = torch.float32

MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

# ============================================================================
# DATASET CONFIGURATION
# ============================================================================

DATASET_PATH = "data/tunisian_legal.json"

# 🔥 IMPORTANT: MATCH TRAINING WITH INFERENCE
def format_example_for_arabic(example):
    input_text = example["input"]
    output_text = example["output"]

    return f"""### Instruction:
{input_text}

### Response:
{output_text}"""

# ============================================================================
# TRAINING CONFIG (STABLE)
# ============================================================================

TRAINING_CONFIG = {
    "output_dir": "./legal-model",

    "per_device_train_batch_size": 1,
    "gradient_accumulation_steps": 4,

    "learning_rate": 2e-5,
    "lr_scheduler_type": "cosine",
    "warmup_ratio": 0.1,

    "num_train_epochs": 4,

    "optim": "adamw_torch",
    "weight_decay": 0.01,
    "max_grad_norm": 1.0,

    # 🔥 VERY IMPORTANT
    "fp16": False,
    "bf16": False,

    "logging_steps": 10,
    "save_steps": 100,
    "save_total_limit": 2,

    "report_to": "none",

    "remove_unused_columns": False,

    "gradient_checkpointing": True,
}

# ============================================================================
# MODEL LOAD CONFIG
# ============================================================================

MODEL_CONFIG = {
    "device_map": DEVICE_MAP,
    "torch_dtype": TORCH_DTYPE,
}

# ============================================================================
# PREPROCESSING CONFIG (REQUIRED BY train.py)
# ============================================================================

PREPROCESSING_CONFIG = {
    "max_length": 512,
    "truncation": True,
    "add_special_tokens": True,
}

# ============================================================================
# GENERATION CONFIG (🔥 NEW - VERY IMPORTANT)
# ============================================================================

GENERATION_CONFIG = {
    "max_new_tokens": 100,

    # 🔥 STABLE GENERATION
    "do_sample": False,      # avoids NaN
    "temperature": 0.7,
    "top_p": 0.9,

    "pad_token_id": None,   # will be set dynamically
}