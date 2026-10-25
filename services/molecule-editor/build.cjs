const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
(async()=>{
 fs.mkdirSync('dist/assets',{recursive:true});
 const binary=path.dirname(require.resolve('ketcher-standalone/dist/binaryWasm'));
 const options={bundle:true,minify:true,format:'esm',target:'es2022',inject:['src/browser-globals.js','src/resize-lifecycle.mjs'],define:{'process.env.NODE_ENV':'"production"',global:'globalThis'},logLevel:'info'};
 const workerNames=new Map();
 for(const name of fs.readdirSync(binary).filter(name=>/^indigoWorker-[a-f0-9]+\.js$/.test(name))){
  const out='dist/assets/'+name;await esbuild.build({...options,entryPoints:[path.join(binary,name)],outfile:out});
  const hash=crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex').slice(0,16),hashed=`molecule-worker-${hash}.js`;
  fs.renameSync(out,'dist/assets/'+hashed);workerNames.set(name,hashed);
 }
 const result=await esbuild.build({...options,entryPoints:['src/main.jsx'],outdir:'dist/assets',entryNames:'editor-[hash]',metafile:true,loader:{'.svg':'dataurl','.png':'file','.woff':'file','.woff2':'file','.ttf':'file','.gif':'file'},plugins:[{name:'local-molecule-worker',setup(build){build.onLoad({filter:/ketcher-react[\\/]dist[\\/]index\.js$/},args=>{
 const code=fs.readFileSync(args.path,'utf8').replace(/\r\n/g,'\n');
 const first=code.indexOf('function initResize() {'),last=code.indexOf('function toolbarReducer',first);
 if(first<0||last<0||!code.slice(first,last).includes('state.editor.render.update();'))throw Error('Pinned drawing SDK resize adapter no longer matches');
 const adapted=code.slice(0,first)+'function initResize() { return function (dispatch, getState) { return installEditorResize({throttle,dispatch,getState}); }; }\n'+code.slice(last);
 return{contents:adapted,loader:'js',resolveDir:path.dirname(args.path)};
 });build.onLoad({filter:/ketcher-standalone[\\/]dist[\\/]binaryWasm[\\/]main\.js$/},args=>{let code=fs.readFileSync(args.path,'utf8');for(const[name,hashed]of workerNames)code=code.replaceAll(name,hashed);return{contents:code,loader:'js',resolveDir:path.dirname(args.path)}})}}]});
 const notices=[];
 for(const name of ['ketcher-react','ketcher-core','ketcher-standalone','react','react-dom','indigo-ketcher','events']){
  let folder=path.dirname(require.resolve(name==='events'?'events/':name));let manifest;
  for(;;){const file=path.join(folder,'package.json');if(fs.existsSync(file)){const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.name===name){manifest=value;break}}const parent=path.dirname(folder);if(parent===folder)throw Error('Missing package provenance: '+name);folder=parent}
  const destination='dist/licenses/'+name.replace(/[^a-zA-Z0-9._-]/g,'_');fs.mkdirSync(destination,{recursive:true});const files=[];
  for(const entry of fs.readdirSync(folder))if(/^(LICENSE|LICENCE|NOTICE|COPYING)(\..*)?$/i.test(entry)&&fs.statSync(path.join(folder,entry)).isFile()){fs.copyFileSync(path.join(folder,entry),path.join(destination,entry));files.push(entry)}
  notices.push({name,version:manifest.version,license:manifest.license,source:manifest.repository??manifest.homepage,files});
 }
 fs.writeFileSync('dist/licenses/index.json',JSON.stringify(notices,null,2));fs.writeFileSync('dist/licenses/SENKU_EDITOR_CHANGES.txt','Senku adapts the pinned Ketcher 3.18.0 toolbar resize registration to defer until initialization and own listener/timer disposal. Upstream copyright and license notices are retained.\n');
 const [script,info]=Object.entries(result.metafile.outputs).find(([file,value])=>value.entryPoint&&file.endsWith('.js'));
 const css=info.cssBundle;
 for(const entry of fs.readdirSync(binary))if(entry.endsWith('.wasm'))fs.copyFileSync(path.join(binary,entry),path.join('dist/assets',entry));
 fs.writeFileSync('dist/index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Molecule drawing | Senku</title><link rel="stylesheet" href="/editor/${css.replace(/^dist\//,'')}"></head><body><div id="root"></div><p id="status" role="status">Opening your drawing…</p><script type="module" src="/editor/${script.replace(/^dist\//,'')}"></script></body></html>`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
