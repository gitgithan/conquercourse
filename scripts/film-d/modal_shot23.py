import modal, subprocess, glob, json
app = modal.App("cc-film-shot23")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("shot2.mjs", "/b/shot2.mjs").add_local_file("shot3.mjs", "/b/shot3.mjs"))
@app.function(image=img, cpu=8, memory=16384, timeout=1200)
def rec(name, spec):
    import shutil
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run(f"cd /b && xvfb-run -a node --max-old-space-size=12000 {name}.mjs /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    print(name, r.stdout[-600:], r.stderr[:1800], '...', r.stderr[-800:])
    if not r.stdout.strip(): return name, b'', '{}'
    t = json.loads(r.stdout.strip().splitlines()[-1]); f = glob.glob("/b/v/*.webm")[0]
    ss = t["start"]/1000
    subprocess.run(["ffmpeg","-y","-ss",str(ss),"-i",f,"-r","30","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    return name, open("/b/o.mp4","rb").read(), json.dumps(t)
@app.local_entrypoint()
def main(only: str = "shot2,shot3", tag: str = "v1"):
    import os; os.makedirs("out", exist_ok=True)
    calls = [(n, rec.spawn(n, json.load(open(f"{n}.spec.json")))) for n in only.split(",")]
    for n, c in calls:
        try:
            name, b, t = c.get()
            open(f"out/{name}_{tag}_full.mp4","wb").write(b); open(f"out/{name}_{tag}.json","w").write(t); print("got", name, len(b))
        except Exception as e: print("FAILED", n, str(e)[:200])
