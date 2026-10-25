/** Actual drawing/bridge verification against the running app; no paid scientific requests. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const origin=new URL(process.env.SENKU_TEST_URL||'http://localhost:3000').origin;
const directory=path.resolve('artifacts/ci/editor');
let checks=0;
function check(value,message){assert.ok(value,message);checks++}
(async()=>{
 await fs.mkdir(directory,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
 const page=await context.newPage(),errors=[],charged=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin&&/^https?:/.test(url.protocol))external.push(request.url());if(request.method()==='POST'&&/\/v1\/(runs|molecules\/validate|molecular\/screens|companion\/respond|simulation-batches)(?:\?|$)/.test(url.pathname))charged.push(url.pathname)});
 try{
  await page.goto(origin+'/molecules');
  const code=page.getByRole('textbox',{name:'Molecule code SMILES',exact:true}),use=page.getByRole('button',{name:'Use this molecule',exact:true});
  await code.fill('CCO');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Use this molecule'&&!b.disabled),null,{timeout:60000});
  const frame=page.frameLocator('iframe[title="Molecule drawing canvas"]');
  await frame.getByTestId('canvas').getByText('O',{exact:false}).first().waitFor({timeout:20000}).catch(()=>{});
  await use.click();await page.getByText('Drawing added to your molecule code. Validate it before saving or searching.',{exact:true}).waitFor({timeout:20000});
  check(await code.inputValue()==='CCO','Initial molecule must round-trip through the actual editor');
  await frame.getByRole('button',{name:'Clear Canvas (Ctrl+Del)',exact:true}).click();
  await frame.getByRole('button',{name:'Benzene (T)',exact:true}).click();
  const canvas=frame.getByTestId('canvas'),bounds=await canvas.boundingBox();
  await canvas.click({position:{x:bounds.width/2,y:bounds.height/2}});
  await use.click();await page.waitForFunction(()=>{const input=document.querySelector('textarea');return input&&input.value!=='CCO'&&input.value.length>0},null,{timeout:20000});
  const drawn=await code.inputValue();check(drawn.includes('1')&&drawn.length>5,'A ring drawn in the canvas must produce a real molecule code');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download drawing',exact:true}).click();const download=await downloadPromise,file=path.join(directory,'drawn.mol');await download.saveAs(file);
  const mol=await fs.readFile(file,'utf8');check(mol.includes('M  END'),'Downloaded file must be a real MOL structure');check(/\b6\s+6\b.*V2000/.test(mol),'Drawn benzene must contain six atoms and six bonds');
  await frame.getByRole('button',{name:'Clear Canvas (Ctrl+Del)',exact:true}).click();
  await page.locator('input[type="file"][aria-label="Import molecule structure"]').setInputFiles(file);
  await frame.locator('#status').getByText('Drawing ready. Select an atom or bond to edit.',{exact:true}).waitFor();
  await use.click();await page.waitForTimeout(400);check((await code.inputValue()).includes('1'),'Imported structure must export a ring, not an empty or fake result');
  const before=await code.inputValue();
  await page.evaluate(()=>{const iframe=document.querySelector('iframe[title="Molecule drawing canvas"]'),session=new URL(iframe.src).hash.slice(1).split('=')[1];iframe.contentWindow.postMessage({channel:'senku-molecule-editor',version:1,session:crypto.randomUUID(),request_id:crypto.randomUUID(),type:'load',format:'smiles',structure:'N#N'},location.origin);window.postMessage({channel:'senku-molecule-editor',version:1,session,request_id:crypto.randomUUID(),type:'result',smiles:'N#N',molfile:'M  END'},location.origin)});
  await page.waitForTimeout(200);check(await code.inputValue()===before,'Forged parent response must not change the molecule');await use.click();await page.waitForTimeout(400);check(await code.inputValue()===before,'Wrong-session structure request must not change the drawing');
  for(const scale of[100,200]){await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);for(const width of[320,375,768,1440]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Host must not overflow at '+width+' / '+scale+'%');check(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Drawing document must not overflow at '+width+' / '+scale+'%')}}await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.setViewportSize({width:375,height:1000});await page.screenshot({path:path.join(directory,'editor-mobile.png')});await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(directory,'editor-desktop.png')});
  const documentResponse=await fetch(origin+'/editor/');check(documentResponse.ok,'Editor document must load');const html=await documentResponse.text();check(/editor-[A-Z0-9]+\.js/.test(html),'Editor application assets must be content-hashed');check(documentResponse.headers.get('content-security-policy')?.includes("frame-ancestors 'self'"),'Editor must keep its same-origin frame boundary');
  const licenses=await fetch(origin+'/editor/licenses/index.json');check(licenses.ok,'Bundled third-party notices must be available');const notices=await licenses.json();check(notices.some(n=>n.name==='ketcher-react')&&notices.some(n=>n.name==='react'),'Licenses must identify actual editor and rendering packages');
  check(errors.length===0,'No browser exceptions: '+errors.join('; '));check(charged.length===0,'Drawing verification must not submit charged scientific work');check(external.length===0,'Editor and application runtime assets must remain same-origin');
  const report={checks,drawn_smiles:drawn,chargedRequests:charged,externalRequests:external,errors};await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
