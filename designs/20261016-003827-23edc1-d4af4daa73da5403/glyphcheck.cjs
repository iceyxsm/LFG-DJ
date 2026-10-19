// precise lyric-readability check: bright glyph coverage inside the active-line band
const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = path.join(__dirname, 'proof');
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
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:1420/demo-visuals.html', { waitUntil: 'load' }); await sleep(2800);
  await page.evaluate('__demo.setMode("synced")'); await page.evaluate('__demo.seek(9200)');
  await sleep(1600);
  // tight crop on the active lyric (centre band, ~y 380-470 in 720p)
  const crop = { x: 340, y: 400, width: 600, height: 90 };
  const f = path.join(OUT,'glyph-check.png');
  await page.screenshot({ path: f, clip: crop });
  const {W,H,ch,data} = decodePNG(f);
  // count "bright glyph" pixels: luminance high AND warmer than pure white
  let hot=0, dim=0; const cols=new Array(W).fill(0);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*ch,r=data[i],g=data[i+1],b2=data[i+2];
    const l=(r+g+b2)/3; if(l>140){hot++;cols[x]++;} else if(l<70)dim++;}
  const filledCols = cols.filter(c=>c>2).length;
  console.log(`glyph band ${W}x${H}: hot=${(hot/(W*H)*100).toFixed(1)}% dim=${(dim/(W*H)*100).toFixed(1)}% glyphColumns=${(filledCols/W*100).toFixed(0)}%`);
  console.log('contrastRatio~', (hot/Math.max(1,dim)).toFixed(2));
  await b.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1)});
