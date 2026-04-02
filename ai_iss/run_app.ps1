$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path $projectRoot "mistral_env\Scripts\python.exe"
$appFile = Join-Path $projectRoot "app.py"

if (-not (Test-Path $pythonExe)) {
    Write-Error "Virtual environment Python not found at $pythonExe"
    exit 1
}

if (-not (Test-Path $appFile)) {
    Write-Error "app.py not found at $appFile"
    exit 1
}

# Ensure UTF-8 rendering for Arabic output.
chcp 65001 | Out-Null

Set-Location $projectRoot
& $pythonExe $appFile
