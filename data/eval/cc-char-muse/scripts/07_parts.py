"""Route C (parts on the standard rig), emulated: Rookie A's body below the neck + the HEAD cut from a route-A lift, weighted 100% to the Head bone.
In the game the part would be a tiny separate mesh parented to the Head bone; here both are merged into one skinned GLB so the same viewer can pose it.
usage: PYTHONPATH=pipelines uv run --no-project --with numpy --with scipy --with pillow python 07_parts.py BAKED_DIR OUT_DIR id [id...]   (BAKED_DIR holds {id}.baked.npz from 04_bake_rig.py)"""
import io, json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigtool as rt

BAKED, OUT = sys.argv[1:3]
CUT_PART, CUT_BASE = 1.50, 1.52  # metres: the part keeps what is above 1.50, the body keeps what is below 1.52 (2 cm overlap hides the neck seam)
os.makedirs(OUT, exist_ok=True)
t = rt.Template()
prim = t.j["meshes"][0]["primitives"][0]
bf = rt.acc(t.j, t.bin, prim["indices"]).reshape(-1, 3).astype(np.int64)
buv = rt.acc(t.j, t.bin, prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
bv_img = t.j["bufferViews"][t.j["images"][0]["bufferView"]]
base_tex = np.array(Image.open(io.BytesIO(t.bin[bv_img["byteOffset"]: bv_img["byteOffset"] + bv_img["byteLength"]])).convert("RGB").resize((512, 512), Image.LANCZOS))
head = t.names.index("Head")
keep = (t.v[bf, 1] < CUT_BASE).all(1)
runs = []
for cid in sys.argv[3:]:
    d = np.load(f"{BAKED}/{cid}.baked.npz")
    V, _ = rt.fit_to_template(t, d["v"])
    F, UV, tex = d["f"], d["uv"], d["tex"]
    pf = F[(V[F, 1] >= CUT_PART).all(1)]
    used = np.unique(pf); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
    pV, pUV, pF = V[used], UV[used], remap[pf]
    bfk = bf[keep]; bused = np.unique(bfk); bremap = -np.ones(len(t.v), int); bremap[bused] = np.arange(len(bused))
    Vm = np.vstack([t.v[bused], pV]); Fm = np.vstack([bremap[bfk], pF + len(bused)])
    UVm = np.vstack([buv[bused] * [0.5, 1], pUV * [0.5, 1] + [0.5, 0]])
    ptex = np.array(Image.fromarray(tex).convert("RGB").resize((512, 512), Image.LANCZOS))
    atlas = np.concatenate([base_tex, ptex], axis=1)
    J = np.zeros((len(Vm), 4), np.uint8); W = np.zeros((len(Vm), 4), np.float32)
    J[: len(bused)] = t.jt[bused]; W[: len(bused)] = t.w[bused]
    J[len(bused):, 0] = head; W[len(bused):, 0] = 1.0
    size, tb = rt.write_skinned_glb(f"{OUT}/p-{cid}.glb", t, Vm, Fm, UVm, atlas, J, W, tex_size=1024)
    # what the part alone would weigh as its own tiny file: positions, normals, uvs, 16-bit indices and a 256 px JPEG
    jb = io.BytesIO(); Image.fromarray(tex).convert("RGB").resize((256, 256), Image.LANCZOS).save(jb, "JPEG", quality=80, optimize=True)
    part_bytes = len(pV) * 32 + len(pF) * 6 + len(jb.getvalue())
    recipe = {"base": "rookie-a", "parts": [{"from": cid, "region": "head", "joint": "Head", "faces": int(len(pF)), "verts": int(len(pV)), "approx_file_bytes": int(part_bytes)}]}
    json.dump(recipe, open(f"{OUT}/p-{cid}.recipe.json", "w"), indent=2)
    runs.append({"id": f"p-{cid}", "merged_glb_bytes": size, "part_faces": int(len(pF)), "part_verts": int(len(pV)), "approx_part_file_bytes": int(part_bytes), "recipe_bytes": len(json.dumps(recipe))})
    print(runs[-1], flush=True)
json.dump(runs, open(f"{OUT}/parts_runs.json", "w"), indent=2)
