const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const path=require('path');
const EXE='/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:EXE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p=await b.newPage({viewport:{width:700,height:340}});
  p.on('console',m=>console.log('[pg]',m.type(),m.text().slice(0,140)));
  await p.goto('http://localhost:1420/demo-troika-iso.html',{waitUntil:'load'});
  await sleep(3500);
  await p.screenshot({path:path.join(__dirname,'proof','troika-iso.png')});
  await b.close(); console.log('done');
})().catch(e=>{console.error('FATAL',e);process.exit(1)});
