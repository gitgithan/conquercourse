import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port='5294';
const server=spawn('node',['node_modules/vite/bin/vite.js','--port',port,'--strictPort'],{stdio:'ignore'});
try{
 await new Promise(r=>setTimeout(r,3500));
 const b=await chromium.launch({args:['--use-angle=swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:1280,height:800}});
 await p.goto(`http://localhost:${port}/?mode=map&hooks=1&flight=0`);
 await p.waitForSelector('#ready .card',{timeout:60000});
 await p.waitForTimeout(6000);
 const r=await p.$$eval('#ready .card',c=>({n:c.length,photo:c.filter(x=>x.querySelector('img[src*="thumbs/"]')).length,tile:c.filter(x=>x.querySelector('img[src*="tiles/"]')).length,credits:c.filter(x=>/Photo:/.test(x.textContent)).length}));
 console.log(JSON.stringify(r));
 await p.screenshot({path:'data/eval/cc-212-covers/shots/gallery.png'});
 await p.evaluate(()=>{const e=document.querySelector('#ready');e&&(e.scrollTop=e.scrollHeight)});
 await p.waitForTimeout(800);
 await p.screenshot({path:'data/eval/cc-212-covers/shots/gallery-scrolled.png'});
 await b.close();
}finally{server.kill()}
