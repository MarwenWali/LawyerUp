# Tunisian Arabic Legal AI - Quick Setup Script
# This script sets up the environment and trains the model

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Tunisian Arabic Legal AI Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check Python installation
Write-Host "[OK] Checking Python installation..." -ForegroundColor Green
$python = & python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}
Write-Host "  Found: $python`n"

# Create virtual environment
Write-Host "[OK] Setting up virtual environment..." -ForegroundColor Green
if (-Not (Test-Path "mistral_env")) {
    & python -m venv mistral_env
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Created: mistral_env"
}
else {
    Write-Host "  Found existing: mistral_env"
}

# Activate virtual environment
Write-Host "`n[OK] Activating virtual environment..." -ForegroundColor Green
& .\mistral_env\Scripts\Activate.ps1

# Upgrade pip
Write-Host "`n[OK] Upgrading pip..." -ForegroundColor Green
& python -m pip install --upgrade pip -q

# Install dependencies
Write-Host "`n[OK] Installing PyTorch and dependencies..." -ForegroundColor Green
Write-Host "  This may take a few minutes..."

# Install PyTorch first (with CUDA support)
Write-Host "  Installing PyTorch..." -ForegroundColor Yellow
& pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118 -q

# Install other dependencies
Write-Host "  Installing transformers, datasets, and TRL..." -ForegroundColor Yellow
& pip install -r requirements.txt -q

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    Write-Host "  Try running: pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[OK] All dependencies installed!" -ForegroundColor Green

# Verify dataset
Write-Host "`n[OK] Checking dataset..." -ForegroundColor Green
if (Test-Path "data/tunisian_legal.json") {
    $dataSize = (Get-Item "data/tunisian_legal.json").Length / 1MB
    $roundedSize = [Math]::Round($dataSize, 2)
    Write-Host ("  Found: data/tunisian_legal.json ({0} MB)" -f $roundedSize)
}
else {
    Write-Host "  [WARN] Dataset not found at data/tunisian_legal.json" -ForegroundColor Yellow
    Write-Host "    Please add your training data before proceeding"
}

# Display next steps
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "[OK] Setup Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start the interactive assistant:"
Write-Host "   python app.py"
Write-Host ""
Write-Host "2. Train both models (translator + legal):"
Write-Host "   python train_two_stage.py"
Write-Host ""
Write-Host "3. Test the model:"
Write-Host "   python test.py"
Write-Host ""
Write-Host "4. Run interactive testing:"
Write-Host "   python test.py --interactive"
Write-Host ""
Write-Host "For more information, see README.md"
Write-Host ""
