"""Cut a clip into frames by frame number and write each frame's own time.

Usage: python3 cut_frames.py CLIP.mp4 OUT_DIR [LONG_SIDE]
Writes OUT_DIR/f00000.jpg ... and OUT_DIR/times.json (seconds, from the video's own timestamps).
Refuses a clip whose average rate differs from its nominal rate (not constant frame rate).
"""
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate,avg_frame_rate", "-of", "json", str(path)],
        check=True, capture_output=True, text=True).stdout
    return json.loads(out)["streams"][0]


def frame_times(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "frame=best_effort_timestamp_time", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True).stdout
    return [float(x.strip(",")) for x in out.split() if x.strip(",")]


def main(clip, out_dir, long_side=1920):
    clip, out_dir = Path(clip), Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    s = probe(clip)
    r, a = Fraction(s["r_frame_rate"]), Fraction(s["avg_frame_rate"])
    if r != a:
        raise SystemExit(f"refused: not constant frame rate ({r} vs {a})")
    scale = f"scale='if(gte(iw,ih),{long_side},-2)':'if(gte(iw,ih),-2,{long_side})'"
    # ffmpeg 5.1 and newer call it -fps_mode; 4.x (the laptop's) only knows -vsync; both keep every frame
    old = b"fps_mode" not in subprocess.run(["ffmpeg", "-h", "full"], capture_output=True).stdout
    keep = ["-vsync", "passthrough"] if old else ["-fps_mode", "passthrough"]
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(clip), "-vf", scale, *keep,
         "-q:v", "2", "-start_number", "0", str(out_dir / "f%05d.jpg")], check=True)
    times = frame_times(clip)
    n = len(list(out_dir.glob("f*.jpg")))
    assert n == len(times), (n, len(times))
    (out_dir / "times.json").write_text(json.dumps(
        {"fps": float(a), "fps_exact": str(a), "n": n, "times": times,
         "source_size": [s["width"], s["height"]]}))
    print(clip.name, n, "frames", float(a), "fps")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1920)
