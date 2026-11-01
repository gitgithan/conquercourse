import modal, subprocess, glob, json, io, tarfile
app = modal.App("cc-film-diag7")
img = (modal.Image.debian_slim(python_version="3.11")
  .apt_install("curl","ca-certificates","ffmpeg","xvfb","libgl1-mesa-dri","libegl1","libgl1")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .add_local_file("diag7.mjs", "/b/diag7.mjs"))
@app.function(image=img, cpu=8, timeout=900)
def diag(spec):
    open("/b/spec.json","w").write(json.dumps(spec))
    r = subprocess.run("cd /b && rm -rf d && xvfb-run -a node diag7.mjs /b/node_modules/playwright/index.mjs /b/d /b/spec.json", shell=True, capture_output=True, text=True)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t: t.add("/b/d", arcname="d")
    return r.stdout, r.stderr[-500:], buf.getvalue()
@app.local_entrypoint()
def main(url: str, seconds: int = 8, out: str = "/tmp/claude-1000/-home-hanqi-code-conquercourse/a7b698af-e678-4d19-a026-b5d7a08a1754/scratchpad/diag"):
    import os
    so, se, tb = diag.remote({"url": url, "seconds": seconds})
    print(so, se); os.makedirs(out, exist_ok=True); open(out + "/d.tgz", "wb").write(tb)
