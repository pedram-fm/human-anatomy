import puppeteer from 'puppeteer-core';
const URL = process.env.URL || 'http://localhost:3005';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader'],
});
const errors = [];
const clickByText = (page, txt, cls) => page.evaluate((t, c) => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => new RegExp(t, 'i').test(x.textContent.trim()) && (!c || x.className.includes(c)));
  if (b) { b.click(); return b.textContent.trim(); } return null;
}, txt, cls);

// ---------- desktop ----------
const d = await browser.newPage();
await d.setViewport({ width: 1600, height: 900 });
d.on('console', (m) => { if (m.type() === 'error') errors.push('desktop: ' + m.text()); });
d.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message));
await d.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(4000);
await d.screenshot({ path: '/tmp/cam_d1_fitbody.png' });
await clickByText(d, '^left$');           // preset side view
await sleep(1800);
await d.screenshot({ path: '/tmp/cam_d2_left.png' });
await clickByText(d, '^Fit body$');
await sleep(1800);
await d.screenshot({ path: '/tmp/cam_d3_refit.png' });

// ---------- mobile (portrait phone) ----------
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
m.on('console', (x) => { if (x.type() === 'error') errors.push('mobile: ' + x.text()); });
m.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
await m.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(4000);
await m.screenshot({ path: '/tmp/cam_m1_phone_fit.png' });   // full body should fit tall screen
const openedDrawer = await clickByText(m, '^Structures$');
await sleep(900);
await m.screenshot({ path: '/tmp/cam_m2_phone_drawer.png' });

console.log(JSON.stringify({ openedDrawer, errorCount: errors.length, errors: errors.slice(0, 8) }, null, 2));
await browser.close();
