$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appFile = Join-Path $projectRoot "app.py"

function Test-PythonRuntime {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ExePath
    )

    if (-not (Test-Path $ExePath)) {
        return $false
    }

    try {
        & $ExePath -c "print('ok')" *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

$candidatePythons = @(
    (Join-Path $projectRoot "mistral_env\Scripts\python.exe"),
    (Join-Path $projectRoot ".venv\Scripts\python.exe"),
    "C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe",
    "C:\Program Files\PostgreSQL\17\pgAdmin 4\python\python.exe"
)

$pythonExe = $null
foreach ($candidate in $candidatePythons) {
    if (Test-PythonRuntime -ExePath $candidate) {
        $pythonExe = $candidate
        break
    }
}

if (-not $pythonExe) {
    Write-Error "No working Python runtime found. Install Python 3.12+ or recreate ai_iss/.venv."
    exit 1
}

if (-not (Test-Path $appFile)) {
    Write-Error "app.py not found at $appFile"
    exit 1
}

# Ensure UTF-8 rendering for Arabic output.
chcp 65001 | Out-Null

Set-Location $projectRoot

if ($pythonExe -like "*pgAdmin 4*python.exe") {
    # pgAdmin Python runs in isolated mode and misses project imports by default.
    # Force retrieval fallback so the assistant stays functional on machines without full ML runtime.
    if (-not $env:AI_ISS_DISABLE_TORCH) {
        $env:AI_ISS_DISABLE_TORCH = "1"
    }
    $env:PYTHONIOENCODING = "utf-8"

    $bootstrap = "import os,runpy,sys; sys.path.insert(0, os.getcwd()); runpy.run_path('app.py', run_name='__main__')"

    & $pythonExe -c $bootstrap
    exit $LASTEXITCODE
}

& $pythonExe $appFile
