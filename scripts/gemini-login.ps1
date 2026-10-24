param([string]$Project = 'project-f262e754-ce96-4f0c-b24')
$ErrorActionPreference = 'Stop'
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path $dockerBin) { $env:PATH = "$dockerBin;$env:PATH" }
$repo = Split-Path $PSScriptRoot -Parent
$credentialDir = Join-Path $repo '.secrets/gcloud'
New-Item -ItemType Directory -Force -Path $credentialDir | Out-Null
$image = 'gcr.io/google.com/cloudsdktool/google-cloud-cli:573.0.0-stable@sha256:f5fae73a6f1c60b58a1150ff76771a43620891d4dd74abc527c8eca0d544b385'
Write-Host 'Open the Google URL below and complete sign-in yourself.'
Write-Host 'Paste the authorization code only into this terminal, never into chat.'
& docker run --rm -it --mount "type=bind,source=$credentialDir,target=/gcloud" -e CLOUDSDK_CONFIG=/gcloud $image gcloud auth application-default login --no-launch-browser "--project=$Project"
if ($LASTEXITCODE -ne 0) { throw 'Google ADC sign-in did not complete.' }
& docker run --rm --mount "type=bind,source=$credentialDir,target=/gcloud" --entrypoint sh $image -c 'chown 1000:1000 /gcloud/application_default_credentials.json && chmod 600 /gcloud/application_default_credentials.json'
if ($LASTEXITCODE -ne 0) { throw 'Could not grant the non-root backend access to ADC.' }
Write-Host 'Google ADC is saved locally in the ignored .secrets directory.'
