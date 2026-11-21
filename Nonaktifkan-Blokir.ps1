$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
& $nodePath --env-file=.env unblock-local.js
if ($LASTEXITCODE -ne 0) { throw 'Pencabutan blokir belum berhasil; lihat pesan di atas.' }
