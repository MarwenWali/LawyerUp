"""
Fine-tuning script for Tunisian Arabic Legal Model.
Optimized for restricted Windows environments by avoiding datasets/pandas imports.
"""

import json
import logging
import math
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset
from transformers import (
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    get_scheduler,
)
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training

from config import (
    MODEL_NAME,
    DATASET_PATH,
    TRAINING_CONFIG,
    MODEL_CONFIG,
    format_example_for_arabic,
    setup_arabic_tokenizer,
    PREPROCESSING_CONFIG,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class JsonPromptDataset(Dataset):
    """Simple tokenized dataset for causal language modeling."""

    def __init__(self, examples, tokenizer, max_length):
        self.samples = []

        for example in examples:
            prompt = format_example_for_arabic(example)
            encoded = tokenizer(
                prompt + tokenizer.eos_token,
                truncation=True,
                max_length=max_length,
                padding="max_length",
                return_tensors="pt",
            )

            input_ids = encoded["input_ids"].squeeze(0)
            attention_mask = encoded["attention_mask"].squeeze(0)
            labels = input_ids.clone()

            # Ignore padding tokens in the loss.
            labels[attention_mask == 0] = -100

            self.samples.append(
                {
                    "input_ids": input_ids,
                    "attention_mask": attention_mask,
                    "labels": labels,
                }
            )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]


def load_examples_from_json(dataset_path: Path):
    with dataset_path.open("r", encoding="utf-8") as f:
        raw_data = json.load(f)

    if not isinstance(raw_data, list):
        raise ValueError(f"Expected a list of examples in {dataset_path}")

    examples = []
    for item in raw_data:
        if isinstance(item, dict) and "input" in item and "output" in item:
            examples.append(item)

    if not examples:
        raise ValueError(
            f"No valid training examples found in {dataset_path}. "
            "Expected items with 'input' and 'output' keys."
        )

    return examples


def attach_lora_adapters(model):
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
    return model


def run_manual_training_loop(model, dataloader, optimizer, scheduler, device):
    grad_accum_steps = TRAINING_CONFIG["gradient_accumulation_steps"]
    num_epochs = int(TRAINING_CONFIG["num_train_epochs"])
    logging_steps = int(TRAINING_CONFIG["logging_steps"])
    save_steps = int(TRAINING_CONFIG["save_steps"])
    max_grad_norm = float(TRAINING_CONFIG["max_grad_norm"])

    output_dir = Path(TRAINING_CONFIG["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    model.train()
    optimizer.zero_grad()

    optimizer_step = 0
    running_loss = 0.0
    recent_loss = 0.0

    for epoch in range(num_epochs):
        logger.info(f"Epoch {epoch + 1}/{num_epochs} started")

        for step, batch in enumerate(dataloader, start=1):
            batch = {k: v.to(device) for k, v in batch.items()}

            outputs = model(**batch)
            loss = outputs.loss
            running_loss += loss.item()
            recent_loss += loss.item()

            (loss / grad_accum_steps).backward()

            should_step = (step % grad_accum_steps == 0) or (step == len(dataloader))
            if should_step:
                torch.nn.utils.clip_grad_norm_(
                    (p for p in model.parameters() if p.requires_grad),
                    max_grad_norm,
                )
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()
                optimizer_step += 1

                if logging_steps > 0 and optimizer_step % logging_steps == 0:
                    avg_recent_loss = recent_loss / max(logging_steps, 1)
                    logger.info(
                        f"Step {optimizer_step}: avg_loss={avg_recent_loss:.4f}, "
                        f"lr={scheduler.get_last_lr()[0]:.6g}"
                    )
                    recent_loss = 0.0

                if save_steps > 0 and optimizer_step % save_steps == 0:
                    checkpoint_dir = output_dir / f"checkpoint-{optimizer_step}"
                    checkpoint_dir.mkdir(parents=True, exist_ok=True)
                    model.save_pretrained(checkpoint_dir)
                    logger.info(f"Checkpoint saved: {checkpoint_dir}")

    avg_loss = running_loss / max(len(dataloader) * num_epochs, 1)
    return avg_loss

def main():
    logger.info("=" * 80)
    logger.info("Starting Stage-2 Legal Model Fine-tuning")
    logger.info("=" * 80)
    
    # ========================================================================
    # 1. LOAD DATASET
    # ========================================================================
    dataset_path = Path(DATASET_PATH)
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {dataset_path}. Run prepare_two_stage_data.py first."
        )

    logger.info(f"Loading dataset from {DATASET_PATH}")
    examples = load_examples_from_json(dataset_path)
    logger.info(f"Dataset loaded. Train size: {len(examples)}")
    
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

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

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
        model = attach_lora_adapters(model)
    else:
        logger.info(f"Using standard loading on device: {device}")
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=MODEL_CONFIG["torch_dtype"],
            attn_implementation="eager",
        )
        # LoRA on full-precision base model keeps the number of trainable params small.
        model = attach_lora_adapters(model)
        model.to(device)

    # Enable gradient checkpointing for memory efficiency
    if TRAINING_CONFIG.get("gradient_checkpointing", False):
        model.gradient_checkpointing_enable()
        if hasattr(model, "enable_input_require_grads"):
            model.enable_input_require_grads()
    model.config.use_cache = False

    # ========================================================================
    # 4. BUILD DATALOADER + OPTIMIZER/SCHEDULER
    # ========================================================================
    logger.info("Tokenizing dataset")
    train_dataset = JsonPromptDataset(
        examples=examples,
        tokenizer=tokenizer,
        max_length=PREPROCESSING_CONFIG["max_length"],
    )
    logger.info(f"Tokenized dataset size: {len(train_dataset)}")

    train_dataloader = DataLoader(
        train_dataset,
        batch_size=TRAINING_CONFIG["per_device_train_batch_size"],
        shuffle=True,
    )

    optimizer = torch.optim.AdamW(
        (p for p in model.parameters() if p.requires_grad),
        lr=TRAINING_CONFIG["learning_rate"],
        weight_decay=TRAINING_CONFIG["weight_decay"],
    )

    num_epochs = int(TRAINING_CONFIG["num_train_epochs"])
    grad_accum_steps = int(TRAINING_CONFIG["gradient_accumulation_steps"])
    updates_per_epoch = math.ceil(len(train_dataloader) / max(grad_accum_steps, 1))
    total_training_steps = max(updates_per_epoch * num_epochs, 1)
    warmup_steps = int(total_training_steps * float(TRAINING_CONFIG["warmup_ratio"]))

    scheduler = get_scheduler(
        name=TRAINING_CONFIG["lr_scheduler_type"],
        optimizer=optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_training_steps,
    )

    logger.info(
        f"Training setup complete (steps={total_training_steps}, warmup={warmup_steps})"
    )

    # ========================================================================
    # 5. TRAINING
    # ========================================================================
    logger.info("Starting training...")
    logger.info("This may take several hours depending on your GPU/CPU")

    final_loss = run_manual_training_loop(
        model=model,
        dataloader=train_dataloader,
        optimizer=optimizer,
        scheduler=scheduler,
        device=device,
    )

    logger.info("Training completed!")
    logger.info(f"Training loss: {final_loss:.6f}")

    # ========================================================================
    # 6. SAVE MODEL AND TOKENIZER
    # ========================================================================
    logger.info("Saving fine-tuned model and tokenizer...")
    model.save_pretrained(TRAINING_CONFIG["output_dir"])
    tokenizer.save_pretrained(TRAINING_CONFIG["output_dir"])
    
    logger.info("=" * 80)
    logger.info(f"✓ Model saved to: {TRAINING_CONFIG['output_dir']}")
    logger.info("✓ Ready for stage-2 legal inference on normalized Arabic queries!")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()