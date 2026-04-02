# 🇹🇳 Tunisian Arabic Legal AI Assistant

A fine-tuned language model specialized for understanding and responding to legal questions in **Tunisian Arabic (Darija)**, **Modern Standard Arabic (MSA)**, **French**, and **English**.

## Overview

This project fine-tunes a TinyLlama-1.1B model on Tunisian legal domain data to create a conversational AI assistant that understands:
- **Darija** (Tunisian Arabic) with transliteration: `chnowa 7a9i fil travail?`
- **Modern Standard Arabic**: `ما هي حقوقي في العمل؟`
- **French**: `Quels sont mes droits du travail?`
- **English**: `What are my labor rights in Tunisia?`

## Features

✅ **Multilingual Support** - Handles Darija, MSA, French, and English
✅ **Domain-Specific** - Fine-tuned on Tunisian labor law
✅ **Memory-Efficient** - Uses TinyLlama (1.1B) for GPU/CPU compatibility
✅ **Conversational** - Maintains context for follow-up questions
✅ **Production-Ready** - Includes inference and evaluation scripts

## Project Structure

```
ai_iss/
├── config.py              # Training configuration & hyperparameters
├── train.py               # Main training script
├── inference.py           # Inference utilities for single model usage
├── generator.py           # Answer generation module
├── router.py              # Request routing & intent detection
├── app.py                 # Interactive CLI interface
├── test.py                # Comprehensive testing suite
├── format_data.py         # Dataset analysis & processing
├── data/
│   └── tunisian_legal.json # Training dataset
├── legal-model/           # Fine-tuned model directory
│   ├── config.json
│   ├── tokenizer.json
│   ├── model.safetensors
│   └── ...
└── models/                # Alternative model location
    └── legal-model/       # Fallback location

```

## Installation

### Prerequisites
- Python 3.8+
- CUDA 11.8+ (for GPU, optional)
- 6GB+ VRAM (for RTX 3050+) or can run on CPU

### Setup Virtual Environment

```bash
# Navigate to project directory
cd ai_iss

# Create virtual environment
python -m venv mistral_env

# Activate (Windows)
mistral_env\Scripts\Activate.ps1

# Activate (Linux/Mac)
source mistral_env/bin/activate
```

### Install Dependencies

```bash
pip install torch transformers datasets trl bitsandbytes
```

## Usage

### 1. Train the Model

Fine-tune on your Tunisian legal dataset:

```bash
# Activate environment
mistral_env\Scripts\Activate.ps1

# Run training
python train.py
```

**Training will:**
- Load dataset from `data/tunisian_legal.json`
- Fine-tune TinyLlama using SFT (Supervised Fine-Tuning)
- Save model to `./legal-model/`
- Save tensorboard logs to `./logs/`

**Expected duration:**
- RTX 3050: ~2-4 hours for 5 epochs
- CPU: ~12-24 hours

### 2. Interactive CLI Mode

Start the interactive assistant:

```bash
python app.py
```

**Example conversation:**
```
أنت / You: chnowa 7a9i fil travail fi tounes?
🤖 المساعد / Assistant: 
في القانون التونسي... [response in Darija/Arabic]

أنت / You: What about overtime?
🤖 المساعد / Assistant:
Regarding overtime in Tunisia... [response in English]
```

### 3. Test the Model

Run comprehensive evaluation:

```bash
# Standard test suite
python test.py

# Interactive testing mode
python test.py --interactive
```

### 4. Dataset Analysis

Analyze your training dataset:

```python
from format_data import analyze_dataset, validate_dataset

# Analyze dataset
stats = analyze_dataset("data/tunisian_legal.json")

# Validate format
is_valid = validate_dataset("data/tunisian_legal.json")
```

## Data Format

The training data should be JSON with the following structure:

```json
[
  {
    "instruction": "Answer in the same language as the user",
    "input": "chnowa 7a9i fil travail?",
    "output": "حقوقك في العمل تشمل... [response in Darija/Arabic]"
  },
  {
    "instruction": "Answer in the same language as the user",
    "input": "Quels sont mes droits du travail en Tunisie?",
    "output": "Selon le code du travail tunisien..."
  }
]
```

**Key Points:**
- `instruction`: System prompt (keep consistent)
- `input`: Question in any supported language
- `output`: Answer in the same language as input
- Include mix of Darija, MSA, French, and English for multilingual capability

## Training Configuration

Edit `config.py` to customize:

```python
# Model
MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"  # Base model

# Training hyperparameters
num_train_epochs = 5
learning_rate = 2e-5
per_device_train_batch_size = 1
gradient_accumulation_steps = 4  # Effective batch size: 16

# Hardware
device_map = "auto"  # Auto GPU allocation
torch_dtype = torch.float16  # Memory efficient
gradient_checkpointing = True  # Memory savings
```

## GPU Memory Optimization

For devices with <6GB VRAM:

```python
# In train.py, the script automatically uses 4-bit quantization
# Edit force_4bit = True to manually enable:

model = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
)
```

## Architecture

### Components

1. **Config Module** (`config.py`)
   - Arabic-optimized tokenizer setup
   - Training hyperparameters
   - Model loading configuration

2. **Training Module** (`train.py`)
   - SFT trainer initialization
   - Model and tokenizer loading
   - Training loop and checkpointing
   - Model saving

3. **Generation Module** (`generator.py`)
   - Model loading (singleton pattern)
   - Answer generation with temperature control
   - Device detection (GPU/CPU)
   - Optional slang conversion

4. **Router Module** (`router.py`)
   - Intent detection (legal vs casual)
   - Legal keyword matching
   - Conversation context tracking
   - Request routing

5. **App Module** (`app.py`)
   - Interactive CLI interface
   - User I/O handling
   - Multi-language support display

## Multilingual Support Detail

### Language Detection
The system automatically detects and responds in the user's language:

- **Darija Detection**: Numerals (7, 3, 2, etc.), French mixed in Arabic context
- **MSA Detection**: Arabic script without transliteration
- **French Detection**: Latin script with French vocabulary
- **English Detection**: English vocabulary and ASCII

### Response Format
```
### Instruction:
Answer in the same language as the user

### Question:
[User question]

### Answer:
[Model generates response in same language]
```

## Evaluation & Testing

### Test Queries (Built-in)

```python
test_queries = [
    {
        'query': 'chnowa 7a9i fil travail?',
        'expected_keywords': ['droit', 'travail', 'contrat']
    },
    {
        'query': 'ما هي حقوقي في العمل؟',
        'expected_keywords': ['حقوق', 'عمل']
    }
]
```

### Metrics

The system evaluates based on:
- ✓ Language preservation (response in same language)
- ✓ Keyword presence (legal terms in response)
- ✓ Response coherence (meaningful legal advice)
- ✓ Context relevance (based on conversation history)

## Performance Notes

### Model Size
- **Base Model**: TinyLlama-1.1B (475MB)
- **Fine-tuned weights**: ~500MB additional
- **Total VRAM needed**: 2-4GB (with quantization)

### Inference Speed
- **GPU (RTX 3050)**: ~50-100 ms per token
- **CPU**: ~200-500 ms per token
- **Average response**: 3-5 seconds

### Training Efficiency
- **Gradient Accumulation**: 4 steps (effective batch 16)
- **Mixed Precision**: float16 on GPU
- **Gradient Checkpointing**: Enabled for memory savings
- **Packing**: Sequences packed for efficiency

## Troubleshooting

### Issue: CUDA Out of Memory
```python
# Solution: Enable 4-bit quantization in train.py
load_in_4bit = True

# Or reduce batch size in config.py
per_device_train_batch_size = 1
gradient_accumulation_steps = 8
```

### Issue: Model not loading
```bash
# Check model directory exists
ls legal-model/

# Verify model files
ls legal-model/model.safetensors
ls legal-model/tokenizer.json

# Try moving to expected location
mv legal-model models/legal-model
```

### Issue: Slow inference on CPU
```python
# Use smaller max_tokens in generator.py
generate_answer(text, max_tokens=128)  # Default is 256
```

## Extending the Model

### Add More Training Data

```python
# Add to data/tunisian_legal.json
{
    "instruction": "Answer in the same language as the user",
    "input": "Your new question here",
    "output": "Your answer in the same language"
}

# Re-run training
python train.py
```

### Fine-tune for Different Domains

Change the dataset and adjust prompts:

```python
# config.py
DATASET_PATH = "data/your_domain_data.json"

# generator.py - Adjust system prompt if needed
prompt = f"""### Instruction:
Answer in domain-specific manner

### Question:
{user_query}

### Answer:"""
```

## Performance Tips

1. **Batch Size**: Use gradient accumulation instead of large batch sizes for limited VRAM
2. **Learning Rate**: Lower (2e-5) for domain-specific fine-tuning
3. **Epochs**: 3-5 epochs usually sufficient for good convergence
4. **Logging**: Save checkpoints frequently (every 100 steps)
5. **Evaluation**: Use diverse test queries across all language variants

## References

- [TinyLlama Model Card](https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0)
- [Transformers Documentation](https://huggingface.co/docs/transformers/)
- [TRL (Transformer Reinforcement Learning)](https://github.com/huggingface/trl)
- [Tunisian Arabic Resources](https://www.swissphone.ch/en/tutoral-tunisian-dialect/)

## License

This project and trained models are provided for educational and research purposes.

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Verify dataset format with `validate_dataset()`
3. Run `test.py` to verify model functionality
4. Check VRAM/device availability in `generator.py` logs

---

**Happy fine-tuning! 🇹🇳 بالتوفيق!**
