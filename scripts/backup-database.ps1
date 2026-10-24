param([string]$Directory='backups')
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$taskDocker=if($IsWindows){Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'}else{'docker'}
if(-not (Test-Path $taskDocker)){$taskDocker='docker'}
New-Item -ItemType Directory -Force $Directory | Out-Null
$taskArchive=Join-Path (Resolve-Path $Directory) ('senku-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')
& $taskDocker compose exec -T postgres sh -c 'pg_dump --format=custom --no-owner --no-acl --file=/tmp/senku-backup.dump --username="$POSTGRES_USER" "$POSTGRES_DB"'
if($LASTEXITCODE -ne 0){throw 'Database backup failed'}
& $taskDocker compose cp postgres:/tmp/senku-backup.dump $taskArchive
if($LASTEXITCODE -ne 0){throw 'Backup copy failed'}
& $taskDocker compose exec -T postgres rm -- /tmp/senku-backup.dump
$taskHash=(Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText($taskArchive+'.sha256',$taskHash)
Write-Output "Database backup written: $taskArchive"
Write-Output 'Back up the corresponding private artifact bucket and preserve its object keys before treating this as a full recovery set.'
