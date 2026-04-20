# 🚀 LawyerUp AI - Quick Reference

## ⚡ Start the AI Server (Copy & Paste)

```powershell
cd "c:\Users\Mega Pc\OneDrive - South Mediterranean University\Desktop\el7ayYrawah\ai_iss"
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
```

---

## 🌐 API Endpoints

### Health Check
```
GET http://127.0.0.1:8000/health
```

### Ask a Legal Question
```
POST http://127.0.0.1:8000/v1/reply
Content-Type: application/json

{
  "message": "شنية حقوقي في العمل؟",
  "history": [],
  "context": {}
}
```

### Swagger UI (Interactive Testing)
```
http://127.0.0.1:8000/docs
```

---

## 📝 Example Requests

### Darija (Tunisian Arabic)
```json
{
  "message": "شنية حقوقي في العمل؟",
  "history": [],
  "context": {}
}
```

### Modern Standard Arabic
```json
{
  "message": "ما هي حقوقي في العمل؟",
  "history": [],
  "context": {}
}
```

### French
```json
{
  "message": "Quels sont mes droits du travail?",
  "history": [],
  "context": {}
}
```

### English
```json
{
  "message": "What are my labor rights in Tunisia?",
  "history": [],
  "context": {}
}
```

---

## 💻 Node.js Backend Integration

```javascript
const axios = require('axios');

async function askAI(message, history = []) {
  const response = await axios.post(
    'http://127.0.0.1:8000/v1/reply',
    { message, history, context: {} }
  );
  return response.data.response;
}

module.exports = { askAI };
```

---

## 🧪 Test the API

```powershell
cd ai_iss
python test_api.py
```

---

## 📊 System Status

✅ **Python**: 3.14.2  
✅ **PyTorch**: 2.11.0  
✅ **FastAPI**: 0.136.0  
✅ **Uvicorn**: 0.44.0  
✅ **Server**: Running on http://127.0.0.1:8000  
✅ **Health**: OK  

---

## 📁 Files

| File | Purpose |
|------|---------|
| `api_server.py` | Main API application |
| `generator.py` | AI answer generation |
| `router.py` | Request routing |
| `test_api.py` | Test suite |
| `SETUP_GUIDE.md` | Full documentation |
| `FINAL_STATUS.md` | Detailed status |

---

## 🆘 Common Issues

**Port already in use?**
```powershell
python -m uvicorn api_server:app --host 127.0.0.1 --port 8001
```

**Model not loading?**
It auto-downloads on first request (~500MB, 2-5 minutes)

**Slow response?**
Normal on first request (10-30s). Subsequent requests are 1-3s.

---

## 📞 Support

See `SETUP_GUIDE.md` for detailed troubleshooting and integration examples.

---

**Status**: ✅ Production Ready  
**Last Update**: 2026-04-20
