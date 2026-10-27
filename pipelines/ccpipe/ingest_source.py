"""Getting a video in safely: licence check, text screen for minors, download, cut, checksums.

Videos stay outside git (../conquercourse-assets/video/<id>/ with SHA256SUMS); only the record of where they came from goes in the repo."""
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ALLOWED_LICENCE = re.compile(r"creative commons attribution(?!.*(non|share|no ?deriv))|\bcc[ -]?by\b(?![ -]?(nc|nd|sa))|\bcc0\b|public domain dedication", re.I)
MINOR_WORDS = re.compile(r"\b(kids?|child(ren)?|junior|juniors|youth|teens?|teenagers?|boys?|girls?|toddlers?|minors?|u1[0-8]|under[- ]1[0-8]|school(boy|girl|children)?|primary school|age group)\b", re.I)


class Refused(Exception):
    """The ingest stops here and says why; nothing after this point runs."""


def check_licence(info):
    """YouTube marks reusable videos 'Creative Commons Attribution license (reuse allowed)' (CC BY). Anything else is refused."""
    lic = (info.get("license") or "").strip()
    if not lic or not ALLOWED_LICENCE.search(lic):
        raise Refused(f"licence is {lic or 'not a Creative Commons licence (the standard licence)'!r}: only CC BY and CC0 videos are ingested")
    return lic


def screen_text_for_minors(info):
    """Words in the title, description, tags or channel that point at children. A hit stops the ingest; there is no override."""
    parts = [info.get("title"), info.get("description"), info.get("uploader"), info.get("channel")] + list(info.get("tags") or [])
    hits = sorted({m.group(0).lower() for t in parts if t for m in MINOR_WORDS.finditer(t)})
    return hits


def source_record(info, url, start, end):
    return {"url": url, "id": info.get("id"), "title": info.get("title"), "uploader": info.get("uploader") or info.get("channel"),
            "licence": info.get("license"), "duration_s": info.get("duration"), "size": [info.get("width"), info.get("height")],
            "fps": info.get("fps"), "upload_date": info.get("upload_date"), "range_s": [start, end], "fetched": time.strftime("%Y-%m-%d")}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_sums(folder):
    folder = Path(folder)
    lines = [f"{sha256(p)}  {p.name}" for p in sorted(folder.iterdir()) if p.is_file() and p.name != "SHA256SUMS"]
    (folder / "SHA256SUMS").write_text("\n".join(lines) + "\n")


def ytdlp(*args):
    # No login and no cookies, ever: a personal cookie file must never reach this repo or a server.
    cmd = [sys.executable, "-m", "yt_dlp", "--js-runtimes", "node", *args]
    return subprocess.run(cmd, capture_output=True, text=True)


def fetch_info(url):
    r = ytdlp("--skip-download", "--dump-single-json", url)
    if r.returncode != 0:
        raise Refused("could not read the video's details: " + (r.stderr.strip().splitlines() or ["unknown error"])[-1][:300])
    return json.loads(r.stdout)


def download(url, folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    r = ytdlp("-f", "bv*[height<=1920]+ba/b[height<=1920]/b", "--merge-output-format", "mp4", "-o", str(folder / "source.%(ext)s"), url)
    if r.returncode != 0:
        raise Refused("download failed: " + (r.stderr.strip().splitlines() or ["unknown error"])[-1][:300])
    return folder / "source.mp4"


def cut(src, start, end, dst, fps=None):
    """Cut [start, end] seconds into a constant-frame-rate H.264 file (the frame cutter refuses variable rate)."""
    assert end > start >= 0, "end must be after start"
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-to", str(end), "-i", str(src), "-an", "-c:v", "libx264", "-crf", "16",
           "-preset", "fast", "-pix_fmt", "yuv420p", *(["-r", str(fps)] if fps else ["-fps_mode", "cfr"]), str(dst)]
    subprocess.run(cmd, check=True)
    return dst
