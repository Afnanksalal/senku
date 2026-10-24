param([string[]]$Engines = @('numerics','rdkit','cobrapy','roadrunner','tellurium','copasi','biosimulators','physicell','vina'))
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path $dockerBin) { $env:PATH = "$dockerBin;$env:PATH" }
foreach ($engine in $Engines) {
  Get-Content services/workers/smoke.py -Raw | docker compose exec -T $engine python -
  if ($LASTEXITCODE -ne 0) { throw "Scientific dependency smoke failed: $engine" }
}
