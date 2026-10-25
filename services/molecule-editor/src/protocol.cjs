'use strict';
const CHANNEL='senku-molecule-editor', VERSION=1;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const types=new Set(['load','export','ready','loaded','result','error']);
function validMessage(value,session){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.channel!==CHANNEL||value.version!==VERSION||value.session!==session||!uuid.test(session)||!types.has(value.type)||!uuid.test(value.request_id))return false;
 if(Object.keys(value).some(k=>!['channel','version','session','request_id','type','format','structure','smiles','molfile','message'].includes(k)))return false;
 if(value.type==='load')return ['smiles','molfile'].includes(value.format)&&typeof value.structure==='string'&&value.structure.length<=(value.format==='smiles'?256:100000);
 if(value.type==='result')return typeof value.smiles==='string'&&value.smiles.length>0&&value.smiles.length<=256&&typeof value.molfile==='string'&&value.molfile.length<=100000;
 if(value.type==='error')return typeof value.message==='string'&&value.message.length<=240;
 return true;
}
module.exports={CHANNEL,VERSION,validMessage};
