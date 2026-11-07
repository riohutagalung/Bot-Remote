$ErrorActionPreference = 'Stop'
$linkPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Bot-Remote.lnk'
if (Test-Path -LiteralPath $linkPath) { Remove-Item -LiteralPath $linkPath }
Write-Host 'Mulai otomatis dinonaktifkan. Ctrl+C pada jendela Bot-Remote untuk menghentikan proses yang masih aktif.'
