$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'Bot-Remote AKTIF - tutup jendela untuk memutus akses'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js tidak ditemukan. Install Node.js 24 LTS.' }
if (-not (Test-Path -LiteralPath '.env')) { throw 'Konfigurasi .env tidak tersedia.' }
# A second launcher must not delete the active URL or start a competing backend.
$configuredPort = 8080
$portLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^PORT=(\d+)\s*$' } | Select-Object -First 1
if ($portLine -and $portLine -match '^PORT=(\d+)\s*$') { $configuredPort = [int]$Matches[1] }
$portProbe = New-Object System.Net.Sockets.TcpClient
try {
    $connectTask = $portProbe.ConnectAsync('127.0.0.1', $configuredPort)
    try { [void]$connectTask.Wait(1000) } catch {}
    if ($portProbe.Connected) {
        Write-Host "Port $configuredPort sudah aktif. Launcher kedua tidak dijalankan." -ForegroundColor Yellow
        if (Test-Path -LiteralPath 'Backend-URL.txt') { Get-Content -LiteralPath 'Backend-URL.txt' }
        return
    }
} finally { $portProbe.Dispose() }
$backend = $null
$tunnel = $null
$tunnelLog = Join-Path $PSScriptRoot ('tunnel-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
try {
    $stopFlag = Join-Path $PSScriptRoot 'Stop-Remote.flag'
    if (Test-Path -LiteralPath $stopFlag) { Remove-Item -LiteralPath $stopFlag }
    $urlFile = Join-Path $PSScriptRoot 'Backend-URL.txt'
    if (Test-Path -LiteralPath $urlFile) { Remove-Item -LiteralPath $urlFile }
    Write-Host 'Kontrol AHK aktif. Desktop/mouse/keyboard dinonaktifkan.' -ForegroundColor Green
    Write-Host 'Tutup jendela ini atau Ctrl+C untuk memutus akses.'
    $backend = Start-Process -FilePath $nodePath -ArgumentList '--env-file=.env','local.js' -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
    Start-Sleep -Seconds 3
    if ($backend.HasExited) { throw 'Backend gagal mulai. Periksa apakah port 8080 sudah dipakai.' }
    $tunnel = Start-Process -FilePath (Join-Path $PSScriptRoot 'cloudflared.exe') -ArgumentList 'tunnel','--no-autoupdate','--protocol','http2','--url','http://127.0.0.1:8080','--logfile',('"' + $tunnelLog + '"') -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
    Write-Host 'Pada laptop ini: buka http://127.0.0.1:8080. Untuk perangkat lain gunakan URL HTTPS yang muncul di bawah.'
    Write-Host 'Password dashboard tersimpan di .env pada DASHBOARD_PASSWORD. Jangan bagikan file itu.'
    $savedUrl = $false
    while ($true) {
        if (Test-Path -LiteralPath $stopFlag) {
            Remove-Item -LiteralPath $stopFlag
            Write-Host 'Pengguna meminta controller berhenti. Akses remote dihentikan.'
            break
        }
        if ($backend.HasExited) {
            Write-Host 'Backend berhenti; memulai ulang dengan konfigurasi terbaru. Alamat tunnel dipertahankan.' -ForegroundColor Yellow
            $backend = Start-Process -FilePath $nodePath -ArgumentList '--env-file=.env','local.js' -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
            Start-Sleep -Seconds 2
            if ($backend.HasExited) { throw 'Backend gagal dimulai ulang. Periksa konfigurasi dan port.' }
        }
        if ($tunnel.HasExited) {
            Write-Host 'Tunnel berhenti; membuat koneksi baru. Backend lokal tetap berjalan.' -ForegroundColor Yellow
            if (Test-Path -LiteralPath $urlFile) { Remove-Item -LiteralPath $urlFile }
            Start-Sleep -Seconds 3
            $tunnelLog = Join-Path $PSScriptRoot ('tunnel-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6) + '.log')
            $tunnel = Start-Process -FilePath (Join-Path $PSScriptRoot 'cloudflared.exe') -ArgumentList 'tunnel','--no-autoupdate','--protocol','http2','--url',("http://127.0.0.1:$configuredPort"),'--logfile',('"' + $tunnelLog + '"') -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
            $savedUrl = $false
        }
        if (Test-Path -LiteralPath $tunnelLog) {
            $recentLog = (Get-Content -LiteralPath $tunnelLog -Tail 20) -join "`n"
            if ($recentLog -match 'Unauthorized: Tunnel not found') {
                Write-Host 'Cloudflare menolak tunnel lama. Memulihkan koneksi; alamat HTTPS akan berubah.' -ForegroundColor Yellow
                if (Test-Path -LiteralPath $urlFile) { Remove-Item -LiteralPath $urlFile }
                Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 3
                continue
            }
        }
        if (-not $savedUrl -and (Test-Path -LiteralPath $tunnelLog)) {
            $match = [regex]::Match((Get-Content -LiteralPath $tunnelLog -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($match.Success) {
                Set-Content -LiteralPath (Join-Path $PSScriptRoot 'Backend-URL.txt') -Value $match.Value
                Write-Host ('ALAMAT BACKEND: ' + $match.Value) -ForegroundColor Cyan
                $savedUrl = $true
            }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue }
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue }
}
