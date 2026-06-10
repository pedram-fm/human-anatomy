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

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(3500);

// enable muscles, then select biceps via search → camera should fit to it
await clickByText('^Muscles');
await sleep(3500);
await page.evaluate(() => {
  const i = document.querySelector('input[type="text"]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, 'biceps brachii'); i.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(500);
const picked = await clickByText('biceps brachii', 'text-left');
await sleep(2200); // camera fitToBox transition
await page.screenshot({ path: '/tmp/p3_1_focus.png' });

const xray = await clickByText('X-ray');
await sleep(1200);
await page.screenshot({ path: '/tmp/p3_2_xray.png' });

await clickByText('X-ray'); // xray off
const iso = await clickByText('Isolate selected');
await sleep(1200);
await page.screenshot({ path: '/tmp/p3_3_isolate.png' });

const reset = await clickByText('Reset View');
await sleep(2000);
await page.screenshot({ path: '/tmp/p3_4_reset.png' });

console.log(JSON.stringify({ picked, xray, iso, reset, errorCount: errors.length, errors: errors.slice(0, 6) }, null, 2));
await browser.close();
