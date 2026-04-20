# LawyerUp AI Engine - Startup Script
# Starts the FastAPI server for AI legal assistant

Write-Host "`n" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         LawyerUp AI Engine - Legal Assistant API         " -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# Get current directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

# Check if virtual environment exists
if (-Not (Test-Path "mistral_env")) {
    Write-Host "[ERROR] Virtual environment not found!" -ForegroundColor Red
    Write-Host "Run setup first:" -ForegroundColor Yellow
    Write-Host "  python -m venv mistral_env" -ForegroundColor Yellow
    exit 1
}

# Activate virtual environment
Write-Host "[OK] Activating virtual environment..." -ForegroundColor Green
& .\mistral_env\Scripts\Activate.ps1

# Check if model exists
Write-Host "[OK] Checking model files..." -ForegroundColor Green
if (-Not (Test-Path "legal-model")) {
    Write-Host "[INFO] legal-model directory not found!" -ForegroundColor Yellow
    Write-Host "       The model will be downloaded from HuggingFace on first run." -ForegroundColor Yellow
    Write-Host ""
}

# Check dependencies
Write-Host "[OK] Checking dependencies..." -ForegroundColor Green
$requiredPackages = @("fastapi", "uvicorn", "transformers", "torch", "peft")
foreach ($pkg in $requiredPackages) {
    $result = python -c "import $pkg" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    [+] $pkg" -ForegroundColor Green
    }
    else {
        Write-Host "    [-] $pkg (MISSING)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[OK] Starting FastAPI server..." -ForegroundColor Green
Write-Host "     Host: http://127.0.0.1:8001" -ForegroundColor Yellow
Write-Host "     API Docs: http://127.0.0.1:8001/docs" -ForegroundColor Yellow
Write-Host "     Health Check: http://127.0.0.1:8001/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

# Start the API server
Write-Host ""
uvicorn api_server:app --host 127.0.0.1 --port 8001

Pop-Location
