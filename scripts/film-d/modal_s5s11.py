# Shots 5 and 11 of the film (CC-143) on Modal CPU containers.
#   shot 5 A/B: the real preview page; B uses shot5.mjs (the chase). shot 11: the build in ./dist (the film-only group page), 10 rigs, so 8 CPUs and 16 GB.
import modal, subprocess, glob, json
import os
WITH_DIST = os.path.isfile("dist.tgz") and os.environ.get("S11") == "1"  # only the group photo needs the build
app = modal.App("cc-film-s11" if WITH_DIST else "cc-film-s5")
vol = modal.Volume.from_name("cc-film-s5s11-out", create_if_missing=True)  # results are written here, so a dropped client connection loses nothing (run with --detach)
base = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("shot5.mjs", "/b/shot5.mjs").add_local_file("grec.mjs", "/b/grec.mjs").add_local_file("group.mjs", "/b/group.mjs"))
img11 = base.add_local_file("dist.tgz", "/dist.tgz") if WITH_DIST else base
def cut(f, start, secs):
    subprocess.run(["ffmpeg","-y","-ss",str(start/1000),"-t",str(secs),"-i",f,"-r","30","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    return open("/b/o.mp4","rb").read()
@app.function(image=base, cpu=8, memory=16384, timeout=900, volumes={"/out": vol})
def s5(script, spec, name):
    import shutil
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run(f"cd /b && xvfb-run -a node {script} /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    print(r.stdout[-900:], r.stderr[-600:])
    t = json.loads(r.stdout.strip().splitlines()[-1])
    open(f"/out/{name}.mp4","wb").write(cut(glob.glob("/b/v/*.webm")[0], t["start"], spec["seconds"])); vol.commit()
@app.function(image=img11, cpu=8, memory=16384, timeout=1800, volumes={"/out": vol})
def s11(spec, name):
    import shutil, os, time
    os.makedirs("/dist", exist_ok=True); subprocess.run("tar xzf /dist.tgz -C /dist", shell=True, check=True)
    srv = subprocess.Popen("python3 -m http.server 8080 --directory /dist", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(2)
    shutil.rmtree("/b/f", ignore_errors=True); os.makedirs("/b/f")
    open("/b/spec.json","w").write(json.dumps(spec))
    r = subprocess.run("cd /b && xvfb-run -a node group.mjs /b/node_modules/playwright/index.mjs /b/f /b/spec.json", shell=True, capture_output=True, text=True)
    print(r.stdout[-500:], r.stderr[-800:])
    subprocess.run(["ffmpeg","-y","-framerate",str(spec["fps"]),"-i","/b/f/%04d.png","-c:v","libx264","-crf","16","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    open(f"/out/{name}.mp4","wb").write(open("/b/o.mp4","rb").read()); vol.commit()
