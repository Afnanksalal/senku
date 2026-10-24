const http = require('node:http');
require.resolve('ketcher-react');
require.resolve('ketcher-standalone');
http.createServer((req,res) => {
  if(req.url !== '/health') { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({status:'ok',service:'molecule-editor-dependencies',editor_available:false}));
}).listen(8080,'0.0.0.0');
