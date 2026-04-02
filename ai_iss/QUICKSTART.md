# 🚀 Quick Start Guide

## 5-Minute Setup

### Windows (PowerShell)

```powershell
# 1. Run setup script
.\setup.ps1

# 2. Activate environment
.\mistral_env\Scripts\Activate.ps1

# 3. Start interactive mode
python app.py
```

### Linux/Mac (Bash)

```bash
# 1. Make setup script executable
chmod +x setup.sh

# 2. Run setup
./setup.sh

# 3. Activate environment
source mistral_env/bin/activate

# 4. Start interactive mode
python app.py
```

## Commands Quick Reference

```bash
# Activate environment (Windows)
.\mistral_env\Scripts\Activate.ps1

# Activate environment (Linux/Mac)
source mistral_env/bin/activate

# Run interactive assistant
python app.py

# Train the model
python train.py

# Test the model
python test.py

# Interactive testing
python test.py --interactive

# Analyze dataset
python -c "from format_data import analyze_dataset; analyze_dataset()"

# Validate dataset
python -c "from format_data import validate_dataset; validate_dataset()"
```

## What's Been Optimized

### ✅ Configuration (`config.py`)

- Arabic-specific tokenizer setup
- Optimized hyperparameters for RTX 3050
- Gradient checkpointing for memory efficiency
- Proper learning rate for domain fine-tuning

### ✅ Training (`train.py`)

- Automated device detection (GPU/CPU)
- 4-bit quantization for memory-constrained devices
- Comprehensive logging
- Auto model/tokenizer saving
- Error handling and recovery

### ✅ Inference (`generator.py`)

- Automatic model loading (singleton pattern)
- Device detection and optimization
- Support for GPU and CPU
- Temperature control for response quality
- Optional slang conversion

### ✅ Routing (`router.py`)

- Intent detection (legal vs casual)
- Multilingual keyword matching (Darija, MSA, French, English)
- Conversation context tracking
- Follow-up question handling
- Graceful fallback if slang converter unavailable

### ✅ CLI Interface (`app.py`)

- Multi-language display
- Proper keyboard interrupt handling
- Clear user instructions
- Error messages with context

### ✅ Testing (`test.py`)

- Comprehensive evaluation framework
- Multi-language test queries
- Keyword verification
- Interactive testing mode
- Tokenizer coverage testing

### ✅ Data Processing (`format_data.py`)

- Dataset analysis and statistics
- Language distribution detection
- Dataset validation
- Data augmentation utilities

## Expected Performance

| Hardware        | Training Time | Inference Speed  |
| --------------- | ------------- | ---------------- |
| RTX 3050 (6GB)  | 2-4 hours     | 50-100 ms/token  |
| RTX 4090 (24GB) | 30-60 min     | 10-20 ms/token   |
| CPU (16GB RAM)  | 12-24 hours   | 200-500 ms/token |

## Supports These Languages/Dialects

```
✅ Tunisian Arabic (Darija) with Transliteration
   "chnowa 7a9i fil travail?" → What are my labor rights?

✅ Modern Standard Arabic (MSA)
   "ما هي حقوقي في العمل؟" → What are my rights at work?

✅ French
   "Quels sont mes droits du travail?" → What are my labor rights?

✅ English
   "What are my rights in Tunisia?" → Answers in English
```

## Common Issues & Solutions

### Issue: "Model not found"

```python
# Check if model exists
import os
print(os.path.exists("./legal-model"))

# If not, train first
# python train.py
```

### Issue: CUDA Out of Memory

```python
# Solution in train.py - uncomment 4-bit quantization
use_4bit = True  # Line ~70
```

### Issue: Slow on CPU

```python
# Reduce token generation
python -c "from generator import generate_answer; \
    generate_answer('your query', max_tokens=128)"
```

### Issue: Arabic characters not displaying

```bash
# Ensure UTF-8 encoding
chcp 65001  # Windows
# Linux/Mac uses UTF-8 by default
```

## File Organization

```
ai_iss/
├── 📄 README.md              # Full documentation
├── 📄 QUICKSTART.md          # This file
├── 📄 config.py              # ⚙️  Training config
├── 📄 train.py               # 🔧 Training script
├── 📄 inference.py           # 📊 Inference utilities
├── 📄 generator.py           # 🤖 Answer generation
├── 📄 router.py              # 🧭 Request routing
├── 📄 app.py                 # 💬 Interactive CLI
├── 📄 test.py                # ✅ Testing suite
├── 📄 format_data.py         # 📋 Data utilities
├── 📦 requirements.txt       # 📚 Dependencies
├── 🚀 setup.ps1              # Setup for Windows
├── 🚀 setup.sh               # Setup for Linux/Mac
├── 📁 data/
│   └── tunisian_legal.json   # Training dataset
└── 📁 legal-model/           # Fine-tuned model
    ├── config.json
    ├── tokenizer.json
    └── model.safetensors
```

## Training Your Model

### Step 1: Prepare Data

Your dataset should be in `data/tunisian_legal.json` with this format:

```json
[
  {
    "instruction": "Answer in the same language as the user",
    "input": "Question in any language",
    "output": "Answer in the same language"
  }
]
```

### Step 2: Validate Dataset

```bash
python -c "from format_data import validate_dataset; \
    print('Valid!' if validate_dataset() else 'Invalid')"
```

### Step 3: Train

```bash
python train.py
```

### Step 4: Test

```bash
python test.py
```

## Next Steps

1. **Prepare Data**: Ensure `data/tunisian_legal.json` has your Tunisian legal Q&A
2. **Train**: Run `python train.py` to fine-tune the model
3. **Test**: Use `python test.py` to verify quality
4. **Deploy**: Use `python app.py` for interactive use
5. **Evaluate**: Check training logs in `./logs/`

## Environment Variables (Optional)

```bash
# Set logging level
set LOG_LEVEL=INFO  # Windows
export LOG_LEVEL=INFO  # Linux/Mac

# Set number of epochs
set NUM_EPOCHS=5  # Windows
export NUM_EPOCHS=5  # Linux/Mac
```

## Getting Help

1. **Check README.md** for detailed documentation
2. **Run setup.ps1 or setup.sh** for automatic setup
3. **Review test.py** for example usage patterns
4. **Check config.py** for hyperparameter explanations

---

**Ready to train your Tunisian Arabic legal AI? Get started now! 🚀**
