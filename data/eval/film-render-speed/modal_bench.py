import modal, subprocess, json
app = modal.App("cc-film-bench")
img = (modal.Image.from_registry("nvidia/cuda:12.4.1-runtime-ubuntu22.04", add_python="3.11")
  .apt_install("curl","ca-certificates","libvulkan1","libegl1","libgl1","vulkan-tools","mesa-vulkan-drivers","xvfb")
  .run_commands("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
                "mkdir -p /b && cd /b && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null && npx playwright install --with-deps chromium >/dev/null 2>&1")
  .env({"NVIDIA_DRIVER_CAPABILITIES":"all"})
  .add_local_file("bench.mjs","/b/bench.mjs"))
@app.function(image=img, gpu="L4", timeout=900)
def run(mode: str):
    out = {}
    out["nvidia"] = subprocess.run("nvidia-smi -L; ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d 2>&1", shell=True, capture_output=True, text=True).stdout
    url = "https://preview.conquercourse.pages.dev/?welcome=0"
    for m in ([mode] if mode else ["soft","gpu"]):
        r = subprocess.run(f"cd /b && xvfb-run -a node bench.mjs /b/node_modules/playwright/index.mjs modal-{m} {url} {m}", shell=True, capture_output=True, text=True, timeout=600)
        out[m] = (r.stdout + r.stderr)[-600:]
    return out
@app.local_entrypoint()
def main():
    print(json.dumps(run.remote(""), indent=1))
