"""Authenticated, bounded adapter subprocesses. No caller-supplied code executes."""
import hashlib, hmac, json, math, os, signal, subprocess, sys, tempfile, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ENGINE = os.environ['ENGINE']
TOKEN = os.environ.get('SCIENCE_TOKEN', '')
MODELS = {'numerics':['cell-energy','enzyme-explorer','population-dynamics','genetics-lab','diffusion-playground','ecosystem-rescue'],'rdkit':['molecule-sketchbook'],'cobrapy':['metabolism-explorer'],'roadrunner':['pathway-playground'],'tellurium':['pathway-playground'],'copasi':['pathway-playground'],'physicell':['cell-colony']}
PARAMETERS={'cell-energy':{'oxygen','glucose','demand'},'enzyme-explorer':{'substrate_mM','vmax','km_mM','duration'},'population-dynamics':{'initial_population','capacity','growth_rate','duration'},'genetics-lab':{'parent1','parent2','sample_size'},'diffusion-playground':{'diffusivity','grid_size','steps'},'ecosystem-rescue':{'nutrients','light','temperature','duration'},'molecule-sketchbook':{'smiles','generate_3d'},'metabolism-explorer':{'uptake','maintenance'},'pathway-playground':{'duration'},'cell-colony':{'duration','initial_cells'}}
slots = threading.BoundedSemaphore(1)
active, lock = {}, threading.Lock()
def validate(job):
    if not isinstance(job,dict) or set(job) != {'job_id','model_id','parameters','seed','input','timeout_seconds'}: raise ValueError()
    if str(uuid.UUID(job['job_id'])) != job['job_id'] or job['model_id'] not in MODELS.get(ENGINE,[]): raise ValueError()
    if type(job['seed']) is not int or not 0 <= job['seed'] <= 2147483647: raise ValueError()
    if type(job['timeout_seconds']) not in (int,float) or not 1 <= job['timeout_seconds'] <= 60: raise ValueError()
    if not isinstance(job['parameters'],dict) or len(job['parameters']) > 32: raise ValueError()
    if set(job['parameters'])!=PARAMETERS[job['model_id']]: raise ValueError()
    for key,value in job['parameters'].items():
        if len(key)>64 or not (type(value) in (int,float) and math.isfinite(value) or isinstance(value,str) and len(value)<=512): raise ValueError()
    if not isinstance(job['input'],dict) or set(job['input'])-{'pathway','sbml','pathway_hash'}: raise ValueError()
def limits():
    import resource
    os.setsid()
    for kind,bound in [(resource.RLIMIT_CPU,65),(resource.RLIMIT_AS,805306368),(resource.RLIMIT_FSIZE,4194304),(resource.RLIMIT_NOFILE,64),(resource.RLIMIT_CORE,0)]: resource.setrlimit(kind,(bound,bound))
def execute(job,cancelled):
    env={k:v for k,v in os.environ.items() if k!='SCIENCE_TOKEN'}
    env.update(OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1')
    with tempfile.TemporaryDirectory(prefix='senku-',dir='/tmp') as workspace:
        with open(workspace+'/stdout','w+b') as stdout,open(workspace+'/stderr','w+b') as stderr:
            process=subprocess.Popen([sys.executable,'/worker/execute.py'],stdin=subprocess.PIPE,stdout=stdout,stderr=stderr,cwd=workspace,env=env,start_new_session=True)
            process.stdin.write(json.dumps(job,allow_nan=False).encode());process.stdin.close()
            deadline=time.monotonic()+job['timeout_seconds'];reason=None
            while process.poll() is None:
                if cancelled.is_set(): reason='cancelled';break
                if time.monotonic()>deadline: reason='timed_out';break
                time.sleep(.02)
            if reason:
                try: os.killpg(process.pid,signal.SIGTERM)
                except ProcessLookupError: pass
                try: process.wait(timeout=.5)
                except subprocess.TimeoutExpired:
                    try: os.killpg(process.pid,signal.SIGKILL)
                    except ProcessLookupError: pass
                    process.wait()
                return 409,{'error':{'code':reason}}
            if process.returncode: return 422,{'error':{'code':'invalid_input' if process.returncode==2 else 'engine_error'}}
            stdout.seek(0);raw=stdout.read(4194305)
            if len(raw)>4194304: return 422,{'error':{'code':'output_limit'}}
            result=json.loads(raw,parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            result['diagnostics']['adapter_sha256']=hashlib.sha256(open('/worker/execute.py','rb').read()).hexdigest()
            result['diagnostics']['worker_image_digest']=os.environ.get('WORKER_IMAGE_DIGEST') or None
            return 200,result
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*_): pass
    def reply(self,status,data):
        body=json.dumps(data,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers()
        try: self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError): pass
    def do_GET(self):
        self.reply(200 if self.path=='/health' else 404,{'status':'ok','engine':ENGINE,'execution_available':bool(MODELS.get(ENGINE)) and len(TOKEN)>=32,'models':MODELS.get(ENGINE,[])})
    def do_POST(self):
        if len(TOKEN)<32 or not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+TOKEN): return self.reply(401,{'error':{'code':'unauthorized'}})
        if self.path.startswith('/v1/jobs/') and self.path.endswith('/cancel'):
            with lock: cancellation=active.get(self.path.split('/')[3])
            if cancellation: cancellation.set()
            return self.reply(202 if cancellation else 404,{'cancellation_requested':bool(cancellation)})
        if self.path!='/v1/execute': return self.reply(404,{'error':{'code':'not_found'}})
        try:
            self.connection.settimeout(5);length=int(self.headers.get('Content-Length','0'))
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type')!='application/json' or not 0<length<=65536: raise ValueError()
            job=json.loads(self.rfile.read(length));validate(job)
        except (ValueError,TypeError,KeyError,TimeoutError): return self.reply(400,{'error':{'code':'invalid_input'}})
        if not slots.acquire(blocking=False): return self.reply(429,{'error':{'code':'busy'}})
        cancelled=threading.Event()
        with lock: active[job['job_id']]=cancelled
        try:
            try: status,result=execute(job,cancelled)
            except Exception: status,result=500,{'error':{'code':'engine_error'}}
            self.reply(status,result)
        finally:
            with lock: active.pop(job['job_id'],None)
            slots.release()
if __name__=='__main__': ThreadingHTTPServer(('0.0.0.0',8080),Handler).serve_forever()
