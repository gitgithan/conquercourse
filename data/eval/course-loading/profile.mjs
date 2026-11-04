// Run against an instrumented disposable copy; production game sources are not modified by this harness.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const port=process.env.PORT??5398,out=process.env.OUT??'profile-output';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await browser.newContext({viewport:{width:1280,height:800}});
await ctx.addInitScript(()=>{window.__documentInitAt=performance.now();localStorage.setItem('cc.next.seen','1');window.__loadLongTasks=[];try{new PerformanceObserver(l=>{window.__loadLongTasks.push(...l.getEntries().map(x=>({start:x.startTime,duration:x.duration})));}).observe({type:'longtask',buffered:true});}catch{} });
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
const cdp=await ctx.newCDPSession(p);await cdp.send('Profiler.enable');
async function report(label){
 await p.waitForFunction(()=>performance.getEntriesByName('load:first-frame-end').length>0,null,{polling:100,timeout:180000});
 const data=await p.evaluate(()=>{const mark=Object.fromEntries(performance.getEntriesByType('mark').filter(x=>x.name.startsWith('load:')).map(x=>[x.name,Math.round(x.startTime)])); const frame=mark['load:first-frame-end'];const resources=performance.getEntriesByType('resource').filter(x=>x.startTime<frame).map(x=>({path:new URL(x.name).pathname,start:Math.round(x.startTime),end:Math.round(x.responseEnd),duration:Math.round(x.duration),transfer:x.transferSize,decoded:x.decodedBodySize,initiator:x.initiatorType}));return{path:location.search,backend:document.documentElement.dataset.backend,marks:mark,docInit:window.__documentInitAt,nav:performance.getEntriesByType('navigation').map(x=>({ttfb:x.responseStart,responseEnd:x.responseEnd,unloadStart:x.unloadEventStart,unloadEnd:x.unloadEventEnd,domInteractive:x.domInteractive,dcl:x.domContentLoadedEventEnd,load:x.loadEventEnd})),paints:performance.getEntriesByType('paint').map(x=>({name:x.name,time:x.startTime})),resources,longTasks:window.__loadLongTasks,searches:window.__searchStats};});
 writeFileSync(out+'/'+label+'.json',JSON.stringify(data,null,2));console.log(label,JSON.stringify({marks:data.marks,resources:data.resources.length,bytes:data.resources.reduce((s,r)=>s+r.transfer,0),longTasks:data.longTasks,backend:data.backend,searches:data.searches}));return data;
}
const all=[];
try{
 await cdp.send('Profiler.start');await p.goto(`http://localhost:${port}/?welcome=0`,{waitUntil:'domcontentloaded',timeout:180000});all.push({label:'first-course-cold',...await report('first-course-cold')});
 const profile=await cdp.send('Profiler.stop');writeFileSync(out+'/first-course.cpuprofile',JSON.stringify(profile.profile));
 for(const [label,value] of [['training-gallery','/assets/demo/training.course.json'],['montmartre-gallery','/assets/experiments/osm/montmartre-paris.course.json'],['training-repeat-gallery','/assets/demo/training.course.json']]){
  await p.locator('#sitenav button').first().click();await p.locator('#world-gallery').waitFor({state:'visible'});if(process.env.PAUSE_OLD==='1'){await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});await p.waitForTimeout(1000);}
  const target=p.locator('#world-gallery .wg-card').filter({has:p.locator('span')});
  const card=p.locator('#world-gallery .wg-card').filter({hasText:value.includes('montmartre')?'Montmartre, Paris':'Training course: every move'}).first();
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded',timeout:180000}),card.click()]);all.push({label,...await report(label)});
 }
 writeFileSync(out+'/all.json',JSON.stringify({port,results:all,errors},null,2));
}finally{await browser.close();}
