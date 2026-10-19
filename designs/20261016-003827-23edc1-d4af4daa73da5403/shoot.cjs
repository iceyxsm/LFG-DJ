/* headless render check for the visuals engine demo page */
const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = path.join(__dirname, 'proof');
const URL = 'http://localhost:1420/demo-visuals.html';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXE,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox', '--no-sandbox',
      '--force-color-profile=srgb',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 15000 }).catch(()=>errors.push('[warn] __ready timeout'));
  await sleep(1500); // let a few hundred frames accumulate + trail build

  const shots = [
    { name: 'synced-active',  setup: async ()=>{ await page.evaluate('__demo.setMode("synced")'); await page.evaluate('__demo.seek(9200)'); } },
    { name: 'synced-late',    setup: async ()=>{ await page.evaluate('__demo.seek(20500)'); } },
    { name: 'plain',          setup: async ()=>{ await page.evaluate('__demo.setMode("plain")'); } },
    { name: 'attract',        setup: async ()=>{ await page.evaluate('__demo.setMode("attract")'); } },
    { name: 'none',           setup: async ()=>{ await page.evaluate('__demo.setMode("none")'); } },
    { name: 'paused',         setup: async ()=>{ await page.evaluate('__demo.setMode("synced")'); await page.evaluate('__demo.seek(8200)'); await page.evaluate('__demo.pause()'); } },
  ];

  for (const s of shots) {
    await page.evaluate('__demo.pause && window.__demo.pause ? 0 : 0'); // noop
    // reset to playing for non-paused shots
    if (s.name !== 'paused') { await page.evaluate('(()=>{ if(window.__dj) {} })()'); }
    await s.setup();
    await sleep(1400);
    const p = path.join(OUT, `${s.name}.png`);
    await page.screenshot({ path: p });
    console.log('shot', p);
  }

  // a 2x crop of the active lyric line to check SDF clarity
  await page.evaluate('__demo.setMode("synced")');
  await page.evaluate('__demo.seek(12500)');
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, 'lyric-crop.png'), clip: { x: 320, y: 400, width: 640, height: 160 } });
  console.log('shot', path.join(OUT,'lyric-crop.png'));

  console.log('--- console/page errors ---');
  console.log(errors.length ? errors.slice(0,40).join('\n') : '(none)');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
