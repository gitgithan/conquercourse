"""Render three still frames of an exported course in headless Blender (CC-188).
Usage: python render_stills.py <course.glb> <rookie.glb> <out_dir> [samples]
Cycles on the CPU (EEVEE needs a GPU/EGL, which the VMs lack). Sky, sun, depth of field, denoise.
"""
import json, math, sys, time
import bpy
from mathutils import Vector

course, rookie, out, samples = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 48
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=course)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=rookie)
runner = [o for o in bpy.data.objects if o not in before]
roots = [o for o in runner if o.parent is None]
info = {"rookie_objects": len(runner)}

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'Filmic' if 'Filmic' in [t.identifier for t in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'AgX'
sc.view_settings.look = 'None'
sc.view_settings.exposure = -1.8

# sky: physical sky (multiple scattering), sun low for long shadows
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'MULTIPLE_SCATTERING'
bg = nt.nodes.new('ShaderNodeBackground'); o = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], o.inputs[0])

def sun(elev_deg, azim_deg, strength=3.0):
    sky.sun_elevation = math.radians(elev_deg); sky.sun_rotation = math.radians(azim_deg)
    sky.sun_size = math.radians(1.0); sky.air_density = 1.2
    for ob in [x for x in bpy.data.objects if x.type == 'LIGHT']: bpy.data.objects.remove(ob)
    l = bpy.data.lights.new('sun', 'SUN'); l.energy = strength; l.angle = math.radians(1.0)
    lo = bpy.data.objects.new('sun', l); sc.collection.objects.link(lo)
    lo.rotation_euler = (math.radians(90 - elev_deg), 0, math.radians(azim_deg + 180))

def place_runner(x, y, z=0.0, face=1):
    # the Rookie stands in its bind pose (no motion is used); metres, facing +x
    for r in roots:
        r.location = (x, z, y)  # glTF importer maps game (x,y,z) to Blender (x,-z,y)
        r.rotation_euler = (0, 0, 0) if face > 0 else (0, 0, math.pi)

def camera(loc, look, lens, fstop, focus):
    cam = bpy.data.cameras.new('cam'); cam.lens = lens
    cam.dof.use_dof = fstop is not None
    if fstop: cam.dof.aperture_fstop = fstop; cam.dof.focus_distance = focus
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co)
    co.location = loc
    co.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    return co

shots = [
  # name, sun (elev, azim, strength), runner (x, y), camera loc (Blender: x, -z, y), look, lens, fstop, focus
  ("1-wall-golden",   (9, 70, 4.0),  (84.0, 0.5),   (74.0, -9.0, 2.2), (86.0, 0.0, 2.0), 35, 2.0, 12.5),
  ("2-rope-wide",     (22, 200, 3.5), (186.0, 6.5),  (170.0, -22.0, 9.5), (189.0, 0.0, 8.0), 40, 5.6, 28.0),
  ("3-lache-closeup", (12, 120, 4.0), (164.0, 8.0), (158.0, -7.0, 9.0), (165.0, 0.0, 9.0), 85, 1.8, 8.5),
]
t0 = time.time(); times = {}
for name, s, rp, cl, lk, lens, fs, fd in shots:
    t = time.time()
    sun(*s)
    place_runner(rp[0], rp[1])
    for ob in [x for x in bpy.data.objects if x.type == 'CAMERA']: bpy.data.objects.remove(ob)
    camera(cl, lk, lens, fs, fd)
    sc.render.filepath = f"{out}/{name}.png"
    bpy.ops.render.render(write_still=True)
    times[name] = round(time.time() - t, 1)
info.update(blender=bpy.app.version_string, engine='CYCLES-CPU', samples=samples, seconds_per_shot=times, total_seconds=round(time.time() - t0, 1))
json.dump(info, open(f"{out}/render-info.json", 'w'), indent=2)
print(info)
