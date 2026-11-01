# Shot 6 with the frame-exact stepped recorder (stepped.mjs), serving a local build of the branch inside the container (no deploy).
import modal, subprocess, json, shutil, time, os
app = modal.App("cc-film-shot6s")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("stepped.mjs", "/b/stepped.mjs")
  .add_local_file(os.environ.get("DIST", "dist.tgz"), "/b/dist.tgz"))
@app.function(image=img, cpu=8, timeout=3000)
def rec(spec):
    subprocess.run("mkdir -p /b/dist && tar xzf /b/dist.tgz -C /b/dist", shell=True, check=True)
    srv = subprocess.Popen("cd /b/dist && python3 -m http.server 8123", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run("cd /b && xvfb-run -a node stepped.mjs /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    srv.kill(); print(r.stdout[-600:], r.stderr[-400:])
    n = spec["frames"]
    subprocess.run(["ffmpeg","-y","-framerate","30","-i","/b/v/f%05d.jpg","-f","lavfi","-i","color=c=black:s=1920x1080:r=30:d=1.2","-filter_complex","[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]concat=n=2:v=1[v]","-map","[v]","-c:v","libx264","-crf","17","/b/o.mp4"],check=True,capture_output=True)
    return open("/b/o.mp4","rb").read()
@app.local_entrypoint()
def main(spec: str, out: str):
    b = rec.remote(json.load(open(spec))); open(out, "wb").write(b); print("got", len(b))
