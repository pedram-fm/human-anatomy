/**
 * Rebuild + compress public/models/muscles.glb.
 *
 * The Blender export left each muscle fragmented across many nodes (and L/R as
 * GPU instances), which (a) broke click hit-testing — most parts had no valid
 * muscle id — and (b) bloated the file. This script reconstructs each of the 22
 * surface muscles as ONE merged, correctly-named mesh by keyword-matching every
 * source part (same matching the Blender script used), baking world transforms,
 * then welds + Draco-compresses the result.
 *
 *   node scripts/optimize-glb.mjs [in.glb] [out.glb]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, prune, dedup, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const IN = process.argv[2] || 'public/models/muscles.glb';
const OUT = process.argv[3] || 'public/models/muscles.glb';

const TARGETS = {
  sternocleidomastoid: ['sternocleidomastoid'],
  trapezius: ['trapezius'],
  deltoid: ['deltoid'],
  pectoralis_major: ['pectoralis major'],
  serratus_anterior: ['serratus anterior'],
  rectus_abdominis: ['rectus abdominis'],
  external_oblique: ['external abdominal oblique'],
  latissimus_dorsi: ['latissimus dorsi'],
  biceps_brachii: ['biceps brachii'],
  triceps_brachii: ['triceps brachii'],
  brachioradialis: ['brachioradialis'],
  extensor_digitorum: ['extensor digitorum'],
  gluteus_maximus: ['gluteus maximus', 'glutaeus maximus'],
  rectus_femoris: ['rectus femoris'],
  vastus_lateralis: ['vastus lateralis'],
  vastus_medialis: ['vastus medialis'],
  sartorius: ['sartorius'],
  adductor_longus: ['adductor longus'],
  biceps_femoris: ['biceps femoris'],
  gastrocnemius: ['gastrocnemius'],
  soleus: ['soleus'],
  tibialis_anterior: ['tibialis anterior'],
};
const EXCLUDE = ['minor', 'minimus', 'medius', 'internus', 'intermedius',
  'profundus', 'tendon', 'tendo', 'aponeuros', 'bursa', 'nerve', 'nervus',
  'artery', 'arteria', 'vein', 'vena', 'bone', 'vertebra'];
const IDS = Object.keys(TARGETS);

function matchId(rawName) {
  const nl = rawName.toLowerCase();
  const norm = nl.replace(/\.\d+$/, '').trim();
  if (IDS.includes(norm)) return norm;            // already-named (partial) node
  if (EXCLUDE.some((x) => nl.includes(x))) return null;
  for (const [id, kws] of Object.entries(TARGETS)) {
    if (kws.some((k) => nl.includes(k))) return id;
  }
  return null;
}

// --- minimal column-major mat4 helpers (gltf-transform uses gl-matrix order) ---
function mulVec3(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}
// normal transform: inverse-transpose of upper-left 3x3 (approx via cofactors)
function normalMat3(m) {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  return [A, D, G, B, E, H, C, F, I]; // = transpose(inverse) up to det scalar (fine after renormalize)
}
function applyN(nm, x, y, z) {
  let nx = nm[0] * x + nm[3] * y + nm[6] * z;
  let ny = nm[1] * x + nm[4] * y + nm[7] * z;
  let nz = nm[2] * x + nm[5] * y + nm[8] * z;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

const io = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const doc = await io.read(IN);
const root = doc.getRoot();
const scene = root.getDefaultScene() || root.listScenes()[0];

// Collect flat (de-indexed, world-baked) POSITION+NORMAL per muscle id.
const buckets = new Map(IDS.map((id) => [id, { pos: [], nrm: [] }]));
let dropped = 0;

scene.traverse((node) => {
  const mesh = node.getMesh();
  if (!mesh) return;
  const id = matchId(node.getName() || mesh.getName() || '');
  if (!id) { dropped++; return; }
  const world = node.getWorldMatrix();
  const nm = normalMat3(world);
  const bucket = buckets.get(id);

  for (const prim of mesh.listPrimitives()) {
    const posA = prim.getAttribute('POSITION');
    const nrmA = prim.getAttribute('NORMAL');
    if (!posA) continue;
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : posA.getCount();
    const p = [0, 0, 0], n = [0, 0, 0];
    for (let k = 0; k < count; k++) {
      const vi = idx ? idx.getScalar(k) : k;
      posA.getElement(vi, p);
      const wp = mulVec3(world, p[0], p[1], p[2]);
      bucket.pos.push(wp[0], wp[1], wp[2]);
      if (nrmA) {
        nrmA.getElement(vi, n);
        const wn = applyN(nm, n[0], n[1], n[2]);
        bucket.nrm.push(wn[0], wn[1], wn[2]);
      } else {
        bucket.nrm.push(0, 0, 0);
      }
    }
  }
});

// Build a clean scene: one node + one single-primitive mesh per muscle.
const buffer = root.listBuffers()[0] || doc.createBuffer();
const material = doc.createMaterial('muscle'); // app overrides color at runtime
const newScene = doc.createScene('Scene');
let kept = 0, totalTris = 0;

for (const id of IDS) {
  const b = buckets.get(id);
  if (!b.pos.length) { console.warn('  !! empty muscle:', id); continue; }
  const pos = doc.createAccessor(id + '_pos').setType('VEC3')
    .setArray(new Float32Array(b.pos)).setBuffer(buffer);
  const nrm = doc.createAccessor(id + '_nrm').setType('VEC3')
    .setArray(new Float32Array(b.nrm)).setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', pos).setAttribute('NORMAL', nrm)
    .setMaterial(material);
  const mesh = doc.createMesh(id).addPrimitive(prim);
  const node = doc.createNode(id).setMesh(mesh);
  newScene.addChild(node);
  kept++;
  totalTris += b.pos.length / 9;
}

// Drop the old scene(s) and orphans, set ours as default.
for (const s of root.listScenes()) if (s !== newScene) s.dispose();
root.setDefaultScene(newScene);

console.log(`Reassembled ${kept}/22 muscles, ${Math.round(totalTris)} tris, dropped ${dropped} unmatched source nodes.`);

await doc.transform(
  weld(),                       // merge coincident verts -> indexed, smaller
  dedup(),
  prune(),
  draco(),                      // Draco mesh compression
);

await io.write(OUT, doc);
console.log('Wrote', OUT);
