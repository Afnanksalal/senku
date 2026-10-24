$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path $dockerBin) { $env:PATH = "$dockerBin;$env:PATH" }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose validation failed' }
foreach ($url in @('http://localhost:3000/api/health','http://localhost:3001/health')) {
  $response = Invoke-RestMethod $url
  if ($response.status -ne 'ok') { throw "Health check failed: $url" }
  Write-Output "Healthy: $url"
}
docker compose exec -T api node scripts/check-infra.cjs
if ($LASTEXITCODE -ne 0) { throw 'Infrastructure round-trip failed' }
docker compose ps
