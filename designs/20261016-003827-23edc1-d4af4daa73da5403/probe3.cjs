const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const path = require('path');
const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = path.join(__dirname, 'proof');
const URL = 'http://localhost:1420/demo-visuals.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: EXE,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(2800);
  await page.evaluate('__demo.setMode("synced")'); await page.evaluate('__demo.seek(9200)');

  // 1: force pure white
  await page.evaluate('window.__lyricColor="#ffffff"');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT,'dbg-white.png'), clip:{x:200,y:380,width:880,height:200} });

  // 2: force pure red
  await page.evaluate('window.__lyricColor="#ff0000"');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT,'dbg-red.png'), clip:{x:200,y:380,width:880,height:200} });

  // 3: back to palette accent
  await page.evaluate('window.__lyricColor=null');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT,'dbg-accent.png'), clip:{x:200,y:380,width:880,height:200} });

  await browser.close();
  console.log('done');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
