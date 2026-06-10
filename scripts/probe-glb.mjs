import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const FILE = process.argv[2] || 'public/models/skeletal.glb';
const io = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(FILE);
const nodes = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const min = pos.getMin([]); const max = pos.getMax([]);
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    nodes.push({ name: node.getName(), c, min, max });
  }
}
// overall box
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const n of nodes) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], n.min[i]); hi[i] = Math.max(hi[i], n.max[i]); }
const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const medc = [0, 1, 2].map((i) => med(nodes.map((n) => n.c[i])));
const dist = (n) => Math.hypot(n.c[0] - medc[0], n.c[1] - medc[1], n.c[2] - medc[2]);
nodes.sort((a, b) => dist(b) - dist(a));
console.log('FILE', FILE);
console.log('overall box  lo=', lo.map((v) => v.toFixed(2)), 'hi=', hi.map((v) => v.toFixed(2)));
console.log('size        =', hi.map((v, i) => (v - lo[i]).toFixed(2)));
console.log('median center=', medc.map((v) => v.toFixed(2)));
console.log('FARTHEST nodes from median center:');
for (const n of nodes.slice(0, 8)) {
  console.log(`  d=${dist(n).toFixed(2)}  c=[${n.c.map((v) => v.toFixed(2))}]  ${n.name}`);
}
