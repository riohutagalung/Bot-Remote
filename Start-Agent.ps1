$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'Bot-Remote Agent - Ctrl+C untuk memutus akses'
$nodePath = Join-Path $PSScriptRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) { $nodePath = (Get-Command node -ErrorAction Stop).Source }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env'))) { throw 'Paket pendaftaran privat belum tersedia. Konfigurasi koneksi pusat diperlukan.' }
Write-Host 'Agent laptop ini aktif dan terlihat. Ctrl+C menghentikan akses.'
& $nodePath --env-file=.env client.cjs
exit $LASTEXITCODE
