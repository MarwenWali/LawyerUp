# Tunisian Legal AI Assistant (Two-Stage)

This folder contains a two-stage legal assistant focused on Tunisian labor-law questions.

It supports:

- Tunisian Darija and Arabizi
- Modern Standard Arabic (MSA)
- French
- English

## How It Works

The app uses two stages in sequence.

1. Stage-1 translation
   - Converts Tunisian Darija or Arabizi input into normalized Arabic.
   - Uses a trained translator model when available.
   - Falls back to rule-based normalization if stage-1 output is invalid.

2. Stage-2 legal answering
   - Generates a legal response based on Tunisian labor-law data.
   - Applies quality checks for repetition and gibberish.
   - Falls back to retrieval when generation quality is low.

## Response Format

Legal answers are returned in a structured format:

- Legal basis
- Simple explanation
- Practical next steps

The Arabic output sections are:

- \"الاساس القانوني\"
- \"الشرح المبسط\"
- \"ماذا تفعل الان\"

## Current Project Layout

ai_iss/

- app.py
- router.py
- translator.py
- generator.py
- prepare_two_stage_data.py
- train_translator.py
- train.py
- train_two_stage.py
- evaluate_two_stage.py
- test.py
- config.py
- requirements.txt
- data/
  - tunisian_legal.json
  - translator_train.json
  - legal_train_ar.json
  - legal_train_from_dataset.json
- translator-model/ (generated)
- legal-model/ (generated)

## Setup

From the ai_iss folder:

Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Linux or macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you already use a workspace venv outside this folder, keep using that interpreter consistently.

## Run the Assistant

```bash
python app.py
```

Example prompts:

- chnowa 7a9i fil travail fi tounes?
- chnowa na3mel ken el patron taredni bla i3lem?
- What are my rights if my employer fires me without notice?
- Quels sont mes droits si je suis licencie sans preavis?

## Training Pipeline

### Step 1: Prepare stage datasets

```bash
python prepare_two_stage_data.py
```

This creates:

- data/translator_train.json
- data/legal_train_ar.json

### Step 2: Train stage-1 translator

```bash
python train_translator.py
```

Output:

- translator-model/

### Step 3: Train stage-2 legal model

```bash
python train.py
```

Output:

- legal-model/

### Run all stages in one command

```bash
python train_two_stage.py
```

Optional flags:

- --prepare-only
- --skip-translator
- --skip-legal
- --python PATH_TO_PYTHON

## Evaluation and Testing

```bash
python test.py
python evaluate_two_stage.py
python evaluate_two_stage.py --limit 50
```

## Notes About Quality and Stability

- Stage-1 now includes invalid-output protection (for example extra token artifacts).
- Stage-2 includes repetition and gibberish detection.
- When generation is poor, retrieval fallback is used automatically.
- The final response is still structured as legal basis, explanation, and actions.

## Common Issues

### 1) Translator model not found

Symptom in logs:

**Happy fine-tuning! 🇹🇳 بالتوفيق!**



how to start RAG:
cd ai_iss
python ingest_vector_store.py
