"""Dependency readiness only. No simulation execution endpoint is exposed."""
import importlib, json, os
from http.server import BaseHTTPRequestHandler, HTTPServer

modules = {"copasi": ["COPASI"], "physicell": [], "numerics": ["numpy", "scipy", "pydantic"], "rdkit": ["rdkit"],
 "cobrapy": ["cobra"], "roadrunner": ["roadrunner"], "tellurium": ["tellurium"],
 "biosimulators": ["biosimulators_utils.sedml.data_model"]}
engine = os.environ["ENGINE"]
for module in modules[engine]: importlib.import_module(module)
if engine == "physicell":
 from pathlib import Path
 assert Path("/opt/physicell/project").is_file()

class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path != "/health": self.send_error(404); return
  body=json.dumps({"status":"ok", "engine":engine,"execution_available":False}).encode()
  self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body)

HTTPServer(("0.0.0.0",8080),Handler).serve_forever()
