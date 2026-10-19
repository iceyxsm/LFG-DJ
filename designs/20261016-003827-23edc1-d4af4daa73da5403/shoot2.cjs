const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = path.join(__dirname, 'proof');
const URL = 'http://localhost:1420/demo-visuals.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: EXE,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (['error','warning'].includes(m.type())) errs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(()=>{});
  await page.evaluate('__demo.setMode("synced")');
  await page.evaluate('__demo.seek(9200)');
  await sleep(1600);
  await page.screenshot({ path: path.join(OUT,'synced-active.png') });
  // zoom into the active lyric (centre band)
  await page.screenshot({ path: path.join(OUT,'lyric-crop.png'), clip:{x:320,y:410,width:640,height:170} });
  await sleep(400);
  await page.evaluate('__demo.seek(20500)'); await sleep(1400);
  await page.screenshot({ path: path.join(OUT,'synced-late.png') });
  console.log('errors:', errs.length?errs.join('\n'):'(none)');
  await browser.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
