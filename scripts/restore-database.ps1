param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$DatabaseName)
$ErrorActionPreference='Stop'
if($DatabaseName -notmatch '^senku_restore_[a-z0-9_]{1,40}$'){throw 'Restore requires a new database named senku_restore_<identifier>.'}
$taskArchive=(Resolve-Path -LiteralPath $Archive).Path
$taskExpected=(Get-Content -LiteralPath ($taskArchive+'.sha256') -Raw).Trim()
if((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLower() -ne $taskExpected){throw 'Archive checksum mismatch'}
Set-Location (Split-Path $PSScriptRoot -Parent)
$taskDocker=if($IsWindows){Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'}else{'docker'}
if(-not (Test-Path $taskDocker)){$taskDocker='docker'}
& $taskDocker compose cp $taskArchive postgres:/tmp/senku-restore.dump
if($LASTEXITCODE -ne 0){throw 'Restore archive copy failed'}
& $taskDocker compose exec -T postgres sh -c 'createdb --username="$POSTGRES_USER" "$1"' sh $DatabaseName
if($LASTEXITCODE -ne 0){throw 'New restore database could not be created. Existing databases are never overwritten.'}
& $taskDocker compose exec -T postgres sh -c 'pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$1" /tmp/senku-restore.dump' sh $DatabaseName
if($LASTEXITCODE -ne 0){throw 'Restore failed. Preserve the isolated database for diagnosis.'}
& $taskDocker compose exec -T postgres sh -c 'psql --username="$POSTGRES_USER" --dbname="$1" --tuples-only --command="SELECT count(*) FROM information_schema.tables;"' sh $DatabaseName
if($LASTEXITCODE -ne 0){throw 'Restored database verification failed'}
& $taskDocker compose exec -T postgres rm -- /tmp/senku-restore.dump
Write-Output "Restored and inspected isolated database: $DatabaseName"
