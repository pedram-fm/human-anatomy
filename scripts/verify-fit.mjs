import puppeteer from 'puppeteer-core';
const URL = process.env.URL || 'http://localhost:3005';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable', headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

async function measure(label, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(4500);
  const r = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const st = canvas.__r3f.root.getState();
    const { scene, camera, size } = st;
    camera.updateMatrixWorld();
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, n = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.userData.structureId) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const v = o.position.clone(); v.set(x, y, z); v.applyMatrix4(o.matrixWorld); v.project(camera);
        const sx = (v.x * 0.5 + 0.5) * size.width, sy = (1 - (v.y * 0.5 + 0.5)) * size.height;
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy); n++;
      }
    });
    return { n, minX, minY, maxX, maxY, w: size.width, h: size.height };
  });
  const fullyVisible = r.minY >= -2 && r.maxY <= r.h + 2 && r.minX >= -2 && r.maxX <= r.w + 2;
  const vFill = ((r.maxY - r.minY) / r.h);
  console.log(`${label}: vis=${fullyVisible} vFill=${(vFill * 100).toFixed(0)}%`,
    `screenY=[${r.minY.toFixed(0)},${r.maxY.toFixed(0)}]/${r.h} screenX=[${r.minX.toFixed(0)},${r.maxX.toFixed(0)}]/${r.w}`);
  await page.close();
}

await measure('desktop', { width: 1600, height: 900 });
await measure('phone  ', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await browser.close();
