import modal, subprocess, glob, json, sys
app = modal.App("cc-film-g")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("grec.mjs", "/b/grec.mjs"))
@app.function(image=img, cpu=8, timeout=900)
def rec(name, spec):
    import os, shutil
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run("cd /b && xvfb-run -a node grec.mjs /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    print(name, r.stdout[-300:], r.stderr[-400:])
    t = json.loads(r.stdout.strip().splitlines()[-1]); f = glob.glob("/b/v/*.webm")[0]
    subprocess.run(["ffmpeg","-y","-ss",str(t["start"]/1000),"-t",str(spec["seconds"]),"-i",f,"-r","30","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    return name, open("/b/o.mp4","rb").read()
@app.local_entrypoint()
def main(specs: str, only: str = ""):
    S = json.load(open(specs)); keys = only.split(",") if only else list(S)
    for name, b in rec.starmap([(k, S[k]) for k in keys]):
        open(f"gout/{name}.mp4","wb").write(b); print("got", name, len(b))
