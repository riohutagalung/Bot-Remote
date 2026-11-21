$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$port = 8080
$line = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^PORT=(\d+)\s*$' } | Select-Object -First 1
if ($line -and $line -match '^PORT=(\d+)\s*$') { $port = [int]$Matches[1] }
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'Stop-Remote.flag') -Value 'User requested interactive restart'
$stopped = $false
for ($attempt=0; $attempt -lt 20; $attempt++) {
    $probe = New-Object System.Net.Sockets.TcpClient
    try { try { [void]$probe.ConnectAsync('127.0.0.1',$port).Wait(500) } catch {}; $active=$probe.Connected } finally { $probe.Dispose() }
    if (-not $active) { $stopped=$true; break }
    Start-Sleep -Milliseconds 500
}
if (-not $stopped) { throw 'Controller lama belum berhenti. Tutup jendela Bot-Remote yang lama, lalu jalankan file ini lagi.' }
Start-Process -FilePath (Join-Path $PSScriptRoot 'client.exe') -WorkingDirectory $PSScriptRoot -WindowStyle Normal
Write-Host 'Agent dimulai melalui akun desktop Windows ini. Periksa status izin shutdown pada dashboard.'
