$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'Unblock-AHK.flag') -Value 'User requested unblock'
Write-Host 'Permintaan nonaktifkan blokir disimpan. Agent aktif akan memproses dalam sekitar 2 detik.'
