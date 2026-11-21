param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\release'))
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$out=(Resolve-Path $OutputDirectory).Path
$stage=Join-Path $out ('stage-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'runtime') | Out-Null
$files=@('central-agent.cjs','enroll-agent.cjs','device-identity.cjs','ahk-policy.cjs','ahk-process.cjs','system-control.cjs','close-windows.ps1','Nonaktifkan-Blokir.cmd','Nonaktifkan-Blokir.ps1')
foreach($file in $files){Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $stage $file)}
$node=(Get-Command node -ErrorAction Stop).Source
Copy-Item -LiteralPath $node -Destination (Join-Path $stage 'runtime\node.exe')
Get-ChildItem -LiteralPath (Split-Path $node) -Filter '*.dll' | Copy-Item -Destination (Join-Path $stage 'runtime')
& $node -e "fetch('https://raw.githubusercontent.com/nodejs/node/main/LICENSE').then(async r=>{if(!r.ok)throw Error('License download failed');require('fs').writeFileSync(process.argv[1],await r.text())}).catch(e=>{console.error(e.message);process.exitCode=1})" (Join-Path $stage 'runtime\LICENSE-node.txt')
if($LASTEXITCODE -ne 0){throw 'License download failed'}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe ('/out:'+(Join-Path $stage 'client.exe')) (Join-Path $PSScriptRoot 'Client.cs')
if($LASTEXITCODE -ne 0){throw 'Client compile failed'}
$payload=Join-Path $out 'payload.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $payload -Force
$installer=Join-Path $out 'RH-Remote-Setup.exe'
& $compiler /nologo /target:exe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll ('/resource:'+$payload+',payload.zip') ('/out:'+$installer) (Join-Path $PSScriptRoot 'Setup.cs')
if($LASTEXITCODE -ne 0){throw 'Installer compile failed'}
$hash=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $out 'SHA256SUMS.txt') -Value ($hash+'  RH-Remote-Setup.exe')
Write-Host ('Installer built: '+$installer)
