"""Promo v2 filming on a Modal GPU (CC-133).

One clip per container: starts vite, runs one capture script from scripts/promo-v2 with the same
stepped clock, writes frames and marks.json to the Volume `promo-frames`, then downloads them.

  modal run scripts/promo-v2/modal_film.py --clip entrance
  modal run scripts/promo-v2/modal_film.py --clip scene1 --args b
  modal run scripts/promo-v2/modal_film.py --probe 1        # only print the GPU the browser sees

Frames land in ../conquercourse-assets/promo-v2b-modal/<name>/ (not in git).
"""
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import modal

_here = Path(__file__).resolve()
ROOT = _here.parents[2] if modal.is_local() else Path("/app")
APP_DIR = "/app"
GPU = os.environ.get("FILM_GPU", "T4")  # L4 queued for 10+ min on 2026-11-05; T4 starts at once

def _tarball():
    """One archive instead of ~5000 small uploads (a flaky uplink drops the connection on many files). Fixed mtimes keep the image cache stable."""
    out = Path(tempfile.gettempdir()) / "cc-film-repo.tgz"
    ex = [f"--exclude={x}" for x in ["node_modules", ".git", "data/eval", "test-results", "dist", "local-notes-q7", "*.mp4", "*.wav", "package-lock.json", "package.json"]]
    subprocess.run(["tar", "--sort=name", "--mtime=2026-01-01", "--owner=0", "--group=0", "-czf", str(out), *ex, "-C", str(ROOT), "."], check=True)
    return out


TARBALL = _tarball() if modal.is_local() else None

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "gnupg", "ffmpeg", "git", "pciutils", "mesa-utils", "libegl1", "libgl1", "libvulkan1", "vulkan-tools")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
    )
    .env({"NVIDIA_DRIVER_CAPABILITIES": "all", "PLAYWRIGHT_BROWSERS_PATH": "/opt/pw"})
    .add_local_file(ROOT / "package.json", f"{APP_DIR}/package.json", copy=True)
    .add_local_file(ROOT / "package-lock.json", f"{APP_DIR}/package-lock.json", copy=True)
    .run_commands(f"cd {APP_DIR} && npm ci --no-audit --no-fund", f"cd {APP_DIR} && npx playwright install --with-deps chromium")
    .add_local_file(TARBALL or "/dev/null", "/tmp/repo.tgz", copy=True)
    .run_commands(f"tar -xzf /tmp/repo.tgz -C {APP_DIR} && rm /tmp/repo.tgz")
)

app = modal.App("conquercourse-film", image=image)
frames_vol = modal.Volume.from_name("promo-frames", create_if_missing=True)
GL_ARGS = os.environ.get("FILM_GL", "gl-egl")


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=True, text=True, capture_output=True, **kw)


def start_vite(first=True):
    env = dict(os.environ)
    cmd = ["npx", "vite", "--strictPort", "--port", "5173", "--host", "127.0.0.1"] + (["--force"] if first else [])
    proc = subprocess.Popen(cmd, cwd=APP_DIR, stdout=open("/tmp/vite.log", "w"), stderr=subprocess.STDOUT, env=env)
    for _ in range(120):
        if sh("curl -sf http://127.0.0.1:5173/ -o /dev/null").returncode == 0:
            return proc
        time.sleep(1)
    raise RuntimeError("vite did not start: " + open("/tmp/vite.log").read()[-800:])


GPU_PROBE = """
const { chromium } = await import('playwright');
const gl = process.argv[2] || 'gl-egl';
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=' + gl, '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('about:blank');
const r = await p.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'no webgl2'; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
console.log('RENDERER', r);
await b.close();
"""


@app.function(gpu=GPU, timeout=600)
def probe():
    out = {}
    out["nvidia-smi"] = sh("nvidia-smi -L").stdout
    out["ls-nvidia-libs"] = sh("ls /usr/lib/x86_64-linux-gnu | grep -i -E 'nvidia|libEGL|libGLX' | head -30").stdout
    out["vulkaninfo"] = sh("vulkaninfo --summary 2>&1 | head -20").stdout
    Path(f"{APP_DIR}/probe.mjs").write_text(GPU_PROBE)
    for gl in ["gl-egl", "gl", "vulkan"]:
        r = sh(f"cd {APP_DIR} && node probe.mjs {gl}")
        out[f"chromium-{gl}"] = (r.stdout + r.stderr)[-500:]
    return out


@app.function(gpu=GPU, timeout=3 * 3600, volumes={"/frames": frames_vol}, max_containers=3)
def film(clip: str, args: list[str], name: str, gl: str = GL_ARGS, env: dict | None = None):
    t0 = time.time()
    vite = start_vite(True)
    out = f"/frames/{name}"
    sh(f"rm -rf {out}")
    Path(f"{APP_DIR}/probe.mjs").write_text(GPU_PROBE)
    r = sh(f"cd {APP_DIR} && node probe.mjs {gl}")
    renderer = r.stdout.strip()
    print(renderer, r.stderr[-300:], flush=True)
    t1 = time.time()
    # the scripts take: <clip args...> <playwright> <outdir> [baseUrl]; lib.mjs picks the GL backend from GL_BACKEND
    cmd = ["node", f"scripts/promo-v2/{clip}.mjs", *args, "playwright", out, "http://127.0.0.1:5173"]
    e = dict(os.environ, **(env or {}), CC_GL=gl)
    p = subprocess.run(cmd, cwd=APP_DIR, env=e, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(p.stdout[-4000:], flush=True)
    t2 = time.time()
    vite.terminate()
    info = {"clip": clip, "args": args, "renderer": renderer, "exit": p.returncode, "startup_s": round(t1 - t0, 1), "capture_s": round(t2 - t1, 1), "gpu": sh("nvidia-smi -L").stdout.strip()[:60]}
    Path(out).mkdir(parents=True, exist_ok=True)
    Path(f"{out}/modal-run.json").write_text(json.dumps(info, indent=2))
    frames_vol.commit()
    if p.returncode != 0:
        raise RuntimeError(f"clip failed: {info}\n{p.stdout[-1500:]}")
    return info


@app.local_entrypoint()
def main(clip: str = "", args: str = "", name: str = "", probe_only: int = 0, gl: str = GL_ARGS, env: str = ""):
    if probe_only:
        print(json.dumps(probe.remote(), indent=2))
        return
    name = name or (clip if not args else f"{clip}-{args.replace(' ', '')}")
    extra = dict(kv.split("=", 1) for kv in env.split(",") if kv)
    info = film.remote(clip, args.split(), name, gl, extra)
    print(json.dumps(info, indent=2))
    dest = ROOT.parent / "conquercourse-assets" / "promo-v2b-modal"
    dest.mkdir(parents=True, exist_ok=True)
    subprocess.run(["modal", "volume", "get", "--force", "promo-frames", name, str(dest)], check=True)
    print("downloaded to", dest / name)
