import modal, subprocess, glob, json, time, os
app = modal.App("cc-film-shot6")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("shot6.mjs", "/b/shot6.mjs")
  .add_local_file(os.environ.get("DIST", "dist.tgz"), "/b/dist.tgz"))  # a gzipped local build of the branch (vite build), served inside the container; no deploy
@app.function(image=img, cpu=8, timeout=900)
def rec(spec):
    import shutil
    subprocess.run("mkdir -p /b/dist && tar xzf /b/dist.tgz -C /b/dist", shell=True, check=True)
    srv = subprocess.Popen("cd /b/dist && python3 -m http.server 8123", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run("cd /b && xvfb-run -a node shot6.mjs /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    srv.kill()
    print(r.stdout[-300:], r.stderr[-3000:])
    t = json.loads(r.stdout.strip().splitlines()[-1]); f = glob.glob("/b/v/*.webm")[0]
    subprocess.run(["ffmpeg","-y","-ss",str(t["start"]/1000),"-t",str(spec["seconds"]),"-i",f,"-r","30","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    shots = {os.path.basename(x): open(x,"rb").read() for x in glob.glob("/b/v/shots/*.png")}
    return open("/b/o.mp4","rb").read(), shots
@app.local_entrypoint()
def main(spec: str, out: str, only_log: bool = False):
    b, shots = rec.remote(json.load(open(spec))); open(out, "wb").write(b); print("got", len(b))
    for k, v in shots.items(): open(out.replace(".mp4", "_" + k), "wb").write(v)
