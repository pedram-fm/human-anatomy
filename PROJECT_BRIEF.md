# Muscle Anatomy — Full Project Brief

> Written 2026-06-01. Single source of truth for "what we have" and "where we want to go".
> Goal of this doc: give an AI/agent (or a new dev) everything needed to take the app
> from a **22-muscle demo** to the **complete anatomy explorer** using the full Blender atlas.

---

## 1. One-line state

A Next.js + React Three Fiber web viewer that today shows **22 hand-picked surface muscles**
loaded from a tiny GLB. We also have the **entire Z-Anatomy atlas** as a heavy `.blend`
(7,184 objects, ~4.1M triangles, every body system). The app is **not yet wired to use the
full model** — that's the gap this brief exists to close.

---

## 2. Tech stack (actual, from package.json)

| Thing | Version | Notes |
|-------|---------|-------|
| Next.js | **16.2.6** | ⚠️ This repo's `AGENTS.md` warns it's a modified Next with breaking changes — **read `node_modules/next/dist/docs/` before writing Next code**, don't trust training data. |
| React / React DOM | 19.2.4 | |
| three | ^0.184.0 | |
| @react-three/fiber | ^9.6.1 | R3F |
| @react-three/drei | ^10.7.7 | `useGLTF`, `OrbitControls`, `ContactShadows`, `Center` |
| zustand | ^5.0.14 | viewer state |
| shadcn + @base-ui/react + tailwind v4 | | UI primitives in `src/components/ui/` |
| @gltf-transform/* + draco3dgltf | dev | GLB rebuild/compression pipeline |

Run: `npm run dev` (PROJECT_STATUS notes it has been run on port 3003: `npm run dev -- -p 3003`).
Rebuild model GLB: `npm run optimize:model`.

---

## 3. Current app architecture

| File | Role |
|------|------|
| `src/app/page.tsx` | Renders `<Viewer/>` full-screen. |
| `src/components/Viewer.tsx` | R3F `<Canvas>`: camera (pos `[0,0,3]`, fov 45), lights, `OrbitControls` (makeDefault, dist 1–8), `ContactShadows`, `<Center>`, Reset-view button, controls hint. |
| `src/components/MuscleModel.tsx` | Loads `/models/muscles.glb` via `useGLTF`, clones scene, tags each mesh with a `muscleId`, assigns per-mesh `MeshStandardMaterial`, recolors on hover/select, handles pointer down/over/out. Auto-fits model to `TARGET_HEIGHT = 2.0`. |
| `src/components/Sidebar.tsx` | Search box + muscle list; detail card (EN name, FA name, region badge, description) on selection. |
| `src/store/useViewerStore.ts` | Zustand: `selectedMuscleId`, `hoveredMuscleId`, `searchQuery`, `resetNonce` + setters. |
| `src/data/muscles.ts` | The 22 muscle records: `{ id, nameEn, nameFa, region, description }`. ⚠️ Its top comment is **stale** (says "procedural / no GLB") — the app actually loads a GLB. |

### The key contract (important)
**A GLB node's name, normalized, must equal a muscle `id` in `muscles.ts`.**
- `normalizeName()` = lowercase + strip trailing `.001` + trim.
- `validIds` = `Set` of the 22 ids. Any mesh whose normalized name isn't in the set gets
  `muscleId = null` → not clickable, not highlightable, just static geometry.
- There is **no separate `meshName` field**; `id` is the single link.

---

## 4. The current GLB + its pipeline

- `public/models/muscles.glb` — **1.35 MB**, Draco-compressed, the file the app loads.
- `public/models/muscles.backup.glb` — **8.0 MB**, the raw Blender export (pre-optimize).
- `scripts/optimize-glb.mjs` rebuilds the live GLB from the backup:
  - Keyword-matches every source part to one of **22 target ids** (`TARGETS` map) with an
    `EXCLUDE` list (minor/minimus/tendon/nerve/artery/bone/…).
  - Bakes world transforms, **merges all parts of a muscle (incl. L+R) into ONE mesh** named
    by id, welds, dedups, prunes, Draco-compresses.
  - This solved an earlier bug where muscles were fragmented across many nodes and L/R were
    GPU instances → broke click hit-testing and bloated the file.

So the pipeline today is deliberately **lossy and curated**: thousands of source parts →
22 clean clickable meshes.

---

## 5. The 22 muscles we currently expose

neck: `sternocleidomastoid` · back/shoulder: `trapezius`, `deltoid`, `latissimus_dorsi` ·
chest: `pectoralis_major`, `serratus_anterior` · core: `rectus_abdominis`, `external_oblique` ·
arm: `biceps_brachii`, `triceps_brachii` · forearm: `brachioradialis`, `extensor_digitorum` ·
hip: `gluteus_maximus` · thigh: `rectus_femoris`, `vastus_lateralis`, `vastus_medialis`,
`sartorius`, `adductor_longus`, `biceps_femoris` · calf: `gastrocnemius`, `soleus`,
`tibialis_anterior`.

Each has `nameEn`, `nameFa` (Persian), `region`, `description`.

---

## 6. THE ASSET: `/home/pedram/Desktop/untitled.blend` (the full model)

This is essentially the **complete Z-Anatomy atlas**. Measured headlessly with Blender:

| Metric | Value |
|--------|-------|
| File size | **276 MB** |
| Total objects | **7,184** |
| Mesh objects | **4,569** |
| Vertices | **2,094,701** |
| Triangles | **~4,099,477** |
| Materials | 188 |
| Images/textures | 3 |

### Top-level systems (9 collections)
1. Skeletal system (2,218) · 2. Muscular insertions (705) · 3. Joints (593) ·
**4. Muscular system (894)** · 5. Cardiovascular system (757) · 6. Lymphoid organs (276) ·
7. Nervous system & Sense organs (842) · 8. Visceral systems (479) · 9. Regions of human body (343).
Plus a "Bonus collection" (5,559) and "Main divisions" (4,252) that overlap the above (objects
belong to many nested collections).

### Muscle-relevant collection counts
`Muscular system` 806 · `Muscles` 509 · `Muscles of head` 102 · `Muscles of neck` 69 ·
`Muscles of upper limb` 131 · `Muscles of lower limb` 182 · `Muscles of abdomen` 16 ·
`Muscles of foot` 33 · `Muscles of hand` 25 · `Facial muscles` 36 · `Erector spinae` 22, etc.

### Object naming convention in the .blend (CRITICAL for any pipeline)
Names are **Latin anatomical names** with side/variant suffixes, and muscles are **split into
named parts**. Examples:
```
Deltoid muscle.l / .r / .el / .er / .j
Acromial part of deltoid muscle.l / .r / .ol / .or
Clavicular part of deltoid muscle.l / .r
Ascending part of trapezius muscle.l / .r / .el / .er / .ol / .or
Biceps brachii muscle.el / .er / .j
Clavicular head of pectoralis major muscle.l / .r
(Abdominal part of pectoralis major muscle).l    ← parenthesized = optional/deep variant
Deltoid fascia.l / .r                             ← NOT muscle (fascia)
Deltoid region.l / .r                             ← NOT muscle (body region)
```
Suffix legend (Z-Anatomy): `.l`/`.r` left/right, `.j` joined/midline, `.e*` and `.o*` are
display/variant copies. **A single muscle = many objects across heads/parts/sides/variants.**
Any "use the whole muscle" step must group all of these and exclude fascia/region/insertion/
nerve/artery/bone look-alikes.

### License (matters for shipping)
Z-Anatomy is **CC BY-SA 4.0**: commercial OK, **but** must credit Z-Anatomy + BodyParts3D
**and** release derived model assets under the same SA license. Attribution text is in
`MODEL_SETUP.md`/`PROJECT_STATUS.md`.

---

## 7. The gap — what "use the model completely" means

Right now: **22 muscles, surface only, one flat figure, no layers, no systems.** The full atlas
has everything (every muscle + head/part, skeleton, nerves, vessels, organs, joints, regions),
but none of it is reachable in the app. Closing the gap means deciding **how much** to expose
and solving the **weight problem** (4.1M tris / 276 MB can't ship to a browser whole).

### Hard constraints to design around
- **Performance:** the web target must be a few MB and a manageable triangle/draw-call count.
  4.1M tris and thousands of separate clickable meshes will not load/interact smoothly.
- **Click contract:** every interactive part needs a node name that maps to a data `id`
  (current code keys on exact normalized name; a richer scheme needs a name→id map).
- **Data:** `muscles.ts` has only 22 entries. Going full-atlas needs a generated catalog
  (id, EN/Latin name, FA name, system, region, parent group) — hand-writing hundreds is not viable.
- **Memory when processing the .blend:** the 276 MB file is heavy; Blender load uses lots of RAM
  (PROJECT_STATUS documents an OOM episode and raised oomd thresholds + 16 GB swap). Do heavy
  conversion headless, not in an editor.

### Realistic scope options (pick before prompting)
- **A. Full muscular system only** (collection 4, ~806 objects → grouped to ~100–150 named
  muscles). Most aligned with the app's purpose. Recommended first target.
- **B. Multi-system layers** (muscles + skeleton + nerves + vessels as toggleable layers, each
  its own GLB loaded on demand). Bigger build; needs layer UI + per-system data.
- **C. Everything, LOD-streamed** (region/system chunking, lazy loading, decimation tiers).
  Largest effort; only if the product really needs the whole atlas.

---

## 8. Suggested pipeline shape (for whichever scope)

1. **Headless Blender export per system/region** → one GLB per chunk (e.g. `muscular.glb`,
   `skeletal.glb`), not one giant file. Keep originals.
2. **Group source parts → one named object per logical muscle** (join heads/parts/sides),
   emit a **clean snake_case id** as the node name, and write a **catalog JSON** (id, names,
   system, region) in the same pass — this becomes `muscles.ts`/`catalog.json`.
3. **Decimate per object** to a triangle budget; **Draco** compress (the loader already
   supports Draco — see `optimize-glb.mjs`).
4. **App:** load chunk GLB(s) lazily; extend the store with `activeSystem`/`visibleLayers`;
   replace the hardcoded `validIds` with the generated catalog; add a name→id map so split
   parts still resolve to one muscle; add layer/region toggles to the sidebar.
5. **Verify:** click + hover + search across the new catalog; check perf (FPS, load time, MB).

Reuse what exists: `scripts/optimize-glb.mjs` (matching + weld + Draco pattern), the
`useGLTF`/material-tagging approach in `MuscleModel.tsx`, the Zustand store, the sidebar UI.

---

## 9. Helper files / environment notes (from prior work)

- `/tmp/blend_report.json` + `/tmp/blend_all_names.txt` — this session's full inventory of
  `untitled.blend` (all 4,568 mesh names, collection counts). Useful as pipeline input.
- `MODEL_SETUP.md` — manual Blender→GLB walkthrough (isolate, rename, decimate, export, Draco).
- `PROJECT_STATUS.md` (Persian) — history, the OOM fix, the duplicate-parts issue, attribution.
- `scripts/optimize-glb.mjs` — the existing automated GLB rebuild+compress.
- Blender CLI is installed at `/usr/bin/blender`; its Python needs `numpy` on PATH for the glTF
  exporter (`python3.13 -m pip install --user --break-system-packages numpy`).

---

## 10. ⭐ The "best prompt" (ready to paste / adapt)

> Pick your scope from §7 (default below = **A, full muscular system**), then hand an agent
> the prompt below together with this file.

```
CONTEXT
- Repo: /home/pedram/Desktop/projects/muscle-anatomy — Next.js 16.2.6 (MODIFIED: read
  node_modules/next/dist/docs/ before writing Next code) + React 19 + React Three Fiber +
  drei + zustand + tailwind/shadcn. Read PROJECT_BRIEF.md fully first.
- Today the app shows only 22 surface muscles from public/models/muscles.glb. I want to use
  the FULL model.
- Source asset: /home/pedram/Desktop/untitled.blend = complete Z-Anatomy atlas (7,184 objects,
  ~4.1M tris, 9 systems). Inventory: /tmp/blend_report.json and /tmp/blend_all_names.txt.
  Object names are Latin with .l/.r/.j/.e*/.o* suffixes and muscles are split into parts —
  see PROJECT_BRIEF §6.

GOAL
- Expose the entire MUSCULAR SYSTEM (collection "4: Muscular system"): every major muscle,
  grouped from its parts/heads/sides into ONE clickable, named object, with EN + Latin + FA
  names, system, and region. (Stretch: load skeleton/nerves/vessels as separate toggleable
  layers.)

REQUIREMENTS
1. Headless Blender pipeline (script in scripts/, runs via blender --background):
   - From untitled.blend, keep only muscular-system meshes; exclude fascia, regions, insertions,
     nerves, arteries, veins, bones, joints, lymph.
   - Group all parts/heads/L+R/variants of one muscle into a single joined object named with a
     clean snake_case id (e.g. deltoid, pectoralis_major). Define the grouping rules explicitly.
   - Decimate to a sane web triangle budget; export Draco-compressed GLB chunk(s) into
     public/models/. Do NOT ship one 276 MB file — keep each web GLB to a few MB.
   - In the SAME pass emit a catalog JSON: [{ id, nameEn, nameLatin, nameFa?, system, region }].
     Auto-derive names; leave nameFa blank where unknown (I'll fill Persian later).
2. App changes:
   - Replace the hardcoded 22-id set with the generated catalog; load it as data.
   - Add a node-name → muscle-id resolver so any leftover split part still maps correctly.
   - Lazy-load GLB chunk(s); extend the zustand store for visible layers/systems if you add them.
   - Update Sidebar to browse the full catalog (group by region/system, search EN+Latin+FA).
   - Keep hover/select/recolor and the auto-fit/centering behavior working.
3. Keep the CC BY-SA 4.0 attribution in the footer (Z-Anatomy + BodyParts3D).
4. Mind memory: the .blend is huge — process headless, document any swap/OOM workarounds.

DELIVERABLES
- The Blender export script + the npm script to run it.
- The new GLB chunk(s) in public/models/ and the generated catalog.
- Updated MuscleModel/Sidebar/store/data wiring.
- Run the app, verify click+hover+search on the new catalog, and report tri count, file sizes,
  and load time. Fix the stale comment at the top of src/data/muscles.ts.
```
