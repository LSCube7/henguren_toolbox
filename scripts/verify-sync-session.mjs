import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const {mergeVocabSnapshots,parseVocabSnapshot}=await import('../src/lib/vocab-sync.ts');
const baseUrl=process.env.SYNC_TEST_BASE_URL || 'http://localhost:3016';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(baseUrl).hostname),'Browser regression must use a local fixture server');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
const day='2026-01-01T00:00:00.000Z',owner='account:"A"';
const record=name=>({id:'unit:'+name,word:name,sourceName:'unit',definitions:['test'],wrongCount:1,wrongAttempts:[{id:'attempt-'+name,clientId:'browser',createdAt:day}],createdAt:day,updatedAt:day});
const mastery=name=>({id:'unit:'+name,level:'reviewing',correctStreak:1,reviewCount:1,lastReviewedAt:day,nextReviewAt:day,updatedAt:day,wrongAttemptIds:['attempt-'+name]});
const empty=()=>parseVocabSnapshot({schemaVersion:2,userId:'A',clientId:'cloud',records:[],deletedRecords:[],deletedBatches:[],updatedAt:day,learningSchemaVersion:1,masteryRecords:[]},'A');
let cloud=empty(),versionNumber=0,heads=0,user='A',unauthorized=false,denied=0,denialMode="all";
const wait=async(fn)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Condition timed out');};
try{
 const context=await browser.newContext({serviceWorkers:'block',locale:'zh-CN'});
 await context.addInitScript(({owner,words,masteryRecords,day})=>{
  localStorage.setItem('henguren-v3-onboarding',JSON.stringify({completed:true}));localStorage.setItem('henguren-v3-settings',JSON.stringify({locale:'zh-CN'}));localStorage.setItem('henguren-v3-edition','senior');
  if(localStorage.getItem('auto-seeded'))return;localStorage.setItem('auto-seeded','1');
  const r=indexedDB.open('henguren-v3',3);r.onupgradeneeded=()=>{for(const name of ['wrongbook','wrongbook-meta','learning-partitions','learning-state'])r.result.createObjectStore(name,{keyPath:name==='learning-partitions'?'owner':'id'});};
  r.onsuccess=()=>{const db=r.result;const tx=db.transaction(['learning-partitions','learning-state'],'readwrite');tx.objectStore('learning-state').put({id:'active',owner});tx.objectStore('learning-state').put({id:'migration',version:1});tx.objectStore('learning-partitions').put({owner,wrongbook:{schemaVersion:2,userId:'local',clientId:'browser',records:words,deletedRecords:[],deletedBatches:[],updatedAt:day},masteryRecords,sync:{enabled:false,localVersion:0,confirmedVersion:-1}});tx.oncomplete=()=>db.close();};
 },{owner,words:[record('alpha'),record('beta')],masteryRecords:[mastery('alpha'),mastery('beta')],day});
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/me')return route.fulfill({json:{authenticated:!!user,user:user?{id:user,name:'账户'+user,email:'a@example.invalid',avatarUrl:'/avatar-test.svg'}:null}});
  if(path==='/api/auth/logout'){user=null;return route.fulfill({json:{ok:true}});}
  if(path==='/api/settings')return route.fulfill({json:{available:false}});
  if(path.startsWith('/api/wrongbook')){
   if(unauthorized&&(denialMode==="all"||url.searchParams.has("versionOnly"))){denied++;return route.fulfill({status:401,json:{error:'UNAUTHORIZED'}});}
   if(!user)return route.fulfill({status:401,json:{error:'UNAUTHORIZED'}});
   if(url.searchParams.has('versionOnly')){heads++;return route.fulfill({json:{version:'v'+versionNumber}});}
   if(route.request().method()==='GET'){return route.fulfill({json:cloud,headers:{'X-Sync-Version':'v'+versionNumber}});}
   versionNumber++;const incoming=route.request().postDataJSON();const version='v'+versionNumber;
   cloud=mergeVocabSnapshots(user,cloud,incoming);
   return route.fulfill({json:cloud,headers:{'X-Sync-Version':version}});
  }
  return route.abort();
 });
 await context.route('**/avatar-test.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#bde"/></svg>'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(async owner=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('henguren-v3',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const p=await new Promise(resolve=>{const r=db.transaction('learning-partitions').objectStore('learning-partitions').get(owner);r.onsuccess=()=>resolve(r.result);});db.close();return p;},owner);


 await page.goto(baseUrl+'/zh-CN/user');await page.getByText('当前学习数据属于“账户A”。',{exact:true}).waitFor();
 const trigger=page.getByRole('button',{name:/同步设置 ·/}),panel=page.getByRole('dialog',{name:'同步',exact:true});
 assert.ok(await page.locator('.user-nav-avatar').count()>0);const before=await read();unauthorized=true;await page.reload();await trigger.click();await panel.waitFor();await panel.getByRole('button',{name:'登录 CubeID',exact:true}).waitFor();
 assert.equal(await panel.locator('md-switch').count(),0);assert.equal(await page.locator('.user-nav-avatar').count(),0);await panel.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'账户菜单',exact:true}).click();await page.getByRole('menuitem',{name:'重新登录',exact:true}).waitFor();await page.keyboard.press('Escape');assert.deepEqual((await read()).wrongbook,before.wrongbook);assert.deepEqual((await read()).masteryRecords,before.masteryRecords);
 unauthorized=false;await page.reload();await trigger.click();await panel.waitFor();await panel.locator('md-switch').click();await wait(()=>read().then(p=>p.sync.enabled));await wait(()=>panel.getByRole('button',{name:'立即同步',exact:true}).isEnabled());
 unauthorized=true;await panel.getByRole('button',{name:'立即同步',exact:true}).click();await panel.getByRole('button',{name:'登录 CubeID',exact:true}).waitFor();await wait(()=>trigger.getAttribute('data-status').then(s=>s==='signed-out'));assert.equal((await read()).sync.enabled,true);const after401=denied;await new Promise(r=>setTimeout(r,16000));assert.equal(denied,after401,'401 pauses automatic retries');assert.equal((await read()).wrongbook.records.length,2);
 unauthorized=false;await page.reload();await trigger.click();await panel.waitFor();await panel.getByRole('button',{name:'立即同步',exact:true}).waitFor();await wait(()=>trigger.getAttribute('data-status').then(s=>s!=='signed-out'));await panel.locator('md-switch').click();await wait(()=>read().then(p=>!p.sync.enabled));
 // A clean account with automatic sync enabled reaches the version-only path.
 await page.evaluate(async owner=>{const db=await new Promise(resolve=>{const r=indexedDB.open('henguren-v3',3);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('learning-partitions','readwrite'),store=tx.objectStore('learning-partitions'),r=store.get(owner);r.onsuccess=()=>{const p=r.result;p.sync.enabled=true;p.sync.confirmedVersion=p.sync.localVersion;p.sync.lastCheckAt=0;store.put(p);};tx.oncomplete=resolve;});db.close();},owner);
 denialMode='version';unauthorized=true;await page.reload();await trigger.click();await panel.waitFor();await panel.getByRole('button',{name:'登录 CubeID',exact:true}).waitFor();assert.ok(heads===0&&denied>0);assert.equal((await read()).sync.enabled,true);assert.equal((await read()).wrongbook.records.length,2);assert.deepEqual(errors,[]);console.log('PASS 401: initial summary, version-only check and manual write clear account identity, show re-login, retain partition, halt retries and recover after re-login.');
}finally{await browser.close();}
