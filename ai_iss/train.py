"""
Fine-tuning script for Tunisian Arabic Legal Model
Optimized for Darija (Tunisian Arabic) with multilingual support
"""

import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    BitsAndBytesConfig
)
from trl import SFTTrainer, SFTConfig
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
import logging
from config import (
    MODEL_NAME,
    DATASET_PATH,
    TRAINING_CONFIG,
    MODEL_CONFIG,
    format_example_for_arabic,
    setup_arabic_tokenizer,
    PREPROCESSING_CONFIG
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("=" * 80)
    logger.info("Starting Tunisian Arabic Fine-tuning")
    logger.info("=" * 80)
    
    # ========================================================================
    # 1. LOAD DATASET
    # ========================================================================
    logger.info(f"Loading dataset from {DATASET_PATH}")
    dataset = load_dataset("json", data_files=DATASET_PATH)
    logger.info(f"Dataset loaded. Train split size: {len(dataset['train'])}")
    
    # ========================================================================
    # 2. SETUP TOKENIZER (ARABIC-OPTIMIZED)
    # ========================================================================
    logger.info(f"Setting up tokenizer for: {MODEL_NAME}")
    tokenizer = setup_arabic_tokenizer(MODEL_NAME)
    logger.info(f"Tokenizer vocab size: {len(tokenizer)}")
    logger.info(f"Pad token: {tokenizer.pad_token_id}, EOS token: {tokenizer.eos_token_id}")
    
    # ========================================================================
    # 3. LOAD MODEL (WITH MEMORY OPTIMIZATIONS)
    # ========================================================================
    logger.info(f"Loading model: {MODEL_NAME}")
    
    # Check if 4-bit quantization should be used (for memory constraints)
    use_4bit = False
    try:
        import bitsandbytes
        if torch.cuda.is_available():
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"GPU Memory: {gpu_memory:.1f} GB")
            # Use 4-bit for GPUs with <6GB VRAM
            use_4bit = gpu_memory < 6
    except:
        pass
    
    if use_4bit:
        logger.info("Using 4-bit quantization for memory efficiency")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
        )
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            quantization_config=bnb_config,
            device_map=MODEL_CONFIG["device_map"],
            # FlashAttention2 requires an extra package that is commonly unavailable on Windows.
            # Use eager attention to keep training portable and stable.
            attn_implementation="eager",
        )

        # QLoRA: add trainable adapters on top of 4-bit base weights.
        model = prepare_model_for_kbit_training(model)
        lora_config = LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type=TaskType.CAUSAL_LM,
            target_modules=[
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
                "gate_proj",
                "up_proj",
                "down_proj",
            ],
        )
        model = get_peft_model(model, lora_config)
        model.print_trainable_parameters()
    else:
        logger.info("Using standard loading")
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            device_map=MODEL_CONFIG["device_map"],
            torch_dtype=MODEL_CONFIG["torch_dtype"],
            attn_implementation="eager",
        )
    
    # Enable gradient checkpointing for memory efficiency
    model.gradient_checkpointing_enable()
    
    # ========================================================================
    # 4. SETUP TRAINING ARGUMENTS
    # ========================================================================
    logger.info("Setting up training arguments")
    # With eager attention, avoid packed mode to prevent sample cross-contamination.
    training_args = SFTConfig(
        **TRAINING_CONFIG,
        max_length=PREPROCESSING_CONFIG["max_length"],
        packing=False,
    )
    
    # ========================================================================
    # 5. CREATE TRAINER
    # ========================================================================
    logger.info("Creating SFT Trainer for Tunisian Arabic")
    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=dataset["train"],
        args=training_args,
        formatting_func=format_example_for_arabic,
    )
    
    # ========================================================================
    # 6. TRAINING
    # ========================================================================
    logger.info("Starting training...")
    logger.info("This may take several hours depending on your GPU")
    
    train_result = trainer.train()
    
    logger.info(f"Training completed!")
    logger.info(f"Training loss: {train_result.training_loss}")
    
    # ========================================================================
    # 7. SAVE MODEL AND TOKENIZER
    # ========================================================================
    logger.info("Saving fine-tuned model and tokenizer...")
    trainer.save_model(TRAINING_CONFIG["output_dir"])
    tokenizer.save_pretrained(TRAINING_CONFIG["output_dir"])
    
    logger.info("=" * 80)
    logger.info(f"✓ Model saved to: {TRAINING_CONFIG['output_dir']}")
    logger.info("✓ Ready for inference on Tunisian Arabic queries!")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()