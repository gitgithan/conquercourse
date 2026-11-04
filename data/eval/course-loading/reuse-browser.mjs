import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const port=process.env.PORT??5399, out=process.env.OUT??'reuse-output'; mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1280,height:800}});
await context.addInitScript(()=>{localStorage.setItem('cc.next.seen','1');window.__documentToken=Math.random();});
const page=await context.newPage(), errors=[], results=[]; page.on('pageerror',e=>errors.push(e.message));
const cdp=await context.newCDPSession(page);
const assert=(condition,message)=>{if(!condition)throw Error(message);};
async function listeners(){const {result}=await cdp.send('Runtime.evaluate',{expression:'window'});const {listeners}=await cdp.send('DOMDebugger.getEventListeners',{objectId:result.objectId});return listeners.reduce((a,l)=>(a[l.type]=(a[l.type]??0)+1,a),{});}
async function frames(){return page.evaluate(()=>performance.getEntriesByName('course:first-frame').length);}
async function waitFrame(before){await page.waitForFunction(n=>performance.getEntriesByName('course:first-frame').length>n,before,{timeout:120000});}
async function choose(label){await page.locator('#sitenav button').first().click();await page.locator('#world-gallery').waitFor();const before=await frames();await page.evaluate(()=>performance.mark('reuse:selection'));const start=Date.now();await page.locator('#world-gallery .wg-card').filter({hasText:label}).first().click();await waitFrame(before);return {wallMs:Date.now()-start,...await page.evaluate(()=>({name:document.documentElement.dataset.courseName,ms:Math.round(performance.getEntriesByName('course:first-frame').at(-1).startTime-performance.getEntriesByName('reuse:selection').at(-1).startTime),sameCanvas:window.__canvas===document.querySelector('canvas'),token:window.__documentToken,searches:window.__searchStats,resources:performance.getEntriesByType('resource').filter(r=>/\/assets\/(motion|characters)\//.test(r.name)).map(r=>new URL(r.name).pathname)})),listeners:await listeners()};}
try{
 const cold=Date.now();await page.goto(`http://localhost:${port}/?welcome=0`,{waitUntil:'domcontentloaded',timeout:120000});await waitFrame(0);
 const token=await page.evaluate(()=>{window.__canvas=document.querySelector('canvas');return window.__documentToken;});
 results.push({label:'cold',wallMs:Date.now()-cold,listeners:await listeners()}); console.log('cold',Date.now()-cold);
 for(const [label,text] of [['training','Training course: every move'],['montmartre','Montmartre, Paris'],['training-repeat','Training course: every move']]){
  const result=await choose(text);assert(result.sameCanvas,'Canvas replaced');assert(result.token===token,'Document replaced');results.push({label,...result}); console.log(label,JSON.stringify(result)); writeFileSync(out+'/partial.json',JSON.stringify(results,null,2));
  for(const id of ['courses-btn','ghost-hud','perf','graphchip','soundbutton'])assert(await page.locator('#'+id).count()===1,'Duplicate or missing '+id);
 }
 let count=await frames();await page.evaluate(()=>history.back());await waitFrame(count);assert((await page.title())!==null,'Back failed');assert((await page.evaluate(()=>document.documentElement.dataset.courseName)).toLowerCase().includes('montmartre'),'Wrong course after Back');
 count=await frames();await page.evaluate(()=>history.forward());await waitFrame(count);assert((await page.evaluate(()=>document.documentElement.dataset.courseName)).includes('Training'),'Wrong course after Forward');
 const x=await page.evaluate(()=>Number(document.documentElement.dataset.x));await page.keyboard.down('KeyD');await page.waitForFunction(x=>Number(document.documentElement.dataset.x)>x+0.2,x,{timeout:30000});await page.keyboard.up('KeyD');
 await page.keyboard.press('KeyR');await page.waitForTimeout(400);
 await page.route('**/assets/experiments/osm/montmartre-paris.course.json',route=>route.fulfill({status:503,body:'Unavailable'}));
 const oldURL=page.url();await page.locator('#sitenav button').first().click();await page.locator('#world-gallery .wg-card').filter({hasText:'Montmartre, Paris'}).first().click();await page.locator('#course-loading').filter({hasText:'Could not open'}).waitFor();assert(page.url()===oldURL,'Failed fetch changed URL');
 await page.locator('#course-loading').click();await page.unroute('**/assets/experiments/osm/montmartre-paris.course.json');
 const retry=await choose('Montmartre, Paris');results.push({label:'retry',...retry});
 await page.screenshot({path:out+'/course-reused.png'});
 assert(errors.length===0,'Browser errors: '+errors.join('; '));
 writeFileSync(out+'/run.json',JSON.stringify({port,results,errors,checks:['same document and canvas','one HUD and input set','Back and Forward','keyboard run and restart','failed fetch retains old course','retry succeeds']},null,2));
 console.log(JSON.stringify({results:results.map(({label,ms,wallMs,listeners,resources})=>({label,ms,wallMs,listeners,assetRequests:resources?.length})),errors},null,2));
}finally{await browser.close();}
