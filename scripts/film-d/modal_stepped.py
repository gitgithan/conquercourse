import modal, subprocess, json, shutil
app = modal.App("cc-film-stepped")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("stepped.mjs", "/b/stepped.mjs"))
@app.function(image=img, cpu=8, timeout=3000)
def rec(name, spec):
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run("cd /b && xvfb-run -a node stepped.mjs /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    print(name, "\n".join(r.stdout.splitlines()[-400:]), r.stderr[-400:])
    if spec.get("probe"): return name, b""
    subprocess.run(["ffmpeg","-y","-framerate",str(spec.get("fps",30)),"-i","/b/v/f%05d.jpg","-c:v","libx264","-crf","17","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    return name, open("/b/o.mp4","rb").read()
@app.local_entrypoint()
def main(specs: str, only: str = ""):
    import os; os.makedirs("sout", exist_ok=True)
    S = json.load(open(specs)); keys = only.split(",") if only else list(S)
    for name, b in rec.starmap([(k, S[k]) for k in keys]):
        if b: open(f"sout/{name}.mp4","wb").write(b); print("got", name, len(b))
