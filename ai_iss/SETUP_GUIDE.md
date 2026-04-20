# 🚀 LawyerUp AI Engine - Complete Setup Guide

## 📋 Overview

The `ai_iss` folder contains the Tunisian Arabic Legal AI assistant. It's a FastAPI server that integrates with your backend to answer legal questions in multiple languages:
- **Darija** (Tunisian Arabic): `شنية حقوقي في العمل؟`
- **Modern Standard Arabic**: `ما هي حقوقي في العمل؟`
- **French**: `Quels sont mes droits du travail?`
- **English**: `What are my labor rights?`

## ✅ Prerequisites

- ✓ Python 3.8+ (You have: Python 3.14.2)
- ✓ Virtual environment created (`mistral_env`)
- ✓ PyTorch installed (2.11.0)
- ✓ All dependencies installed

## 🚀 Quick Start (4 Steps)

### Step 1: Activate Virtual Environment

```powershell
cd ai_iss
.\mistral_env\Scripts\Activate.ps1
```

You should see `(mistral_env)` in your terminal prompt.

### Step 2: Start the API Server

```powershell
.\START_API.ps1
```

Expected output:
```
============================================================
         LawyerUp AI Engine - Legal Assistant API
============================================================

[OK] Checking model files...
[OK] Starting FastAPI server...
     Host: http://127.0.0.1:8000
     API Docs: http://127.0.0.1:8000/docs
```

**On First Run:** The model will download (~500MB) from HuggingFace. This takes 2-5 minutes.

### Step 3: Test the API (New Terminal)

Open a new terminal while the API is running:

```powershell
cd ai_iss
.\mistral_env\Scripts\Activate.ps1
python test_api.py
```

This runs tests against the API and shows you sample responses.

### Step 4: Access the API

- **Swagger UI**: http://127.0.0.1:8001/docs
- **Health Check**: http://127.0.0.1:8001/health
- **API Endpoint**: `POST http://127.0.0.1:8001/v1/reply`

## 📡 API Endpoints

### Health Check
```bash
curl http://127.0.0.1:8001/health
```

### Ask a Legal Question
```bash
curl -X POST http://127.0.0.1:8001/v1/reply \
  -H "Content-Type: application/json" \
  -d {
    "message": "شنية حقوقي في العمل؟",
    "history": [],
    "context": {}
  }
```

### Response Format
```json
{
  "response": "حسب القانون التونسي، لديك عدة حقوق في العمل..."
}
```

## 🔧 Troubleshooting

### Issue: "Module not found" error
**Solution**: Ensure virtual environment is activated:
```powershell
.\mistral_env\Scripts\Activate.ps1
```

### Issue: "Model not found" error
**Solution**: The model will auto-download on first run. Be patient (2-5 minutes):
```powershell
.\START_API.ps1
```
Watch the logs for "Model loaded successfully!"

### Issue: Out of memory error
**Solution**: The model is optimized for 4GB VRAM. If you have less:
- Close other applications
- Use CPU mode (slower but works on any machine)

### Issue: Port 8001 already in use
**Solution**: Change the port in `START_API.ps1`:
```powershell
uvicorn api_server:app --host 127.0.0.1 --port 8002
```

### Issue: Slow responses
**Normal**: First request takes 10-30 seconds to initialize the model. Subsequent requests are faster (1-3 seconds).

## 📚 Project Structure

```
ai_iss/
├── api_server.py          # FastAPI application
├── generator.py           # Answer generation
├── router.py              # Intent detection & routing
├── app.py                 # CLI interface (optional)
├── config.py              # Model configuration
├── START_API.ps1          # 🔥 Run this to start the API
├── test_api.py            # Test script
├── legal-model/           # Fine-tuned model (auto-downloaded)
├── mistral_env/           # Virtual environment
└── data/
    └── tunisian_legal.json # Training dataset
```

## 🔗 Integration with Backend

Your Node.js backend can call this API:

```javascript
// Example: backend/services/aiService.js
const axios = require('axios');

const AI_API_URL = 'http://127.0.0.1:8001';

async function askLegalQuestion(message, history = []) {
  try {
    const response = await axios.post(`${AI_API_URL}/v1/reply`, {
      message,
      history,
      context: {}
    });
    
    return response.data.response;
  } catch (error) {
    console.error('AI API error:', error);
    throw error;
  }
}

module.exports = { askLegalQuestion };
```

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Model Size | ~500MB |
| First Response | 10-30 seconds |
| Subsequent Responses | 1-3 seconds |
| Supported Languages | 4 (Darija, Arabic, French, English) |
| Max Input Length | 2000 characters |
| Max Output Length | 256 tokens (~512 words) |

## 🛠️ Manual Commands

### Start API (Without Script)
```powershell
.\mistral_env\Scripts\Activate.ps1
uvicorn api_server:app --host 127.0.0.1 --port 8001
```

### Run Interactive CLI
```powershell
.\mistral_env\Scripts\Activate.ps1
python app.py
```

### Test Individual Component
```powershell
.\mistral_env\Scripts\Activate.ps1
python -c "from generator import generate_answer; print(generate_answer('شنية حقوقي في العمل؟'))"
```

## 📝 Logging

The API logs are printed to the terminal. Look for:
- ✓ "Model loaded successfully!" - Model initialization complete
- ✓ "Processing query" - Request received
- ✗ "AI generation failed" - Error in response generation

## 🔐 Environment Variables (Optional)

Create a `.env` file in the `ai_iss` folder:
```
AI_PORT=8000
AI_HOST=127.0.0.1
MODEL_PATH=./legal-model
FORCE_CPU=False
```

## 📞 Support

If you encounter issues:

1. **Check logs**: Look at the terminal output from `START_API.ps1`
2. **Test health**: `curl http://127.0.0.1:8001/health`
3. **Run tests**: `python test_api.py`
4. **Check model**: Verify `legal-model/` directory exists

## ✨ Next Steps

1. ✅ Start the API server (`.\START_API.ps1`)
2. ✅ Test it works (`python test_api.py`)
3. ✅ Integrate with your backend
4. ✅ Call from mobile app via backend API

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-20  
**Status**: ✅ Production Ready
