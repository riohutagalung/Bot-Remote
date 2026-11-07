$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Check-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step gagal. Periksa pesan di atas." }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS dahulu: https://nodejs.org/' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm tidak ditemukan. Install Node.js lengkap lalu buka ulang terminal.' }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Install Python 3.11+ dahulu dan aktifkan Add Python to PATH: https://python.org/downloads/' }
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
Check-Exit 'Pemeriksaan Node 24+'
if (-not (Test-Path -LiteralPath '.env')) {
    node configure-local.js
    Check-Exit 'Pembuatan konfigurasi'
}
& npm.cmd ci --cache .npm-cache --no-audit --no-fund
Check-Exit 'Pemasangan dependency Node'
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
    python -m venv .venv
    Check-Exit 'Pembuatan lingkungan Python'
}
& ./.venv/Scripts/python.exe -m pip install -r requirements-desktop.txt
Check-Exit 'Pemasangan dependency desktop'
& npm.cmd run build
Check-Exit 'Build dashboard'
Write-Host 'Selesai. Buka Start-Laptop.cmd untuk menjalankan.' -ForegroundColor Green
Write-Host 'Password dashboard ada di .env pada DASHBOARD_PASSWORD. Jangan bagikan file .env.'
Write-Host 'Untuk kontrol dari luar: install Tailscale di laptop dan HP/komputer pengontrol, masuk akun yang sama.'
