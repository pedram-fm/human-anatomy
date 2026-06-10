import puppeteer from 'puppeteer-core';

const URL = process.env.URL || 'http://localhost:3003';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500)); // let skeleton GLB load + first frames
const loadMs = Date.now() - t0;

// resource timings for the GLBs
const res = await page.evaluate(() =>
  performance.getEntriesByType('resource')
    .filter((r) => r.name.includes('/models/'))
    .map((r) => ({ name: r.name.split('/').pop(), ms: Math.round(r.duration) })));

async function fps(ms = 2500) {
  return page.evaluate((dur) => new Promise((resolve) => {
    let n = 0; const start = performance.now();
    function tick(t) { n++; if (t - start < dur) requestAnimationFrame(tick); else resolve(Math.round((n / (t - start)) * 1000)); }
    requestAnimationFrame(tick);
  }), ms);
}

const fpsSkeleton = await fps();
await page.screenshot({ path: '/tmp/shot_1_skeleton.png' });

// toggle the Muscles layer on (click the Layers-panel button labelled "Muscles")
const toggled = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((x) => x.textContent.trim().startsWith('Muscles'));
  if (b) { b.click(); return true; } return false;
});
await new Promise((r) => setTimeout(r, 4000)); // muscular GLB (3.3MB) load + decode
const fpsBoth = await fps();
await page.screenshot({ path: '/tmp/shot_2_muscles.png' });

// turn OFF superficial sublayer to reveal deep
const supOff = await page.evaluate(() => {
  const cb = [...document.querySelectorAll('label')].find((l) => /superficial/i.test(l.textContent));
  const input = cb && cb.querySelector('input');
  if (input) { input.click(); return true; } return false;
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: '/tmp/shot_3_superficial_off.png' });

// select a structure from the sidebar list (search 'biceps' first to surface it)
await page.evaluate(() => {
  const i = document.querySelector('input[type="text"]'); if (i) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, 'biceps brachii');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await new Promise((r) => setTimeout(r, 600));
const picked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /biceps brachii/i.test(x.textContent) && x.className.includes('text-left'));
  if (b) { b.click(); return b.textContent.trim(); } return null;
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: '/tmp/shot_4_selected.png' });

console.log(JSON.stringify({
  loadMs, glbTimings: res, fpsSkeleton, fpsBoth,
  toggledMuscles: toggled, superficialOff: supOff, picked,
  errorCount: errors.length, errors: errors.slice(0, 8),
}, null, 2));

await browser.close();
