// Desktop World Slicer smoke check. Start the dev server, then run PORT=5173 node scripts/map-check.mjs.
// Uses shipped place data, live map tiles and real simulator workers; no generated model responses.
import {Shot} from './film-lib.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const out=process.env.OUT??'test-results/map-place';mkdirSync(out,{recursive:true});
const defs=JSON.parse(readFileSync('public/assets/places/slicer-defaults.json','utf8')).places;
const shot=new Shot({name:'map-place',outDir:'/tmp',fps:24,width:1280,height:720});await shot.open('about:blank');const p=shot.page,errors=[],results=[];
p.on('pageerror',e=>errors.push(e.message));
async function ready(check,timeout=120000){ const until=Date.now()+timeout; while(Date.now()<until){await shot.advance(250); if(await p.evaluate(check))return; await p.waitForTimeout(100);} throw Error('Condition timed out: '+check); }
async function open(extra=''){
 await p.goto(`http://localhost:${process.env.PORT??5173}/?mode=map&flight=0&streetphotos=0${extra}`,{waitUntil:'domcontentloaded',timeout:120000});await shot.advance(1000);
 await ready(()=>document.documentElement.dataset.mapready==='true'&&Number(document.documentElement.dataset.readyPlaces)>0);console.log('Map ready');
}
async function pick(slug){
 await p.locator('#ready-gallery-btn').click();
 await p.locator(`button.card[data-slug="${slug}"]`).first().evaluate(el=>el.click());await shot.advance(1000);
 if(await p.locator('#build').count())throw Error('Duplicate build button remains');
 if(!await p.locator('#slicer').evaluate(el=>el.hidden))throw Error('Previous place controls remained visible');
 await p.locator('#slice').click();await shot.advance(1000);
}
try{
 await open();
 for(const slug of ['edinburgh-old-town','montmartre-paris','shibuya-tokyo']){
  await pick(slug);
  await ready(()=>document.documentElement.dataset.sliceOpening==='ready'&&document.documentElement.dataset.sliceLane==='clearable'&&document.documentElement.dataset.sliceVerified==='agrees',180000); console.log('Passing start:',slug);await shot.advance(1000);
  const state=await p.evaluate(()=>({cut:Number(document.querySelector('#cut').value),shrunk:Number(document.querySelector('#shrink').value),disabled:document.querySelector('#buildpieces').disabled,read:document.querySelector('#sliceread').textContent,width:document.querySelector('#slice').getBoundingClientRect().width,side:document.querySelector('.side').clientWidth}));
  const d=defs.find(d=>d.slug===slug);if(state.cut!==d.cutM||state.disabled||Math.abs(state.width-(state.side-20))>2)throw Error('Invalid opening or width: '+JSON.stringify(state));
  results.push({slug,...state});
 }
 await p.locator('#slice').scrollIntoViewIfNeeded();await shot.advance(100);await p.screenshot({path:out+'/slice-full-width.jpg',type:'jpeg',quality:85});
 await p.locator('#buildpieces').scrollIntoViewIfNeeded();await shot.advance(100);await p.screenshot({path:out+'/passing-start.jpg',type:'jpeg',quality:85});
 await p.locator('#pickclear').click();if(!await p.locator('#buildpieces').isDisabled())throw Error('Picking change left Send enabled');
 await p.locator('#snapbest').click();await p.waitForFunction(()=>document.documentElement.dataset.sliceLane==='clearable'&&!document.querySelector('#buildpieces').disabled,null,{polling:100,timeout:120000});
 await p.locator('#buildpieces').click();await p.waitForURL(u=>u.searchParams.get('mode')==='editor',{waitUntil:'domcontentloaded',timeout:60000});await shot.advance(1000);
 await p.waitForFunction(()=>document.documentElement.dataset.laneClear==='1',null,{polling:100,timeout:180000});results.push({editorHandoff:'clears'});console.log('Editor handoff clears');
 await open('&hills=0');await pick('shibuya-tokyo');
 await ready(()=>['ready','unavailable'].includes(document.documentElement.dataset.sliceOpening),240000);await shot.advance(1000);
 const fallback=await p.evaluate(()=>({opening:document.documentElement.dataset.sliceOpening,lane:document.documentElement.dataset.sliceLane,disabled:document.querySelector('#buildpieces').disabled,say:document.querySelector('#say').textContent}));
 if(fallback.opening!=='ready'||fallback.lane!=='clearable'||fallback.disabled)throw Error('Live fallback failed: '+JSON.stringify(fallback));results.push({liveFallback:fallback});
 if(errors.length)throw Error(errors.join('\n'));writeFileSync(out+'/run.json',JSON.stringify({results,errors},null,2)+'\n');console.log(JSON.stringify({results,errors},null,2));
}catch(e){await p.screenshot({path:out+'/failure.jpg',type:'jpeg',quality:85});console.log('FAILED',String(e));console.log(await p.locator('#say').textContent().catch(()=>''));throw e}finally{await shot.close()}
