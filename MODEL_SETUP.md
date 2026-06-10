# Getting a real muscle model into the app (Z-Anatomy → GLB)

This guide takes you from downloading the free, real human-anatomy model
(**Z-Anatomy**) to a web-ready `muscles.glb` with separate, named, clickable
surface muscles.

> **License note:** Z-Anatomy is **CC BY-SA 4.0**. You may use it commercially,
> but you must (1) credit Z-Anatomy + BodyParts3D, and (2) release derivative
> model assets under the same SA license. Fine for the MVP. Keep the attribution
> in the app footer and in this repo's README.

---

## Step 1 — Install Blender (you already have it ✅)

Any Blender 3.x or 4.x works.

## Step 2 — Download the Z-Anatomy model

Pick **ONE** of these sources (the GitHub one is the most direct):

- **Official site:** https://www.z-anatomy.com/  → "Download" → Blender file
- **itch.io (easy, free):** https://lluisv.itch.io/z-anatomy  → "Download Now" (name your price → 0 is allowed)
- **GitHub:** https://github.com/Z-Anatomy  → repo **`The-blend`** (the Blender
  template) and/or **`Models-of-human-anatomy`** (raw FBX models in
  `Resources/Models`).

What you want is the **Blender file (`.blend`)** that contains the muscle layer,
OR the **FBX** of the muscular system. Either imports into Blender.

> If you grab the "Application Template" `.zip`: open Blender → top-left Blender
> icon → **Install Application Template** → pick `Z-Anatomy.zip` → then
> **File ▸ New ▸ Z-Anatomy**. The full atlas opens.

## Step 3 — Isolate the SURFACE muscles only

The full model has thousands of structures (bones, nerves, vessels, deep
muscles). For the MVP we only want ~20–25 major **surface** muscles.

In Blender:

1. In the **Outliner** (top-right list), find the **muscle** collection/layer.
2. Hide everything else (skeleton, nerves, vessels, organs). In Z-Anatomy you can
   toggle whole layers.
3. Select and **keep** these surface muscles (delete or hide the rest):
   - sternocleidomastoid, trapezius, deltoid, pectoralis major, serratus anterior,
     rectus abdominis, external oblique, latissimus dorsi,
     biceps brachii, triceps brachii, brachioradialis, extensor digitorum,
     gluteus maximus, rectus femoris, vastus lateralis, vastus medialis,
     sartorius, adductor longus, biceps femoris, gastrocnemius, soleus,
     tibialis anterior
   - (left + right counts as the same muscle — keep both sides)

> Tip: select a muscle, press **`/`** (numpad slash) to isolate-view it and check
> it's the right one. Press `/` again to come back.

## Step 4 — Make object names clean (this is what the code keys on)

Each kept muscle must be **one named object** whose name the app can match.

- Rename each object in the Outliner to a simple `snake_case` id, e.g.
  `pectoralis_major`, `biceps_brachii`, `gastrocnemius`, …
- If a muscle is split into many small pieces, select them all and **Ctrl+J**
  (Join) into one object, then rename.
- Left/right: either join L+R into one object named `deltoid`, OR name them
  `deltoid_l` / `deltoid_r`. **Tell me which convention you used** — I'll match it
  in the data file. (Joining into one is simplest for clicking.)

The exact names you use here become the `meshName` values in
`src/data/muscles.ts`. They must match **exactly**.

## Step 5 — Reduce polygons (keep the web app fast)

The raw model can be heavy. For each muscle (or all at once):

1. Select the object(s).
2. Add a **Decimate** modifier (Properties ▸ wrench ▸ Add Modifier ▸ Decimate).
3. Set **Ratio ≈ 0.3–0.5** (start at 0.4). Check it still looks smooth.
4. **Apply** the modifier.

Goal: whole model well under **~10–15 MB** as GLB.

## Step 6 — Orient and scale

- Make sure the figure faces **+Z** (toward viewer) and **+Y is up**.
  In Blender, +Z is up by default but the **glTF exporter converts Y-up**, so
  just make sure the body stands upright facing the front view (Numpad 1).
- Select all → **Object ▸ Apply ▸ All Transforms** so positions/rotations bake in.

## Step 7 — Export to GLB

`File ▸ Export ▸ glTF 2.0 (.glb/.gltf)` with:

- **Format:** `glTF Binary (.glb)`
- **Include:** ✅ *Selected Objects* (if you only want the kept muscles) and
  ✅ *Custom Properties*
- **Transform:** ✅ *+Y Up*
- **Geometry:** ✅ *Apply Modifiers*, ✅ *Normals*. UVs/textures optional (we color
  muscles in-app, so textures aren't required).
- **Compression:** enable **Draco** if available (smaller file). If you enable
  Draco, tell me — the loader needs a tiny tweak.

Save it as:

```
public/models/muscles.glb
```

(Replace the file the app expects — that exact path.)

## Step 8 — Hand it back to me

Once `public/models/muscles.glb` exists, tell me and I will:

1. Restore the GLB-loading viewer code (revert my procedural placeholder).
2. Read the real mesh names out of your GLB.
3. Wire `src/data/muscles.ts` `meshName`s to match exactly.
4. Re-run the app and screenshot it so we confirm clicking/highlighting works.

---

### Attribution to keep (CC BY-SA 4.0)

> Anatomy model: **Z-Anatomy** (https://www.z-anatomy.com/), based on
> **BodyParts3D** © The Database Center for Life Science, licensed under
> **CC BY-SA 4.0**. Derived assets in this project are shared under the same license.
