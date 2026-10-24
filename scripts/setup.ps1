$ErrorActionPreference = 'Stop'
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path $dockerBin) { $env:PATH = "$dockerBin;$env:PATH" }
Set-Location (Split-Path $PSScriptRoot -Parent)
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and retry.' }
if (-not (Test-Path .env)) {
  function New-LocalSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
  }
  $envText = (Get-Content .env.example -Raw).Replace('POSTGRES_PASSWORD=REPLACE_WITH_RANDOM_SECRET', "POSTGRES_PASSWORD=$(New-LocalSecret)").Replace('MINIO_ROOT_PASSWORD=REPLACE_WITH_RANDOM_SECRET', "MINIO_ROOT_PASSWORD=$(New-LocalSecret)")
  [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $envText, (New-Object Text.UTF8Encoding $false))
}
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose configuration.' }
docker compose up --build -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Core stack did not become healthy. Inspect docker compose logs.' }
