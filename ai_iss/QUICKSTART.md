# Quick Start

This is the fastest way to run and train the two-stage Tunisian legal assistant.

## 1) Setup

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

## 2) Run the app

```bash
python app.py
```

Example query:

```text
chnowa na3mel ken el patron taredni bla i3lem w ma khallasnish 7a9i?
```

## 3) Train both stages

### Prepare stage datasets

```bash
python prepare_two_stage_data.py
```

Outputs:

- data/translator_train.json
- data/legal_train_ar.json

### Train stage-1 translator

```bash
python train_translator.py
```

Output:

- translator-model/

### Train stage-2 legal model

```bash
python train.py
```

Output:

- legal-model/

### One-command pipeline

```bash
python train_two_stage.py
```

Useful flags:

- --prepare-only
- --skip-translator
- --skip-legal
- --python PATH_TO_PYTHON

## 4) Evaluate

```bash
python test.py
python evaluate_two_stage.py
python evaluate_two_stage.py --limit 50
```

## 5) Quick scripted end-to-end test

If you have input lines in \_e2e_input.txt:

```powershell
Get-Content _e2e_input.txt | python app.py
```

## Runtime behavior summary

- Stage-1 tries model-based translation first.
- If stage-1 output is invalid, it falls back to rule-based normalization.
- Stage-2 checks generation quality (including repetition and gibberish).
- If quality is low, it falls back to retrieval.
- Final legal response is structured as:
  - legal basis
  - simple explanation
  - practical next steps

## Common fixes

### Translator model not found

- Run python train_translator.py
- Check translator-model exists under ai_iss/translator-model

### Legal model not found

- Run python train.py
- Check legal-model exists under ai_iss/legal-model

### Arabic text looks broken in terminal (Windows)

```powershell
chcp 65001
```

### Slow CPU inference

- Keep prompts concise.
- Use retrieval-backed responses (already enabled by default).

## Notes

- Use the same Python interpreter for setup, training, and app runs.
- See README.md for full architecture and detailed workflow.
