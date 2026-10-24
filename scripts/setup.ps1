$ErrorActionPreference = 'Stop'
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path $dockerBin) { $env:PATH = "$dockerBin;$env:PATH" }
Set-Location (Split-Path $PSScriptRoot -Parent)
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and retry.' }
function New-LocalSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
}
if (-not (Test-Path .env)) {
  $taskText = Get-Content .env.example -Raw
  foreach ($taskKey in @('POSTGRES_PASSWORD','MINIO_ROOT_PASSWORD','SCIENCE_TOKEN','OFFLINE_SIGNING_KEY')) {
    $taskText = $taskText.Replace("${taskKey}=REPLACE_WITH_RANDOM_SECRET", "${taskKey}=$(New-LocalSecret)")
  }
  [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $taskText, (New-Object Text.UTF8Encoding $false))
}
$taskText = Get-Content .env -Raw
foreach ($taskKey in @('SCIENCE_TOKEN','OFFLINE_SIGNING_KEY')) {
  if ($taskText -notmatch "(?m)^${taskKey}=") { Add-Content .env "${taskKey}=$(New-LocalSecret)" }
}
$taskCompose=@('-f','compose.yaml')
if ((Test-Path '.secrets/gcloud/application_default_credentials.json') -and $taskText -match '(?m)^ENABLE_GEMINI=true\s*$') { $taskCompose+=@('-f','compose.gemini.yaml') }
docker compose @taskCompose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose configuration.' }
docker compose @taskCompose up --build -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Core stack did not become healthy. Inspect docker compose logs.' }
