"""
Headless Blender pipeline: full Z-Anatomy atlas -> per-system web GLB + catalog JSON.

Run ONE system per invocation (bounded memory). Env vars:
  SYSTEM   = skeletal | muscular   (which top-level collection)
  OUT_GLB  = absolute path for the .glb
  OUT_CAT  = absolute path for the catalog .json
  OUT_REP  = absolute path for the grouping-report .json
  DECIMATE = collapse ratio (default per system)

  blender --background /home/pedram/Desktop/untitled.blend --python scripts/export_systems.py

Design (validated in Phase 0/1 probes):
  * Structures exist as sided (.l/.r) leaves OR a joined (.j) mesh, ~never both with real geo.
  * Muscles are split into named heads/parts -> roll up to ONE parent muscle.
  * Group/aggregate joins (Erector spinae, Muscles of X, Axial skeleton...) are detected
    data-drivenly (a collection whose name == a structure AND that holds >=2 distinct
    structures) and dropped, so geometry is never double-counted.
  * Per structure: prefer sided leaves; if any .l/.r present, drop the .j/.g joins.
  * Depth: Z-Anatomy "Superficial*"/"Deep gluteal" collections seed superficial/deep;
    scripts/depth_overrides.json is merged on top; everything else = "unknown".
"""
import bpy, bmesh, os, re, json, sys, math

# numpy lives in the user site (Blender's bundled py lacks it) -> needed by glTF exporter
sys.path.insert(0, "/home/pedram/.local/lib/python3.13/site-packages")

SYSTEM   = os.environ["SYSTEM"]
OUT_GLB  = os.environ["OUT_GLB"]
OUT_CAT  = os.environ["OUT_CAT"]
OUT_REP  = os.environ["OUT_REP"]

# Per-system config:
#   exclude    = keywords for OTHER-system look-alikes -> dropped entirely
#   connective = supporting tissue kept but ABSORBED into the nearest real structure
#                (visible, not separately clickable) — fixes the "cut-off" look
CONF = {
    "skeletal": {"coll": "1: Skeletal system", "decimate": 0.40, "rollup": False,
                 "exclude": ["intervertebral disc", " disc", "suture", "fontanelle",
                             "synchondros", "syndesmos", "symphysis", "joint",
                             "ligament", "membrane", "labrum", "meniscus", "bursa",
                             "capsule"],
                 "connective": ["cartilage", "fibrocartilage"]},
    "muscular": {"coll": "4: Muscular system", "decimate": 0.55, "rollup": True,
                 "exclude": ["region", "compartment", "bursa", "ligament", "trochlea",
                             "nerve", "nervus", "artery", "arteria", "vein", "vena",
                             " node", "lymph", "bone", "tract", " ring", " space",
                             "fossa", "groove", " line", "tubercle", " arch", "tarsus",
                             "insertion"],
                 "connective": ["fascia", "aponeuros", "tendon", "tendin", "sheath",
                                "retinaculum", "raphe", "septum"]},
    "insertions": {"coll": "2: Muscular insertions", "decimate": 0.6, "rollup": False,
                   "exclude": [], "connective": []},
    "joints": {"coll": "3: Joints", "decimate": 0.5, "rollup": False,
               "exclude": ["nerve", "artery", "vein", " node", "muscle"], "connective": []},
    "cardiovascular": {"coll": "5: Cardiovascular system", "decimate": 0.6, "rollup": False,
                       "exclude": ["nerve", " node", "lymph", "bone"], "connective": []},
    "lymphoid": {"coll": "6: Lymphoid organs", "decimate": 0.5, "rollup": False,
                 "exclude": ["artery", "vein", "nerve"], "connective": []},
    "nervous": {"coll": "7: Nervous system & Sense organs", "decimate": 0.45, "rollup": False,
                "exclude": ["artery", "vein", "bone"], "connective": []},
    "visceral": {"coll": "8: Visceral systems", "decimate": 0.6, "rollup": False,
                 "exclude": ["nerve", "artery", "vein", " node", "lymph"], "connective": []},
    "regions": {"coll": "9: Regions of human body", "decimate": 0.6, "rollup": False,
                "exclude": [], "connective": []},
}[SYSTEM]
DECIMATE = float(os.environ.get("DECIMATE", CONF["decimate"]))

# ---------------------------------------------------------------- name utils
SIDE_RE = re.compile(r"\.(j|l|r|i|g|el|er|ol|or)$", re.I)
NUM_RE  = re.compile(r"\.\d+$")
PART_RE = re.compile(r"^.*?\b(?:head|part|belly|portion|fibres|fibers|layer|bundle)\s+of\s+", re.I)

def split_side(name):
    n = NUM_RE.sub("", name)
    m = SIDE_RE.search(n)
    suf = m.group(1).lower() if m else ""
    if m:
        n = n[:m.start()]
    return n.strip(), suf

def parent_of(base):
    b = base.strip().strip("()").strip()
    return PART_RE.sub("", b).strip()

def norm(s):
    s = s.lower().strip().strip("()").strip()
    s = re.sub(r"\s+(muscle|mucle)$", "", s)
    return s.strip()

def to_id(parent):
    s = parent.lower().strip().strip("()").strip()
    s = re.sub(r"\s+(muscle|mucle)$", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s

# --- skeletal: map any bone landmark/feature -> its parent whole bone ----------
# checked longest-first so "frontal bone" wins over a bare token; returns a label.
BONE_KEYWORDS = [
    "frontal bone", "parietal bone", "occipital bone", "temporal bone",
    "sphenoid", "ethmoid", "nasal bone", "lacrimal bone", "vomer",
    "palatine bone", "zygomatic", "inferior nasal concha", "maxilla", "mandible",
    "hyoid", "malleus", "incus", "stapes",
    "clavicle", "scapula", "humerus", "radius", "ulna",
    "scaphoid", "lunate", "triquetrum", "pisiform", "trapezium", "trapezoid",
    "capitate", "hamate", "metacarpal",
    "femur", "patella", "tibia", "fibula",
    "talus", "calcaneus", "navicular", "cuboid", "cuneiform", "metatarsal",
    "sternum", "manubrium",
]
LANDMARK_TO_BONE = {
    "acromion": "scapula", "glenoid": "scapula", "coracoid": "scapula",
    "supraglenoid": "scapula", "infraglenoid": "scapula", "subscapular": "scapula",
    "olecranon": "ulna", "coronoid process of ulna": "ulna", "radial notch": "ulna",
    "styloid process of radius": "radius",
    "trochanter": "femur", "linea aspera": "femur", "intercondylar": "femur",
    "gluteal tuberosity": "femur",
    "acetabul": "hip_bone", "obturator": "hip_bone", "iliac": "hip_bone",
    "ilium": "hip_bone", "ischium": "hip_bone", "ischial": "hip_bone",
    "pubis": "hip_bone", "pubic": "hip_bone", "sciatic notch": "hip_bone",
    "ala of ilium": "hip_bone", "anterior superior iliac": "hip_bone",
    "lateral malleolus": "fibula", "medial malleolus": "tibia",
    "calcaneal": "calcaneus",
    "supra-orbital": "frontal_bone", "glabella": "frontal_bone",
    "external acoustic": "temporal_bone", "mastoid": "temporal_bone",
    "rib": "ribs", "costal": "ribs",
}
# individual vertebra levels: "Vertebra C3", "Vertebra T10", "Vertebra L2", Atlas, Axis
VERT_RE = re.compile(r"\bvertebra\s+(c[1-7]|t1[0-2]|t[1-9]|l[1-5])\b", re.I)

def bone_of(name):
    nl = name.lower().strip().strip("()").strip()
    # vertebrae FIRST so each level is its own bone (generic vertebra landmarks -> None -> absorbed)
    m = VERT_RE.search(nl)
    if m:
        return "Vertebra " + m.group(1).upper()
    if "atlas" in nl:
        return "Atlas (C1)"
    if "axis" in nl:                       # incl. "dens axis", "apex of dens axis"
        return "Axis (C2)"
    if "sacrum" in nl or "sacral" in nl:
        return "Sacrum"
    if "coccy" in nl:
        return "Coccyx"
    for bone in sorted(BONE_KEYWORDS, key=len, reverse=True):
        if bone in nl:
            return bone
    for kw, bone in sorted(LANDMARK_TO_BONE.items(), key=lambda x: -len(x[0])):
        if kw in nl:
            return bone
    if "phalanx" in nl or "phalanges" in nl:
        return "phalanges_of_foot" if "foot" in nl else "phalanges_of_hand"
    return None  # unmatched landmark/generic-vertebra-part -> absorbed into nearest bone

# canonical bone ids that act as spatial anchors for leftover landmarks
_VERT_LEVELS = (["atlas_c1", "axis_c2", "sacrum", "coccyx"]
                + [f"vertebra_c{i}" for i in range(3, 8)]
                + [f"vertebra_t{i}" for i in range(1, 13)]
                + [f"vertebra_l{i}" for i in range(1, 6)])
ANCHOR_IDS = ({re.sub(r"[^a-z0-9]+", "_", b).strip("_") for b in BONE_KEYWORDS}
              | set(LANDMARK_TO_BONE.values()) | set(_VERT_LEVELS)
              | {"hip_bone", "ribs", "phalanges_of_hand", "phalanges_of_foot"})

def is_excluded(name):
    nl = name.lower()
    return any(x in nl for x in CONF["exclude"])

# Z-Anatomy parks a top-level "system marker" object off at x=-1.0 (named after the whole
# system). It's not anatomy — drop it so it can't wreck framing or get absorbed into a bone.
SYSTEM_TITLE = re.sub(r"^\d+:\s*", "", CONF["coll"]).strip().lower()
def is_system_marker(base):
    b = base.lower().strip()
    return (b == SYSTEM_TITLE or "system" in b
            or b in ("sense organs", "lymphoid organs", "muscular insertions",
                     "nervous system & sense organs"))

# ---------------------------------------------------------------- gather
root = bpy.data.collections.get(CONF["coll"])
assert root, f"collection {CONF['coll']} not found"
meshes = [o for o in root.all_objects if o.type == "MESH" and o.data and len(o.data.vertices) > 0]

# region map (muscular) via membership in "Muscles of X"/group collections
# ordered most-specific -> least; first hit wins
REGION = [
    ("muscles of hand", "hand"), ("muscles of foot", "foot"),
    ("muscles of head", "head"), ("superficial muscles of head", "head"),
    ("facial muscles", "head"), ("masticatory muscles", "head"),
    ("muscles of neck", "neck"),
    ("muscles of thorax", "thorax"),
    ("muscles of abdomen", "abdomen"), ("abdominal part of muscular system", "abdomen"),
    ("dorsal part of muscular system", "back"),
    ("muscles of pelvis", "pelvis"), ("perineal muscles", "pelvis"),
    ("pelvic diaphragm", "pelvis"),
    ("muscles of upper limb", "upper_limb"), ("muscular system of upper limb", "upper_limb"),
    ("muscles of lower limb", "lower_limb"), ("muscular system of lower limb", "lower_limb"),
    # fallbacks via region/limb collections muscles also belong to
    ("left hand", "hand"), ("right hand", "hand"),
    ("left foot", "foot"), ("right foot", "foot"),
    ("left upper limb", "upper_limb"), ("right upper limb", "upper_limb"),
    ("left lower limb", "lower_limb"), ("right lower limb", "lower_limb"),
    ("head", "head"), ("neck", "neck"), ("back", "back"), ("thorax", "thorax"),
    ("abdomen", "abdomen"), ("pelvis", "pelvis"), ("trunk", "trunk"),
]
def region_of(obj):
    names = {c.name.lower() for c in bpy.data.collections if obj.name in c.objects}
    for k, v in REGION:
        if k in names:
            return v
    return "other"

# depth seed: which objects are in a Superficial*/Deep-gluteal muscle collection
superficial_objs, deep_objs = set(), set()
for c in bpy.data.collections:
    cl = c.name.lower()
    if cl.startswith("superficial") and "muscle" in cl:
        for o in c.all_objects:
            if o.type == "MESH":
                superficial_objs.add(o.name)
    if cl.startswith("deep") and "muscle" in cl:
        for o in c.all_objects:
            if o.type == "MESH":
                deep_objs.add(o.name)

# ---------------------------------------------------------------- group detection
# final id base: parent (rollup) or base (no rollup)
def final_base(name):
    base, _ = split_side(name)
    if SYSTEM == "skeletal":
        return bone_of(base)               # may be None -> loose, absorbed into nearest bone
    return parent_of(base) if CONF["rollup"] else base

def is_connective(name):
    nl = name.lower()
    return any(x in nl for x in CONF["connective"])

# Aggregate (multi-structure joined mesh) detection.
#  - muscular: data-driven (a collection name that holds >=2 distinct structures).
#  - skeletal: EXPLICIT patterns only, so a per-bone collection can never nuke its own
#    bone when landmark rollup is incomplete (leftovers are absorbed spatially below).
if SYSTEM == "skeletal":
    SKEL_AGG = ["skeleton", "skeletal", "bones of", "cranium", "calvaria",
                "vertebral column", "bony pelvis", "thoracic cage", "facial skeleton",
                "neurocranium", "viscerocranium", "carpus", "tarsus", "auditory ossicles",
                "skull", "vertebrae", "ribs and", "thorax", "bony"]
    def is_aggregate(base):
        bl = base.lower().strip()
        return is_system_marker(base) or any(a in bl for a in SKEL_AGG)
else:
    coll_bases = {}
    for c in bpy.data.collections:
        bs = set()
        for o in c.all_objects:
            if o.type == "MESH" and o.data and len(o.data.vertices) > 0 and not is_excluded(o.name):
                bs.add(norm(final_base(o.name)))
        coll_bases[norm(c.name)] = bs
    GROUP_NAMES = {cn for cn, bs in coll_bases.items() if len(bs) >= 2}
    def is_aggregate(base):
        return is_system_marker(base) or norm(base) in GROUP_NAMES

# ---------------------------------------------------------------- assign objects to structures
import mathutils
structs = {}   # id -> {"objs":[], "parent":str, "sources":[], "sides":[]}
loose = []     # (obj, base): connective tissue + unmatched landmarks -> absorbed below
dropped = {"excluded": 0, "group_aggregate": 0, "joined_dup": 0, "absorbed": 0}

# first pass: classify + bucket anchor structures by id
buckets = {}
for o in meshes:
    base, suf = split_side(o.name)
    if is_excluded(o.name):
        dropped["excluded"] += 1
        continue
    if is_aggregate(base):               # multi-structure joined mesh (e.g. "Erector spinae")
        dropped["group_aggregate"] += 1
        continue
    if is_connective(o.name):            # tendon/fascia/cartilage -> attach to nearest structure
        loose.append((o, base))
        continue
    fb = final_base(o.name)
    if fb is None:                       # skeletal generic landmark -> nearest bone
        loose.append((o, base))
        continue
    buckets.setdefault(to_id(fb), []).append((o, base, suf))

# second pass: per id, prefer sided leaves; drop joined .j/.g/.i if any .l/.r present
for pid, items in buckets.items():
    has_sided = any(suf in ("l", "r") for _, _, suf in items)
    keep = [(o, b, s) for (o, b, s) in items if not (has_sided and s in ("j", "g", "i", ""))]
    dropped["joined_dup"] += len(items) - len(keep)
    if not keep:
        continue
    structs[pid] = {
        "objs": [o for o, _, _ in keep],
        "parent": final_base(keep[0][0].name),
        "sources": sorted({b for _, b, _ in keep}),
        "sides": sorted({s for _, _, s in keep if s}),
    }

# absorb each loose object into the nearest anchor structure (per-object, by world centroid).
def obj_centroid(o):
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return sum(bb, mathutils.Vector((0, 0, 0))) / 8.0

if loose and structs:
    # skeletal absorbs only into canonical bones; other systems into any structure
    anchor_ids = [p for p in structs if (SYSTEM != "skeletal" or p in ANCHOR_IDS)] or list(structs)
    acent = {p: obj_centroid(structs[p]["objs"][0]) for p in anchor_ids}  # representative point
    for p in anchor_ids:  # better centroid: mean of the structure's objects
        c = mathutils.Vector((0, 0, 0))
        for o in structs[p]["objs"]:
            c += obj_centroid(o)
        acent[p] = c / len(structs[p]["objs"])
    for o, base in loose:
        c = obj_centroid(o)
        nearest = min(anchor_ids, key=lambda a: (acent[a] - c).length)
        structs[nearest]["objs"].append(o)
        if base not in structs[nearest]["sources"]:
            structs[nearest]["sources"].append(base)
        dropped["absorbed"] += 1

# ---------------------------------------------------------------- build merged objects
export_coll = bpy.data.collections.new("EXPORT")
bpy.context.scene.collection.children.link(export_coll)

def merge_objects(objs, new_name):
    bm = bmesh.new()
    for src in objs:
        tmp = bpy.data.meshes.new("_t")
        bmt = bmesh.new()
        bmt.from_mesh(src.data)
        bmt.transform(src.matrix_world)   # bake world transform
        bmt.to_mesh(tmp)
        bmt.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)  # weld seams between parts
    me = bpy.data.meshes.new(new_name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(new_name, me)
    export_coll.objects.link(obj)
    return obj

depth_overrides = {}
ov_path = os.path.join(os.path.dirname(__file__), "depth_overrides.json")
if os.path.exists(ov_path):
    depth_overrides = {k: v for k, v in json.load(open(ov_path)).items() if not k.startswith("_")}

catalog, report = [], []
for pid, info in sorted(structs.items()):
    obj = merge_objects(info["objs"], pid)
    dec = obj.modifiers.new("dec", "DECIMATE")
    dec.ratio = DECIMATE

    # depth: seed from collections, then override
    seed = "unknown"
    onames = {o.name for o in info["objs"]}
    if onames & superficial_objs:
        seed = "superficial"
    elif onames & deep_objs:
        seed = "deep"
    depth = depth_overrides.get(pid, seed)
    depth_source = "override" if pid in depth_overrides else ("z-anatomy" if seed != "unknown" else None)
    depth_order = {"superficial": 0, "unknown": 1, "deep": 2}[depth]

    if SYSTEM == "skeletal":
        region = "skeleton"
    else:
        region = region_of(info["objs"][0])
        if region == "other" and SYSTEM != "muscular":
            region = SYSTEM
    name_en = re.sub(r"\s+(muscle|mucle)$", "", info["parent"]).strip().strip("()").strip()

    catalog.append({
        "id": pid,
        "nameEn": name_en[:1].upper() + name_en[1:] if name_en else pid,
        "nameLatin": info["parent"],
        "nameFa": "",
        "descriptionEn": "",
        "descriptionFa": "",
        "system": SYSTEM,
        "region": region,
        "depth": depth,
        "depthOrder": depth_order,
        "depthSource": depth_source,
        "aliases": [s for s in info["sources"] if s != info["parent"]],
    })
    report.append({
        "id": pid, "parent": info["parent"], "n_source_objects": len(info["objs"]),
        "sides": info["sides"], "depth": depth, "depthSource": depth_source,
        "region": region, "source_parts": info["sources"],
    })

# ---------------------------------------------------------------- completeness audit
# Every distinct source base-name that is NOT a non-target look-alike and NOT a multi-
# structure aggregate MUST resolve to a catalog id (as a parent or via absorption).
# uncovered == [] proves zero structures were dropped (only excluded look-alikes removed).
src_bases, excluded_bases, aggregate_bases, connective_bases = {}, set(), set(), set()
for o in meshes:
    base, _ = split_side(o.name)
    if is_excluded(o.name):
        excluded_bases.add(base); continue
    if is_aggregate(base):
        aggregate_bases.add(base); continue
    if is_connective(o.name) or final_base(o.name) is None:
        connective_bases.add(base); continue   # absorbed into nearest structure (not lost)
    src_bases[base] = to_id(final_base(o.name))
final_ids = set(structs.keys())
uncovered = sorted({b for b, pid in src_bases.items() if pid not in final_ids})
audit = {
    "distinct_source_bases_kept": len(src_bases),
    "distinct_final_ids": len(final_ids),
    "uncovered_bases": uncovered,                 # MUST be empty -> no structure dropped
    "n_uncovered": len(uncovered),
    "n_absorbed_connective_or_landmark": len(connective_bases),
    "excluded_lookalike_bases": sorted(excluded_bases),
    "n_excluded_lookalike": len(excluded_bases),
    "aggregate_join_bases": sorted(aggregate_bases),
}

# ---------------------------------------------------------------- pre-export tri count (decimated)
deps = bpy.context.evaluated_depsgraph_get()
final_tris = 0
for obj in list(export_coll.objects):
    ev = obj.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    final_tris += len(me.loop_triangles)
    ev.to_mesh_clear()

# ---------------------------------------------------------------- export GLB (Draco)
for o in bpy.context.scene.objects:
    o.select_set(False)
for o in export_coll.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = next(iter(export_coll.objects), None)

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True,
    export_apply=True,                       # bake the Decimate modifier
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_materials="NONE",                 # app assigns materials at runtime
    export_normals=True, export_texcoords=False,
    export_cameras=False, export_lights=False, export_extras=False,
)

json.dump(catalog, open(OUT_CAT, "w"), ensure_ascii=False, indent=2)
json.dump({"system": SYSTEM, "decimate": DECIMATE, "structures": len(structs),
           "dropped": dropped, "final_tris": final_tris, "audit": audit, "detail": report},
          open(OUT_REP, "w"), ensure_ascii=False, indent=2)

size_mb = os.path.getsize(OUT_GLB) / 1e6 if os.path.exists(OUT_GLB) else 0
print("DONE_EXPORT", SYSTEM)
print(f"  structures={len(structs)} source_meshes={len(meshes)} "
      f"dropped={dropped} final_tris={final_tris} glb_MB={size_mb:.2f}")
print(f"  AUDIT kept_bases={audit['distinct_source_bases_kept']} "
      f"final_ids={audit['distinct_final_ids']} UNCOVERED={audit['n_uncovered']} "
      f"excluded_lookalikes={audit['n_excluded_lookalike']}")
