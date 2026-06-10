import puppeteer from 'puppeteer-core';
const URL = process.env.URL || 'http://localhost:3003';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const clickByText = (txt, cls) => page.evaluate((t, c) => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => new RegExp(t, 'i').test(x.textContent) && (!c || x.className.includes(c)));
  if (b) { b.click(); return b.textContent.trim(); } return null;
}, txt, cls);
const setSearch = (v) => page.evaluate((val) => {
  const i = document.querySelector('input[type="text"]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, val); i.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
const headerCount = () => page.evaluate(() => {
  const h = [...document.querySelectorAll('h3')].find((x) => /structures/.test(x.textContent));
  return h ? h.textContent.trim() : null;
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(3500);
const totalStructures = await headerCount();
await page.screenshot({ path: '/tmp/full_1_skeleton.png' });

// turn on several layers -> full body
for (const label of ['Organs', 'Vessels', 'Nerves', 'Muscles']) {
  await clickByText('^' + label);
  await sleep(2500);
}
await page.screenshot({ path: '/tmp/full_2_layers.png' });

// hide muscles again so the spine is visible, then select ONE vertebra
await clickByText('^Muscles');
await clickByText('^Organs');
await clickByText('^Vessels');
await clickByText('^Nerves');
await sleep(800);
await setSearch('vertebra t5');
await sleep(500);
const picked = await clickByText('Vertebra t5', 'text-left');
await sleep(2000);
await page.screenshot({ path: '/tmp/full_3_vertebra.png' });

const iso = await clickByText('Isolate selected');
await sleep(1500);
await page.screenshot({ path: '/tmp/full_4_vertebra_isolated.png' });

console.log(JSON.stringify({
  totalStructures, layersToggled: true, pickedVertebra: picked, isolate: iso,
  errorCount: errors.length, errors: errors.slice(0, 6),
}, null, 2));
await browser.close();
