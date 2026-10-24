param([switch]$RefreshLocks)
$ErrorActionPreference = 'Stop'
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path $dockerBin) { $env:PATH = "$dockerBin;$env:PATH" }
Set-Location (Split-Path $PSScriptRoot -Parent)
docker build -f infra/docker/python-lock.Dockerfile -t senku-python-lock .
if ($LASTEXITCODE -ne 0) { throw 'Python lock builder failed.' }
$engines = @('numerics','rdkit','cobrapy','roadrunner','tellurium','biosimulators','copasi','docking')
foreach ($engine in $engines) {
  if ((Test-Path "services/workers/$engine/requirements.lock") -and -not $RefreshLocks) { continue }
  docker run --rm --mount "type=bind,source=$((Get-Location).Path),target=/workspace" senku-python-lock "services/workers/$engine/requirements.in" -o "services/workers/$engine/requirements.lock" > $null
  if ($LASTEXITCODE -ne 0) { throw "Dependency resolution failed for $engine" }
}
docker compose --profile science up --build -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Scientific environments did not become healthy.' }
