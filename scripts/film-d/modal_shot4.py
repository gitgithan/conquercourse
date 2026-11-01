# Shot 4 (CC-143) on Modal: CPU containers only. Lift frames in 3 shards + the run in one container; frames come back as one tar each.
# usage: SHOT4_STAGE=<dir with three, GLTFLoader, rail01.jpg, railing-iron.glb, index.html> modal run modal_shot4.py --out <dir>
import modal, subprocess, json, os, io, tarfile, shutil
app = modal.App("cc-film-shot4")
vol = modal.Volume.from_name("cc-shot4-frames", create_if_missing=True)
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("shot4-lift.mjs", "/b/shot4-lift.mjs").add_local_file("shot4-run.mjs", "/b/shot4-run.mjs")
  .add_local_dir(os.environ.get("SHOT4_STAGE", "stage4"), "/b/stage"))
def tar(d):
    bio = io.BytesIO()
    with tarfile.open(fileobj=bio, mode="w") as t: t.add(d, arcname=".")
    return bio.getvalue()
@app.function(image=img, cpu=8, timeout=1800, volumes={"/v": vol})
def lift(a, b):
    name = f"lift{a}.tar"
    shutil.rmtree("/b/o", ignore_errors=True)
    r = subprocess.run(f"cd /b && xvfb-run -a node shot4-lift.mjs /b/node_modules/playwright/index.mjs /b/stage /b/o {a} {b}", shell=True, capture_output=True, text=True)
    print(r.stdout[-300:], r.stderr[-600:]); open("/v/"+name, "wb").write(tar("/b/o")); vol.commit(); return name
@app.function(image=img, cpu=8, timeout=3000, volumes={"/v": vol})
def run(spec):
    name = "run.tar"
    shutil.rmtree("/b/o", ignore_errors=True); open("/b/spec.json","w").write(json.dumps(spec))
    r = subprocess.run("cd /b && xvfb-run -a node shot4-run.mjs /b/node_modules/playwright/index.mjs /b/o /b/spec.json", shell=True, capture_output=True, text=True)
    print(r.stdout[-500:], r.stderr[-600:]); open("/v/"+name, "wb").write(tar("/b/o")); vol.commit(); return name
@app.local_entrypoint()
def main(spec: str = "shot4.spec.json", n: int = 120):
    # results land on the volume cc-shot4-frames (fetch with: modal volume get cc-shot4-frames / <dir>), so a dropped connection loses nothing (run with --detach)
    s = json.load(open(spec)); k = n // 3
    jobs = [lift.spawn(i*k, (i+1)*k) for i in range(3)] + [run.spawn(s)]
    for j in jobs: print(j.get())
    print("done")
