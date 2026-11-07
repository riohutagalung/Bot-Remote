# Optional, explicit user-level startup. No hidden process or elevation.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Start-Laptop.cmd'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist/index.html'))) { throw 'Jalankan Setup.ps1 dahulu.' }
$startup = [Environment]::GetFolderPath('Startup')
$linkPath = Join-Path $startup 'Bot-Remote.lnk'
if (Test-Path -LiteralPath $linkPath) { throw 'Shortcut Bot-Remote sudah ada; hapus dahulu jika ingin menggantinya.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle = 1
$shortcut.Description = 'Bot-Remote: dashboard dan agent laptop, tampil saat login'
$shortcut.Save()
Write-Host 'Mulai otomatis setelah login Windows diaktifkan. Jendela kontrol tetap terlihat.'
Write-Host 'Untuk menonaktifkan, jalankan Remove-Startup.ps1.'
