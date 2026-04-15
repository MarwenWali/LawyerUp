"""
Train stage-1 model: Tunisian Darija/Arabizi -> Modern Standard Arabic (MSA).
"""

import json
import logging
import math
import shutil
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    get_scheduler,
)

from config import (
    TRANSLATION_DATASET_PATH,
    TRANSLATION_MODEL_NAME,
    TRANSLATION_TRAINING_CONFIG,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_SOURCE_LENGTH = 192
MAX_TARGET_LENGTH = 192
TASK_PREFIX = "حوّل من التونسية إلى العربية الفصحى: "


class TranslationDataset(Dataset):
    """Tokenized in-memory dataset for seq2seq translation training."""

    def __init__(self, examples, tokenizer):
        self.samples = []

        for example in examples:
            source_text = TASK_PREFIX + example["input"].strip()
            target_text = example["output"].strip()

            source = tokenizer(
                source_text,
                max_length=MAX_SOURCE_LENGTH,
                truncation=True,
                padding="max_length",
                return_tensors="pt",
            )
            target = tokenizer(
                text_target=target_text,
                max_length=MAX_TARGET_LENGTH,
                truncation=True,
                padding="max_length",
                return_tensors="pt",
            )

            input_ids = source["input_ids"].squeeze(0)
            attention_mask = source["attention_mask"].squeeze(0)
            labels = target["input_ids"].squeeze(0)

            # Ignore padding in loss.
            labels[labels == tokenizer.pad_token_id] = -100

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


def load_translation_tokenizer(model_name: str):
    """Load tokenizer with clear fallback behavior for SentencePiece models (mT5)."""
    try:
        return AutoTokenizer.from_pretrained(model_name, use_fast=True)
    except Exception as fast_exc:
        err_text = str(fast_exc).lower()
        logger.warning("Fast tokenizer load failed: %s", fast_exc)

        try:
            return AutoTokenizer.from_pretrained(model_name, use_fast=False)
        except Exception as slow_exc:
            slow_text = str(slow_exc).lower()
            if (
                "sentencepiece" in err_text
                or "sentencepiece" in slow_text
                or "protobuf" in err_text
                or "protobuf" in slow_text
                or "spiece.model" in err_text
                or "spiece.model" in slow_text
                or "tiktoken" in err_text
            ):
                raise RuntimeError(
                    "This translator model requires SentencePiece and Protobuf. "
                    "Install both in the same Python environment you use to train:\n"
                    "  python -m pip install sentencepiece protobuf\n"
                    "Then run training again."
                ) from slow_exc
            raise


def load_examples_from_json(dataset_path: Path):
    with dataset_path.open("r", encoding="utf-8") as f:
        raw_data = json.load(f)

    if not isinstance(raw_data, list):
        raise ValueError(f"Expected a list of examples in {dataset_path}")

    examples = []
    for item in raw_data:
        if not isinstance(item, dict):
            continue
        inp = (item.get("input") or "").strip()
        out = (item.get("output") or "").strip()
        if inp and out:
            examples.append({"input": inp, "output": out})

    if not examples:
        raise ValueError(
            f"No valid translation examples found in {dataset_path}. "
            "Expected objects with 'input' and 'output'."
        )

    return examples


def cleanup_old_checkpoints(output_dir: Path, keep_last: int):
    if keep_last <= 0:
        return

    checkpoints = []
    for p in output_dir.glob("checkpoint-*"):
        if p.is_dir():
            try:
                step = int(p.name.split("-")[-1])
            except ValueError:
                continue
            checkpoints.append((step, p))

    checkpoints.sort(key=lambda x: x[0])
    stale = checkpoints[:-keep_last]
    for _, path in stale:
        shutil.rmtree(path, ignore_errors=True)


def run_manual_training_loop(
    model,
    dataloader,
    optimizer,
    scheduler,
    device,
    trainable_params,
    tokenizer,
    output_dir,
):
    num_epochs = int(TRANSLATION_TRAINING_CONFIG["num_train_epochs"])
    grad_accum_steps = int(TRANSLATION_TRAINING_CONFIG["gradient_accumulation_steps"])
    logging_steps = int(TRANSLATION_TRAINING_CONFIG["logging_steps"])
    save_steps = int(TRANSLATION_TRAINING_CONFIG["save_steps"])
    save_total_limit = int(TRANSLATION_TRAINING_CONFIG["save_total_limit"])

    model.train()
    optimizer.zero_grad()

    update_step = 0
    total_loss = 0.0
    recent_loss = 0.0

    for epoch in range(num_epochs):
        logger.info("Epoch %d/%d started", epoch + 1, num_epochs)

        for step, batch in enumerate(dataloader, start=1):
            batch = {k: v.to(device) for k, v in batch.items()}
            outputs = model(**batch)
            loss = outputs.loss

            total_loss += loss.item()
            recent_loss += loss.item()

            (loss / grad_accum_steps).backward()

            should_step = (step % grad_accum_steps == 0) or (step == len(dataloader))
            if should_step:
                torch.nn.utils.clip_grad_norm_(trainable_params, 1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()
                update_step += 1

                if logging_steps > 0 and update_step % logging_steps == 0:
                    avg_recent = recent_loss / max(logging_steps, 1)
                    logger.info(
                        "Step %d: avg_loss=%.4f, lr=%.6g",
                        update_step,
                        avg_recent,
                        scheduler.get_last_lr()[0],
                    )
                    recent_loss = 0.0

                if save_steps > 0 and update_step % save_steps == 0:
                    ckpt = output_dir / f"checkpoint-{update_step}"
                    ckpt.mkdir(parents=True, exist_ok=True)
                    model.save_pretrained(str(ckpt))
                    tokenizer.save_pretrained(str(ckpt))
                    cleanup_old_checkpoints(output_dir, keep_last=save_total_limit)
                    logger.info("Checkpoint saved: %s", ckpt)

    avg_loss = total_loss / max(len(dataloader) * num_epochs, 1)
    return avg_loss


def main() -> None:
    logger.info("=" * 80)
    logger.info("Starting Stage-1 Translator Training")
    logger.info("=" * 80)

    dataset_path = Path(TRANSLATION_DATASET_PATH)
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Translation dataset not found: {dataset_path}. Run prepare_two_stage_data.py first."
        )

    logger.info("Loading dataset from %s", dataset_path)
    examples = load_examples_from_json(dataset_path)
    logger.info("Dataset loaded. Train size: %s", len(examples))

    logger.info("Loading tokenizer/model: %s", TRANSLATION_MODEL_NAME)
    tokenizer = load_translation_tokenizer(TRANSLATION_MODEL_NAME)
    model = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATION_MODEL_NAME)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.config.use_cache = False

    train_dataset = TranslationDataset(examples=examples, tokenizer=tokenizer)
    train_dataloader = DataLoader(
        train_dataset,
        batch_size=TRANSLATION_TRAINING_CONFIG["per_device_train_batch_size"],
        shuffle=True,
    )

    trainable_params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(
        trainable_params,
        lr=TRANSLATION_TRAINING_CONFIG["learning_rate"],
        weight_decay=TRANSLATION_TRAINING_CONFIG["weight_decay"],
    )

    num_epochs = int(TRANSLATION_TRAINING_CONFIG["num_train_epochs"])
    grad_accum_steps = int(TRANSLATION_TRAINING_CONFIG["gradient_accumulation_steps"])
    updates_per_epoch = math.ceil(len(train_dataloader) / max(grad_accum_steps, 1))
    total_training_steps = max(updates_per_epoch * num_epochs, 1)
    warmup_steps = int(total_training_steps * float(TRANSLATION_TRAINING_CONFIG["warmup_ratio"]))

    scheduler = get_scheduler(
        name="cosine",
        optimizer=optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_training_steps,
    )

    output_dir = Path(TRANSLATION_TRAINING_CONFIG["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(
        "Training setup complete (device=%s, steps=%d, warmup=%d)",
        device,
        total_training_steps,
        warmup_steps,
    )
    logger.info("Starting stage-1 training...")
    final_loss = run_manual_training_loop(
        model=model,
        dataloader=train_dataloader,
        optimizer=optimizer,
        scheduler=scheduler,
        device=device,
        trainable_params=trainable_params,
        tokenizer=tokenizer,
        output_dir=output_dir,
    )
    logger.info("Training completed. Final average loss: %.6f", final_loss)

    logger.info("Saving translator model to %s", output_dir)
    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    logger.info("=" * 80)
    logger.info("Translator training complete")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
