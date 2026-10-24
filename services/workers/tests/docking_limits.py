"""Production-bound default and upper effort checks with observed process memory."""
import concurrent.futures,json,pathlib,runpy,time
m=runpy.run_path('/tmp/docking-tests.py');report=[]
for effort,count in [(2,3),(8,5)]:
 j=m['job']('streptavidin','C1[C@H]2[C@@H]([C@@H](S1)CCCCC(=O)O)NC(=O)N2',effort=effort,count=count)
 peak_vms=peak_rss=0;start=time.monotonic()
 with concurrent.futures.ThreadPoolExecutor() as pool:
  future=pool.submit(m['request'],'/v1/execute',j)
  while not future.done():
   for p in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
    try:
     if b'/worker/execute.py' not in p.read_bytes():continue
     fields=dict(line.split(':',1) for line in (p.parent/'status').read_text().splitlines() if ':' in line)
     peak_vms=max(peak_vms,int(fields['VmSize'].split()[0]));peak_rss=max(peak_rss,int(fields['VmRSS'].split()[0]))
    except (OSError,KeyError,ValueError):pass
   time.sleep(.05)
  status,r=future.result()
 assert status==200, r
 report.append({'exhaustiveness':effort,'requested_poses':count,'elapsed_seconds':round(time.monotonic()-start,3),'status':status,'peak_vms_kib':peak_vms,'peak_rss_kib':peak_rss,'scalars':r['scalars']})
 pathlib.Path('/tmp/streptavidin-effort'+str(effort)+'-result.json').write_text(json.dumps(r))
print(json.dumps({'assertions':len(report),'runs':report},indent=2))
