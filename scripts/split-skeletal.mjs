/**
 * Split the merged skeletal.glb into individually-selectable bones.
 *
 * The Blender export pipeline (export_systems.py) rolls every bone's left/right
 * leaves AND multi-bone groups (all ribs, all metacarpals, …) into ONE mesh per
 * bone id. That makes a left+right pair (or all 24 ribs) a single selectable unit,
 * so clicking one highlights its twin/group. This rebuilds the GLB by separating
 * each merged mesh into its connected components and regrouping them into anatomical
 * bones, then regenerates skeletal.catalog.json with one entry per bone.
 *
 *   node scripts/split-skeletal.mjs            # writes *.split.glb + *.catalog.new.json
 *   node scripts/split-skeletal.mjs --apply    # also overwrites the real files (backup kept)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import fs from 'node:fs';

const SRC = 'public/models/skeletal.glb';
const OUT_GLB = 'public/models/skeletal.split.glb';
const SRC_CAT = 'src/data/skeletal.catalog.json';
const OUT_CAT = 'src/data/skeletal.catalog.new.json';
const APPLY = process.argv.includes('--apply');

// Model faces -Y in Blender; after yup export, anatomical right is at x<0, left at x>=0.
// Flip this single line if a render shows the sides swapped.
const sideOf = (x) => (x < 0 ? 'right' : 'left');
const MIN_COMP_VERTS = 20; // components smaller than this are mesh noise -> folded into a group

// --- split policy -----------------------------------------------------------
// Anything NOT listed here is kept as a single bone (skull plates, vertebrae, sacrum…),
// even if its mesh has internal disconnected pieces (teeth, sutures, foramina rims).
const LR = new Set([
  'clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'femur', 'tibia', 'fibula',
  'patella', 'scaphoid', 'lunate', 'triquetrum', 'pisiform', 'trapezium', 'trapezoid',
  'capitate', 'hamate', 'talus', 'calcaneus', 'navicular', 'cuboid',
  'parietal_bone', 'temporal_bone', 'zygomatic', 'maxilla', 'palatine_bone',
  'lacrimal_bone', 'nasal_bone', 'inferior_nasal_concha', 'malleus', 'incus', 'stapes',
]);
// group node -> { perSide, label } ; numbered within each side along the named axis
const GROUPS = {
  ribs:              { perSide: 12, axis: 'y', desc: true,  stem: 'rib' },
  metacarpal:        { perSide: 5,  axis: 'x', desc: false, stem: 'metacarpal' },
  metatarsal:        { perSide: 5,  axis: 'x', desc: false, stem: 'metatarsal' },
  phalanges_of_hand: { perSide: 14, axis: 'y', desc: true,  stem: 'phalanx_hand' },
  phalanges_of_foot: { perSide: 14, axis: 'z', desc: false, stem: 'phalanx_foot' },
  cuneiform:         { perSide: 3,  axis: 'x', desc: false, stem: 'cuneiform' },
};

// --- Persian / display names ------------------------------------------------
const FA = {
  clavicle: 'ترقوه', scapula: 'کتف', humerus: 'بازو', radius: 'زند زبرین',
  ulna: 'زند زیرین', femur: 'ران', tibia: 'درشت‌نی', fibula: 'نازک‌نی',
  patella: 'کشکک', scaphoid: 'قایقی', lunate: 'هلالی', triquetrum: 'هرمی',
  pisiform: 'نخودی', trapezium: 'ذوزنقه بزرگ', trapezoid: 'ذوزنقه کوچک',
  capitate: 'بزرگ مچ', hamate: 'قلابی', talus: 'قاپ', calcaneus: 'پاشنه',
  navicular: 'ناوی', cuboid: 'مکعبی', cuneiform: 'میخی',
  parietal_bone: 'آهیانه', temporal_bone: 'گیجگاهی', zygomatic: 'گونه',
  maxilla: 'فک بالا', palatine_bone: 'کامی', lacrimal_bone: 'اشکی',
  nasal_bone: 'بینی', inferior_nasal_concha: 'شاخک بینی تحتانی',
  malleus: 'چکشی', incus: 'سندانی', stapes: 'رکابی',
  rib: 'دنده', metacarpal: 'کف‌دستی', metatarsal: 'کف‌پایی',
  phalanx_hand: 'بندانگشت دست', phalanx_foot: 'بندانگشت پا',
};
const FA_SIDE = { left: 'چپ', right: 'راست' };
const EN_SIDE = { left: 'left', right: 'right' };
const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// --- connected components ---------------------------------------------------
function components(indices, vertCount) {
  const parent = new Int32Array(vertCount);
  for (let i = 0; i < vertCount; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (let i = 0; i < indices.length; i += 3) { union(indices[i], indices[i + 1]); union(indices[i + 1], indices[i + 2]); }
  return find;
}

function buildPrim(doc, buffer, pos, nrm, tris) {
  const map = new Map(); const np = []; const nn = []; const ni = [];
  const remap = (oi) => {
    let v = map.get(oi);
    if (v === undefined) {
      v = np.length / 3; map.set(oi, v);
      np.push(pos[oi * 3], pos[oi * 3 + 1], pos[oi * 3 + 2]);
      if (nrm) nn.push(nrm[oi * 3], nrm[oi * 3 + 1], nrm[oi * 3 + 2]);
    }
    return v;
  };
  for (const [a, b, c] of tris) ni.push(remap(a), remap(b), remap(c));
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(np)).setBuffer(buffer));
  if (nrm) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nn)).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ni)).setBuffer(buffer));
  return prim;
}

// --- main -------------------------------------------------------------------
const io = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const buffer = root.listBuffers()[0];
const srcCat = JSON.parse(fs.readFileSync(SRC_CAT, 'utf8'));
const catById = new Map(srcCat.map((s) => [s.id, s]));

const newCat = [];
const summary = [];
const usedIds = new Set();

function emit(id, nameEn, nameFa, parentEntry) {
  if (usedIds.has(id)) throw new Error('duplicate id ' + id);
  usedIds.add(id);
  newCat.push({
    id,
    nameEn,
    nameLatin: parentEntry?.nameLatin ?? nameEn,
    nameFa: nameFa ?? '',
    descriptionEn: parentEntry?.descriptionEn ?? '',
    descriptionFa: parentEntry?.descriptionFa ?? '',
    system: 'skeletal',
    region: parentEntry?.region ?? 'skeleton',
    depth: parentEntry?.depth ?? 'unknown',
    depthOrder: parentEntry?.depthOrder ?? 1,
    depthSource: parentEntry?.depthSource ?? null,
    aliases: parentEntry?.aliases ?? [],
  });
}

for (const node of [...scene.listChildren()]) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const name = node.getName();
  const prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION').getArray();
  const nrm = prim.getAttribute('NORMAL')?.getArray() ?? null;
  const vertCount = prim.getAttribute('POSITION').getCount();
  const idxAcc = prim.getIndices();
  const indices = idxAcc ? idxAcc.getArray() : Uint32Array.from({ length: vertCount }, (_, i) => i);
  const parentEntry = catById.get(name);

  const isLR = LR.has(name);
  const grp = GROUPS[name];

  if (!isLR && !grp) {
    // keep as a single bone (untouched geometry/node), just ensure a catalog entry
    const fa = parentEntry?.nameFa || faForKeep(name);
    emit(name, parentEntry?.nameEn || cap(name.replace(/_/g, ' ')), fa, parentEntry);
    summary.push(`${name.padEnd(22)} keep -> 1`);
    continue;
  }

  // gather components + their triangles + centroids
  const find = components(indices, vertCount);
  const tris = new Map();   // root -> [[a,b,c],...]
  const cAcc = new Map();   // root -> {x,y,z,n}
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    const r = find(a);
    if (!tris.has(r)) { tris.set(r, []); cAcc.set(r, { x: 0, y: 0, z: 0, n: 0 }); }
    tris.get(r).push([a, b, c]);
    const ca = cAcc.get(r);
    for (const v of [a, b, c]) { ca.x += pos[v * 3]; ca.y += pos[v * 3 + 1]; ca.z += pos[v * 3 + 2]; ca.n++; }
  }
  const comps = [...tris.keys()].map((r) => {
    const ca = cAcc.get(r);
    const verts = new Set();
    for (const t of tris.get(r)) for (const v of t) verts.add(v);
    return { r, tris: tris.get(r), cx: ca.x / ca.n, cy: ca.y / ca.n, cz: ca.z / ca.n, verts: verts.size };
  });

  // fold noise (tiny components) into the nearest large component
  const big = comps.filter((c) => c.verts >= MIN_COMP_VERTS);
  const small = comps.filter((c) => c.verts < MIN_COMP_VERTS);
  for (const s of small) {
    let best = big[0], bd = Infinity;
    for (const b of big) {
      const d = (b.cx - s.cx) ** 2 + (b.cy - s.cy) ** 2 + (b.cz - s.cz) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    best.tris.push(...s.tris);
  }

  // group the big components into output bones
  const out = []; // { id, nameEn, nameFa, tris:[...] }
  if (isLR) {
    const bySide = { left: [], right: [] };
    for (const c of big) bySide[sideOf(c.cx)].push(c);
    for (const side of ['left', 'right']) {
      if (!bySide[side].length) continue;
      const tt = bySide[side].flatMap((c) => c.tris);
      const fa = FA[name];
      out.push({
        id: `${name}_${side}`,
        nameEn: `${parentEntry?.nameEn || cap(name.replace(/_/g, ' '))} (${EN_SIDE[side]})`,
        nameFa: fa ? `${fa} ${FA_SIDE[side]}` : '',
        tris: tt,
      });
    }
  } else {
    const { perSide, axis, desc, stem } = grp;
    const bySide = { left: [], right: [] };
    for (const c of big) bySide[sideOf(c.cx)].push(c);
    for (const side of ['left', 'right']) {
      const list = bySide[side];
      if (!list.length) continue;
      list.sort((a, b) => (desc ? b[`c${axis}`] - a[`c${axis}`] : a[`c${axis}`] - b[`c${axis}`]));
      list.forEach((c, i) => {
        const n = i + 1;
        const fa = FA[stem];
        out.push({
          id: `${stem}_${side}_${n}`,
          nameEn: `${cap(stem.replace(/_/g, ' '))} ${n} (${EN_SIDE[side]})`,
          nameFa: fa ? `${fa} ${faNum(n)} ${FA_SIDE[side]}` : '',
          tris: c.tris,
        });
      });
    }
  }

  // create new nodes; dispose the original
  for (const o of out) {
    const m = doc.createMesh(o.id).addPrimitive(buildPrim(doc, buffer, pos, nrm, o.tris));
    const nn = doc.createNode(o.id).setMesh(m);
    scene.addChild(nn);
    emit(o.id, o.nameEn, o.nameFa, parentEntry);
  }
  node.dispose();
  mesh.dispose();
  summary.push(`${name.padEnd(22)} ${isLR ? 'L/R' : 'group'} -> ${out.length}`);
}

function faForKeep(name) {
  const map = {
    frontal_bone: 'پیشانی', occipital_bone: 'پس‌سری', sphenoid: 'شب‌پره‌ای',
    ethmoid: 'پرویزنی', vomer: 'تیغه‌ای', mandible: 'فک پایین', hyoid: 'لامی',
    sternum: 'جناغ سینه', manubrium: 'دسته جناغ', sacrum: 'خاجی', coccyx: 'دنبالچه',
    atlas_c1: 'اطلس (مهره گردنی اول)', axis_c2: 'آسه (مهره گردنی دوم)', hip_bone: 'نیم‌لگن',
  };
  if (map[name]) return map[name];
  const m = name.match(/^vertebra_([ctl])(\d+)$/);
  if (m) {
    const kind = { c: 'گردنی', t: 'سینه‌ای', l: 'کمری' }[m[1]];
    return `مهره ${kind} ${faNum(+m[2])}`;
  }
  return '';
}

// keep the orphan hip_bone catalog entry (no geometry in GLB) so it isn't silently lost
if (!usedIds.has('hip_bone') && catById.has('hip_bone')) {
  const e = catById.get('hip_bone');
  emit('hip_bone', e.nameEn, faForKeep('hip_bone'), e);
}

await doc.transform(prune());
await doc.transform(draco());
await io.write(OUT_GLB, doc);

newCat.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(OUT_CAT, JSON.stringify(newCat, null, 2) + '\n');

console.log(summary.join('\n'));
console.log('--------------------------------------');
console.log('total bones (catalog entries):', newCat.length);
console.log('GLB nodes written:', doc.getRoot().listScenes()[0].listChildren().length);
console.log('wrote', OUT_GLB, '(', (fs.statSync(OUT_GLB).size / 1024).toFixed(0), 'KB )');
console.log('wrote', OUT_CAT);
if (APPLY) {
  fs.copyFileSync(SRC, 'public/models/skeletal.merged.backup.glb');
  fs.renameSync(OUT_GLB, SRC);
  fs.copyFileSync(SRC_CAT, 'src/data/skeletal.catalog.merged.backup.json');
  fs.renameSync(OUT_CAT, SRC_CAT);
  console.log('APPLIED: skeletal.glb + skeletal.catalog.json replaced (backups kept).');
}
