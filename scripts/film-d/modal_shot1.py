import modal, subprocess, glob, json
app = modal.App("cc-film-shot1")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("shot1.mjs", "/b/shot1.mjs"))
@app.function(image=img, cpu=8, timeout=900)
def rec(spec):
    import shutil
    open("/b/spec.json","w").write(json.dumps(spec)); shutil.rmtree("/b/v", ignore_errors=True)
    r = subprocess.run("cd /b && xvfb-run -a node shot1.mjs /b/node_modules/playwright/index.mjs /b/v /b/spec.json", shell=True, capture_output=True, text=True)
    print(r.stdout[-300:], r.stderr[-600:])
    t = json.loads(r.stdout.strip().splitlines()[-1]); f = glob.glob("/b/v/*.webm")[0]
    subprocess.run(["ffmpeg","-y","-ss",str(t["start"]/1000),"-t",str(spec["seconds"]),"-i",f,"-r","30","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","/b/o.mp4"],check=True,capture_output=True)
    return open("/b/o.mp4","rb").read()
@app.local_entrypoint()
def main(spec: str = "shot1.spec.json", out: str = "/tmp/f0/shot1.mp4"):
    b = rec.remote(json.load(open(spec))); open(out, "wb").write(b); print("got", len(b))
