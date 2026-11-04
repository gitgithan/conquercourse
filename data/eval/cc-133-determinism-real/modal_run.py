"""CC-133: run the game's golden-trace logic on real engines and CPUs on Modal (CPU only, x86-64).
Usage (from the repo root, after `node data/eval/cc-133-determinism-real/build.mjs`):
  modal run data/eval/cc-133-determinism-real/modal_run.py
Writes raw results to ../conquercourse-assets/eval-full/cc-133-determinism-real/raw/<machine>.json (not tracked).
Cost: about two CPU cores for a few minutes (image build plus five short runs), well under 1 US dollar.
"""
import json
import pathlib

import modal

HERE = pathlib.Path(__file__).parent
NODE24, NODE22 = "24.20.0", "22.23.0"
image = (
    modal.Image.from_registry("ubuntu:24.04", add_python="3.12")
    .apt_install("curl", "xz-utils", "ca-certificates")
    .run_commands(
        f"mkdir -p /opt/n24 /opt/n22 /work",
        f"curl -fsSL https://nodejs.org/dist/v{NODE24}/node-v{NODE24}-linux-x64.tar.xz | tar -xJ -C /opt/n24 --strip-components=1",
        f"curl -fsSL https://nodejs.org/dist/v{NODE22}/node-v{NODE22}-linux-x64.tar.xz | tar -xJ -C /opt/n22 --strip-components=1",
        "cd /work && export PATH=/opt/n24/bin:$PATH && npm init -y >/dev/null && npm i playwright@1.64.1 --no-audit --no-fund",
        "cd /work && PATH=/opt/n24/bin:$PATH npx playwright install --with-deps chromium firefox webkit",
    )
    .add_local_dir(str(HERE / "dist"), "/work/dist", copy=True)
    .add_local_file(str(HERE / "run-node.mjs"), "/work/run-node.mjs", copy=True)
    .add_local_file(str(HERE / "run-browser.mjs"), "/work/run-browser.mjs", copy=True)
)
app = modal.App("cc-133-determinism-real", image=image)


@app.function(cpu=2, memory=4096, timeout=900)
def run_all() -> dict:
    import subprocess

    cpu = [l.split(":", 1)[1].strip() for l in open("/proc/cpuinfo") if l.startswith("model name")][:1]
    flags = [l for l in open("/proc/cpuinfo") if l.startswith("flags")][:1]
    host = {"cpu": cpu[0] if cpu else "unknown", "fma": bool(flags and " fma " in flags[0]), "uname": subprocess.check_output(["uname", "-m"], text=True).strip()}
    out = {"host": host, "results": {}}
    jobs = {
        "node24": ["/opt/n24/bin/node", "run-node.mjs"],
        "node22": ["/opt/n22/bin/node", "run-node.mjs"],
        "chromium": ["/opt/n24/bin/node", "run-browser.mjs", "chromium"],
        "firefox": ["/opt/n24/bin/node", "run-browser.mjs", "firefox"],
        "webkit": ["/opt/n24/bin/node", "run-browser.mjs", "webkit"],
    }
    for name, cmd in jobs.items():
        p = subprocess.run(cmd, cwd="/work", capture_output=True, text=True, timeout=600)
        out["results"][name] = json.loads(p.stdout) if p.returncode == 0 and p.stdout.strip() else {"error": (p.stderr or "")[-600:]}
    return out


@app.local_entrypoint()
def main():
    res = run_all.remote()
    raw = pathlib.Path("../conquercourse-assets/eval-full/cc-133-determinism-real/raw")
    raw.mkdir(parents=True, exist_ok=True)
    (raw / "modal.json").write_text(json.dumps(res))
    print(json.dumps({k: (v.get("machine", {}).get("engine") or v.get("error")) for k, v in res["results"].items()}, indent=1), res["host"])
