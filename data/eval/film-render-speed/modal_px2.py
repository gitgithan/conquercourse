import modal, subprocess, json
app = modal.App("cc-px-check2")
img = (modal.Image.from_registry("nvidia/cuda:12.4.1-runtime-ubuntu22.04", add_python="3.11")
  .apt_install("curl","ca-certificates","libvulkan1","libegl1","libgl1","vulkan-tools","mesa-vulkan-drivers","xvfb")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .pip_install("pillow","numpy")
  .env({"NVIDIA_DRIVER_CAPABILITIES":"all"})
  .add_local_file("frames2.mjs","/b/frames2.mjs"))
@app.function(image=img, gpu="L4", timeout=900)
def run():
    import numpy as np
    from PIL import Image
    import glob, os
    base = "https://preview.conquercourse.pages.dev"
    for m, d in (("soft", "soft"), ("soft", "soft2"), ("gpu", "gpu")):
        subprocess.run(f"cd /b && xvfb-run -a node frames2.mjs /b/node_modules/playwright/index.mjs {m} {base} /b/{d}", shell=True, timeout=500)
    def cmp(x, y):
        res = []
        for f in sorted(glob.glob(f"/b/{x}/*.png")):
            g = f.replace(f"/{x}/", f"/{y}/")
            a = np.asarray(Image.open(f).convert("RGB")).astype(int); c = np.asarray(Image.open(g).convert("RGB")).astype(int)
            d = np.abs(a - c).max(axis=2)
            res.append(dict(page=os.path.basename(f), differing_pct=round(float((d > 0).mean()) * 100, 2), over8_pct=round(float((d > 8).mean()) * 100, 2), over32_pct=round(float((d > 32).mean()) * 100, 3), max=int(d.max())))
        return res
    res = {"noise_soft_vs_soft": cmp("soft", "soft2"), "soft_vs_llvmpipe": cmp("soft", "gpu")}
    out = {"results": res}
    for m in ("soft", "soft2", "gpu"):
        out[m] = {os.path.basename(f): open(f, "rb").read() for f in sorted(glob.glob(f"/b/{m}/*.png"))}
    return out
@app.local_entrypoint()
def main():
    r = run.remote()
    print(json.dumps(r["results"]))
    import os; os.makedirs("pngs", exist_ok=True)
    for m in ("soft", "soft2", "gpu"):
        for n, b in r[m].items(): open(f"pngs/{m}-{n}", "wb").write(b)
