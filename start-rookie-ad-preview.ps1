$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'

if (-not (Test-Path $node)) {
  Write-Host 'Bundled Node.js was not found. Open this project in Codex once so workspace dependencies can install, then run this again.'
  Read-Host 'Press Enter to close'
  exit 1
}

Set-Location $root
Write-Host ''
Write-Host 'Starting OnlyFast Rookie ad preview...'
Write-Host 'Open http://localhost:8080/rookie-ad-slot-preview'
Write-Host 'Keep this window open while previewing. Close it to stop the local server.'
Write-Host ''

& $node '.codex-preview.mjs'
