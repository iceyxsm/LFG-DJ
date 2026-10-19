const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const URL = 'http://localhost:1420/demo-visuals.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: EXE,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('requestfailed', r => console.log('REQFAIL', r.url().slice(0,120)));
  page.on('response', r => { if(r.status()>=400) console.log('HTTP'+r.status(), r.url().slice(0,140)); });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(3000);
  await page.evaluate('__demo.setMode("synced")'); await page.evaluate('__demo.seek(9200)');
  await sleep(1500);
  // snapshot center pixel rows to see if text is opaque or translucent
  const px = await page.evaluate(() => {
    const c = document.querySelector('#visual-canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    return { hasGL: !!g, w: c.width, h: c.height };
  });
  console.log('GL', JSON.stringify(px));
  await browser.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
