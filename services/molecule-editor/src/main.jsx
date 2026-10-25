import React from 'react';
import {createRoot} from 'react-dom/client';
import {Editor} from 'ketcher-react';
import {StandaloneStructServiceProvider} from 'ketcher-standalone/dist/binaryWasm';
import 'ketcher-react/dist/index.css';
import './style.css';
import protocol from './protocol.cjs';
const {CHANNEL,VERSION,validMessage}=protocol;
const session=new URLSearchParams(location.hash.slice(1)).get('session');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
let editor=null,root=null,closing=false,chain=Promise.resolve();
const services=new Set();
class OwnedProvider extends StandaloneStructServiceProvider{
 createStructService(options){const service=super.createStructService(options),destroy=service.destroy.bind(service);let disposed=false;service.destroy=()=>{if(disposed)return;disposed=true;services.delete(service);destroy()};if(closing)service.destroy();else services.add(service);return service}
}
function dispose(){if(closing)return;closing=true;window.dispatchEvent(new Event('senku-editor-dispose'));window.removeEventListener('message',onMessage);editor=null;if(root){root.unmount();root=null}for(const service of [...services])service.destroy()}
window.addEventListener('pagehide',dispose,{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted&&closing)location.reload()});
function send(type,request_id,extra={}){if(!closing&&window.parent!==window&&uuid.test(session||''))window.parent.postMessage({channel:CHANNEL,version:VERSION,session,type,request_id,...extra},location.origin)}
function status(text){if(!closing)document.getElementById('status').textContent=text}
function onMessage(event){
 if(closing)return;
 if(event.origin!==location.origin||event.source!==window.parent||!validMessage(event.data,session)||!['load','export'].includes(event.data.type))return;
 const request=event.data;
 chain=chain.then(async()=>{
  if(closing)return;
  if(!editor){send('error',request.request_id,{message:'The drawing is still opening. Please try again.'});return}
  try{
   if(request.type==='load'){
    if(request.format==='molfile'&&!/\bM  END\b/.test(request.structure))throw Error('structure');
    await editor.setMolecule(request.structure);
    if(closing)return;send('loaded',request.request_id);status('Drawing ready. Select an atom or bond to edit.');
   }else{
    const smiles=await editor.getSmiles();
    if(closing)return;const molfile=await editor.getMolfile();
    if(closing)return;
    if(!smiles?.trim())throw Error('empty');
    const result={channel:CHANNEL,version:VERSION,session,type:'result',request_id:request.request_id,smiles,molfile};
    if(!validMessage(result,session))throw Error('size');
    window.parent.postMessage(result,location.origin);status('Your drawing is ready to use.');
   }
  }catch(error){const message=error.message==='empty'?'Draw a molecule first.':error.message==='size'?'This drawing is too large. Use a smaller molecule.':'That structure could not be opened. Check the molecule code or file.';send('error',request.request_id,{message});status(message)}
 });
}
window.addEventListener('message',onMessage);
if(!uuid.test(session||'')){status('Open this drawing from your Senku workspace.')}else{
 const provider=new OwnedProvider();
 root=createRoot(document.getElementById('root'));root.render(<Editor staticResourcesUrl="/editor/" structServiceProvider={provider} disableMacromoleculesEditor={true} buttons={{about:{hidden:true},help:{hidden:true},miew:{hidden:true},recognize:{hidden:true},fullscreen:{hidden:true},'create-monomer':{hidden:true},'reaction-plus':{hidden:true},arrows:{hidden:true},'reaction-mapping-tools':{hidden:true}}} errorHandler={()=>status('Check your drawing and try again.')} onInit={instance=>{if(closing)return;editor=instance;window.dispatchEvent(new Event('senku-editor-ready'));status('Drawing ready. Select an atom or bond to edit.');send('ready',crypto.randomUUID())}}/>);
}
