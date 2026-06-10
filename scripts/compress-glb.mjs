/**
 * Weld + dedup + prune + Draco-compress a GLB in place (or to OUT).
 * Blender's own Draco exporter is a silent no-op in this build, so we compress
 * here with gltf-transform (same stack as optimize-glb.mjs), which is reliable.
 *
 *   node scripts/compress-glb.mjs <in.glb> [out.glb]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const IN = process.argv[2];
const OUT = process.argv[3] || IN;
if (!IN) { console.error('usage: compress-glb.mjs <in.glb> [out.glb]'); process.exit(1); }

const io = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const doc = await io.read(IN);
await doc.transform(weld(), dedup(), prune(), draco());
await io.write(OUT, doc);

import { statSync } from 'fs';
console.log(`compressed ${IN} -> ${OUT} : ${(statSync(OUT).size / 1e6).toFixed(2)} MB`);
