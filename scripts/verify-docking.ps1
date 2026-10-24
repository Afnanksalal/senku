param()
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$taskDocker=if($IsWindows){Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'}else{'docker'}
if(-not(Test-Path $taskDocker)){$taskDocker='docker'}
Get-Content services/workers/tests/docking.py -Raw | & $taskDocker compose exec -T vina python -c "import pathlib,sys;pathlib.Path('/tmp/docking-tests.py').write_text(sys.stdin.read())"
if($LASTEXITCODE -ne 0){throw 'Could not prepare reference checks'}
& $taskDocker compose exec -T vina python /tmp/docking-tests.py
if($LASTEXITCODE -ne 0){throw 'Docking reference and boundary checks failed'}
Get-Content services/workers/tests/docking_limits.py -Raw | & $taskDocker compose exec -T vina python -
if($LASTEXITCODE -ne 0){throw 'Docking default and upper search checks failed'}
