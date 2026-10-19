const { chromium } = require('/home/icey/Projects/autoshopy/node_modules/playwright');
const EXE = '/home/icey/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const URL = 'http://localhost:1420/demo-visuals.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: EXE,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => console.log('[pg]', m.type(), m.text()));
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(2500);
  await page.evaluate('__demo.setMode("synced")'); await page.evaluate('__demo.seek(9200)');
  await sleep(1200);
  // introspect the engine internals via a debug hook we add on window
  const info = await page.evaluate(async () => {
    // reach the troika Text objects through the scene graph if exposed; else
    // create a scratch Text to compare material state
    const mod = await import('/src/visuals/engine.ts').catch(e=>({err:String(e)}));
    // try to find any Text via window — engine doesn't expose scene; instead
    // build a probe Text directly
    const { Text } = await import('/node_modules/troika-three-text/dist/troika-three-text.esm.js').catch(e=>({err:String(e)}));
    if (!Text) return { err: 'no Text import' };
    const t = new Text();
    t.text = 'probe';
    t.fontSize = 0.2;
    return {
      colorType: typeof t.color,
      colorVal: t.color && t.color.getHexString ? '#'+t.color.getHexString() : String(t.color),
      hasMaterial: !!t.material,
      matType: t.material && t.material.type,
      matColor: t.material && t.material.color && t.material.color.getHexString ? '#'+t.material.color.getHexString() : null,
      transparent: t.material && t.material.transparent,
      defaults: {
        fillOpacity: t.fillOpacity, outlineWidth: t.outlineWidth,
        sdfGlyphSize: t.sdfGlyphSize,
      },
    };
  });
  console.log('PROBE', JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
