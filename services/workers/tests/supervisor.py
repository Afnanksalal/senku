"""Supervisor invariants, using a test-only controlled subprocess substitution."""
import importlib.util,json,os,subprocess,sys,threading,time,uuid
spec=importlib.util.spec_from_file_location('supervisor','/worker/health.py');supervisor=importlib.util.module_from_spec(spec);spec.loader.exec_module(supervisor)
job=dict(job_id=str(uuid.uuid4()),model_id='cell-energy',parameters=dict(oxygen=1,glucose=1,demand=1),seed=1,input={},timeout_seconds=1)
supervisor.validate(job)
for modified in [dict(job,seed=True),dict(job,timeout_seconds=float('nan')),dict(job,input={'command':'x'}),dict(job,model_id='unapproved'),dict(job,parameters={'demand':float('inf')})]:
    try: supervisor.validate(modified);raise AssertionError('Accepted an invalid envelope')
    except (ValueError,TypeError): pass
original=subprocess.Popen
# No executable or source is accepted from the HTTP caller. Substitute only within this test.
def controlled(*args,**kwargs): return original([sys.executable,'-c','import sys,time;sys.stdin.read();time.sleep(30)'],**kwargs)
supervisor.subprocess.Popen=controlled
start=time.monotonic();status,result=supervisor.execute(job,threading.Event());assert status==409 and result['error']['code']=='timed_out';assert time.monotonic()-start<3
cancel=threading.Event();timer=threading.Timer(.1,cancel.set);timer.start();start=time.monotonic();status,result=supervisor.execute(dict(job,timeout_seconds=30),cancel);assert result['error']['code']=='cancelled';assert time.monotonic()-start<2
timer.join();print(json.dumps({'supervisor':'passed','checks':['invalid_envelopes','wall_timeout','process_cancellation']}))
