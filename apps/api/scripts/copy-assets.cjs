const fs=require('node:fs');
const path=require('node:path');
const source=path.join(__dirname,'../src/database/migrations');
const target=path.join(__dirname,'../dist/database/migrations');
fs.mkdirSync(target,{recursive:true});
for(const name of fs.readdirSync(source)) if(name.endsWith('.sql')) fs.copyFileSync(path.join(source,name),path.join(target,name));
