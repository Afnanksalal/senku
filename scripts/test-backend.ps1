param([switch]$SkipBuild,[switch]$LiveSources,[switch]$Quick)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Set-Location $taskRoot
$taskDocker=if($IsWindows){Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'}else{'docker'}
if(-not(Test-Path $taskDocker)){$taskDocker='docker'}
function Invoke-Docker { & $taskDocker @args; if($LASTEXITCODE -ne 0){throw 'Docker command failed'} }
$taskServices=@('postgres','redis','minio','numerics','rdkit','cobrapy','roadrunner','tellurium','copasi','physicell','vina','biosimulators')
if(-not $SkipBuild){Invoke-Docker compose --profile science build minio api jobs web numerics rdkit cobrapy roadrunner tellurium copasi physicell vina biosimulators}
Invoke-Docker compose --profile science up -d --no-build --wait --wait-timeout 180 @taskServices
$taskId='senku_test_'+[Guid]::NewGuid().ToString('N')
$taskApi=$taskId+'_api';$taskJobs=$taskId+'_jobs';$taskBucket=$taskId.Replace('_','-')
$taskEnvironment=@('-e','NODE_ENV=test','-e',"DB_SCHEMA=$taskId",'-e',"QUEUE_PREFIX=$taskId",'-e',"S3_BUCKET=$taskBucket",'-e','S3_CREATE_BUCKET=true','-e','AUTH_MODE=local','-e','ALLOW_LOCAL_REGISTRATION=true','-e','RATE_LIMIT_PER_MINUTE=10000','-e','AUTH_RATE_LIMIT_PER_MINUTE=100','-e','ENABLE_GEMINI=false')
if($LiveSources){$taskEnvironment+=@('-e','LIVE_SOURCE_TESTS=true')}
try {
 Invoke-Docker compose run -d --no-deps --name $taskApi @taskEnvironment api
 $taskReady=$false
 for($taskAttempt=0;$taskAttempt -lt 60;$taskAttempt++){
  & $taskDocker exec $taskApi node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>$null
  if($LASTEXITCODE -eq 0){$taskReady=$true;break};Start-Sleep -Seconds 1
 }
 if(-not $taskReady){Invoke-Docker logs --tail 30 $taskApi;throw 'Isolated API did not become ready'}
 Get-Content apps/api/tests/cancellation.integration.cjs -Raw | & $taskDocker exec -i $taskApi node -
 if($LASTEXITCODE -ne 0){throw 'Queued cancellation tests failed'}
 Invoke-Docker compose run -d --no-deps --name $taskJobs @taskEnvironment jobs
 $taskReady=$false
 for($taskAttempt=0;$taskAttempt -lt 60;$taskAttempt++){
  & $taskDocker exec $taskApi node -e "fetch('http://127.0.0.1:3001/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>$null
  if($LASTEXITCODE -eq 0){$taskReady=$true;break};Start-Sleep -Seconds 1
 }
 if(-not $taskReady){throw 'API dependencies and worker did not become ready'}
 foreach($taskTest in @('configuration.integration.cjs','provider.integration.cjs','planning.integration.cjs','backend.integration.cjs','concurrency.integration.cjs','domain.integration.cjs','recovery.integration.cjs')){
  Get-Content (Join-Path $taskRoot "apps/api/tests/$taskTest") -Raw | & $taskDocker exec -i $taskApi node -
  if($LASTEXITCODE -ne 0){throw "Failed: $taskTest"}
 }
 Get-Content apps/api/tests/docking.contract.cjs -Raw | & $taskDocker exec -i -e SENKU_TEST_API_DIST=/workspace/apps/api/dist $taskApi node -
 if($LASTEXITCODE -ne 0){throw 'Docking contract checks failed'}
 # Each service-level suite owns and removes a separate fresh database/queue/bucket namespace.
 foreach($taskTest in @('dynamic-learning.integration.cjs','personalized-mission.integration.cjs','ai-intent.integration.cjs','docking.integration.cjs')){
  $taskKind=if($taskTest -eq 'docking.integration.cjs'){'docking'}else{'dynamic'}
  $taskNamespace='senku_test_'+$taskKind+'_'+[Guid]::NewGuid().ToString('N').Substring(0,16)
  $taskTestEnvironment=@('-e',"DB_SCHEMA=$taskNamespace",'-e',"QUEUE_PREFIX=$taskNamespace",'-e',"S3_BUCKET=$($taskNamespace.Replace('_','-'))",'-e','SENKU_TEST_API_DIST=/workspace/apps/api/dist')
  Get-Content (Join-Path $taskRoot "apps/api/tests/$taskTest") -Raw | & $taskDocker exec -i @taskTestEnvironment $taskApi node -
  if($LASTEXITCODE -ne 0){throw "Failed: $taskTest"}
 }
 if(-not $Quick){
  foreach($taskEngine in @('numerics','rdkit','cobrapy','roadrunner','tellurium','copasi','physicell','vina','biosimulators')){
   Get-Content services/workers/smoke.py -Raw | & $taskDocker compose exec -T $taskEngine python -
   if($LASTEXITCODE -ne 0){throw "Dependency smoke failed: $taskEngine"}
  }
  foreach($taskEngine in @('numerics','rdkit','cobrapy','roadrunner','tellurium','copasi','physicell')){
   Get-Content services/workers/tests/reference.py -Raw | & $taskDocker compose exec -T $taskEngine python -
   if($LASTEXITCODE -ne 0){throw "Reference check failed: $taskEngine"}
  }
  Get-Content services/workers/tests/supervisor.py -Raw | & $taskDocker compose exec -T numerics python -
  if($LASTEXITCODE -ne 0){throw 'Supervisor tests failed'}
  & (Join-Path $PSScriptRoot 'verify-docking.ps1')
 }
} finally {
 & $taskDocker stop --timeout 30 $taskJobs 2>$null
 Get-Content apps/api/tests/cleanup.cjs -Raw | & $taskDocker exec -i $taskApi node -
 & $taskDocker stop --timeout 10 $taskApi 2>$null
 & $taskDocker rm $taskJobs $taskApi 2>$null
}
