import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=`http://localhost:${process.env.PORT??5420}`, out=process.env.OUT??'test-results/missing-moves';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await browser.newContext({viewport:{width:1280,height:900}}),checks={},errors=[];
const check=(name,ok)=>{checks[name]=!!ok;if(!ok)throw Error(name);};
await ctx.addInitScript(()=>{
 localStorage.setItem('cc.world.v1',JSON.stringify({pieces:[{src:'box:30:0.5:1.8',x:15,z:0,y:0,yaw:0,scale:1},{src:'box:2:4:1.8',x:31,z:0,y:0,yaw:0,scale:1}],angle:0,offset:0,level:0,floor:'water'}));
});
const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));let live=0,made=0;
p.on('worker',w=>{if(!w.url().includes('/roles-worker.ts'))return;live++;made++;w.on('close',()=>live--);});
async function waitGone(){for(let i=0;i<40&&live;i++)await p.waitForTimeout(50);check('role worker terminated',live===0);}
async function beginIfFinished(){if(await p.locator('#moves-search-cancel').count()===0)await begin();}
async function begin(){await p.locator('#findways').click();await p.locator('#moves-search-cancel').waitFor({timeout:10000});await p.waitForFunction(()=>document.getElementById('moves-search-status')?.textContent?.includes('Trying change'),null,{timeout:15000});}
try{
 await p.goto(base+'/?mode=editor&welcome=0&backend=webgl2',{waitUntil:'domcontentloaded',timeout:90000});
 await p.waitForFunction(()=>Number(document.documentElement.dataset.pieces)>=2,null,{timeout:90000});
 await p.locator('#movesbtn').click();
 await p.evaluate(()=>{window.__moveTicks=0;window.__movePulse=setInterval(()=>window.__moveTicks++,50);});
 await begin();check('dedicated roles worker started',made>0&&live===1);
 const t=await p.evaluate(()=>window.__moveTicks);await p.waitForTimeout(600);const ticks=await p.evaluate(()=>window.__moveTicks);
 check('UI heartbeat advances during real simulator work',ticks-t>=4);
 check('candidate text explains the work',(await p.textContent('#moves-search-status')).includes('Trying change'));

 const cancelAt=Date.now();await p.locator('#moves-search-cancel').click();await p.waitForFunction(()=>!document.getElementById('findways').disabled,null,{timeout:5000});const cancelMs=Date.now()-cancelAt;
 check('cancel is responsive',cancelMs<2000);await waitGone();check('cancel message is visible',(await p.textContent('#moves')).includes('Search cancelled'));
 await begin();const statusBounds=await p.locator('#moves-search-cancel').boundingBox();check('progress and cancel visible in panel',!!statusBounds&&statusBounds.y>150&&statusBounds.y+statusBounds.height<520);await p.screenshot({path:out+'/searching.png'});await beginIfFinished();await p.locator('#closemoves').click();await waitGone();check('closing Moves stops the search',await p.locator('#moves').evaluate(e=>e.classList.contains('closed')));
 await p.locator('#movesbtn').click();await begin();
 await p.evaluate(()=>{const e=document.getElementById('level');e.value='0.2';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 await waitGone();check('editing invalidates the old search',!await p.locator('#findways').isDisabled());
 await p.waitForTimeout(600);check('old search cannot repaint stale suggestions',await p.locator('#moves .sg .row button').count()===0);
 await p.screenshot({path:out+'/cancelled.png'});
 check('no page errors',errors.length===0);
 writeFileSync(out+'/run.json',JSON.stringify({checks,errors,cancelMs,heartbeatTicksDuring600ms:ticks-t,workersCreated:made},null,2));console.log(JSON.stringify({checks,errors,cancelMs,heartbeatTicksDuring600ms:ticks-t},null,2));
}finally{await browser.close();}
