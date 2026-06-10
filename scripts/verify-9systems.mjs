import puppeteer from 'puppeteer-core';
const URL = process.env.URL || 'http://localhost:3003';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable', headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const clickByText = (t) => page.evaluate((txt) => {
  const b = [...document.querySelectorAll('button')].find((x) => new RegExp(txt, 'i').test(x.textContent));
  if (b) { b.click(); return true; } return false;
}, t);

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(3500);
await page.screenshot({ path: '/tmp/full_1_skeleton.png' });

for (const layer of ['Organs', 'Vessels', 'Nerves', 'Muscles']) {
  await clickByText('^' + layer);
  await sleep(2500);
}
await page.screenshot({ path: '/tmp/full_2_layers.png' });

const total = await page.evaluate(() => {
  const m = document.body.textContent.match(/(\d+)\s+structures/);
  return m ? m[1] : null;
});

await page.evaluate(() => {
  const i = document.querySelector('input[type="text"]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, 'vertebra t7'); i.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(500);
const pickedVert = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /vertebra t7/i.test(x.textContent) && x.className.includes('text-left'));
  if (b) { b.click(); return b.textContent.trim(); } return null;
});
await sleep(2200);
await page.screenshot({ path: '/tmp/full_3_vertebra.png' });

console.log(JSON.stringify({ total, pickedVert, errorCount: errors.length, errors: errors.slice(0, 6) }, null, 2));
await browser.close();
