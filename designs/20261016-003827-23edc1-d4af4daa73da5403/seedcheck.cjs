// palette-variety proof: same engine, different track seeds → different worlds
const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = path.join(__dirname, 'proof');
const URL = 'http://localhost:1420/demo-visuals.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function decodePNG(p){const buf=fs.readFileSync(p);let pos=8,W=0,H=0,ct=0;const idat=[];
  while(pos<buf.length){const len=buf.readUInt32BE(pos),t=buf.toString('ascii',pos+4,pos+8),d=buf.slice(pos+8,pos+8+len);
    if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];} if(t==='IDAT')idat.push(d);if(t==='IEND')break;pos+=12+len;}
  const raw=zlib.inflateSync(Buffer.concat(idat));const ch=ct===6?4:ct===2?3:1,st=W*ch,out=Buffer.alloc(W*H*ch);let prev=Buffer.alloc(st);
  for(let y=0;y<H;y++){const f=raw[y*(st+1)],ln=raw.slice(y*(st+1)+1,(y+1)*(st+1)),cur=Buffer.alloc(st);
    for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,b=prev[x],c=x>=ch?prev[x-ch]:0;let v=ln[x];
      if(f===1)v=(v+a)&255;else if(f===2)v=(v+b)&255;else if(f===3)v=(v+((a+b)>>1))&255;
      else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255;}cur[x]=v;}
    cur.copy(out,y*st);prev=cur;}return{W,H,ch,data:out};}
function dominant(p){const{W,H,ch,data}=decodePNG(p);let r=0,g=0,b=0;for(let i=0;i<data.length;i+=ch){r+=data[i];g+=data[i+1];b+=data[i+2];}const n=W*H;return[r/n|0,g/n|0,b/n|0];}
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'load' }); await sleep(2500);
  await page.evaluate('__demo.setMode("synced")');
  const seeds = [['demo-track-001','t-green'],['aqua-drive|neon-coast','t-aqua'],['ember-fall|rue','t-ember'],['violet-hour|iris','t-violet'],['solar-plexus|sun','t-solar']];
  for (const [seed,name] of seeds) {
    await page.evaluate(`__demo.setTrack(${JSON.stringify(seed)})`); await page.evaluate('__demo.seek(9200)');
    await sleep(1600);
    const f = path.join(OUT, name+'.png'); await page.screenshot({ path: f });
    console.log(name, 'meanRGB=', dominant(f).join(','));
  }
  await b.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1)});
