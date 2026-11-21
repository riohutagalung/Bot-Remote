$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'central-agent\.cjs' }
if ($running) { throw 'Tutup jendela RH Remote Agent terlebih dahulu, lalu jalankan file ini lagi melalui File Explorer. Pengaturan blokir tetap tersimpan.' }
Start-Process -FilePath (Join-Path $PSScriptRoot 'client.exe') -WorkingDirectory $PSScriptRoot -WindowStyle Normal
Write-Host 'Agent dimulai melalui akun desktop Windows ini. Periksa status izin shutdown pada dashboard.'
