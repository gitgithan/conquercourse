"""CC-54: draw the key poses, find the body with MediaPipe Pose on a Modal CPU (the laptop lacks the GL library), save the pictures and findings.
Run: modal run pipelines/posekimodo/mediapipe_step.py --out data/eval/pose-kimodo/inputs/pictures"""
import os

import modal

HERE = os.path.dirname(os.path.abspath(__file__))
app = modal.App("cc54-mediapipe")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgles2", "libegl1", "libgl1", "libglib2.0-0", "curl")
    .pip_install("mediapipe", "numpy", "opencv-python-headless")
    .run_commands("curl -sSL -o /pose.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task")
    .add_local_dir(os.path.join(HERE, ".."), "/app/pipelines", ignore=["__pycache__", "tests", "*.mp4"])
)


@app.function(image=image, timeout=600)
def run():
    import sys

    sys.path.insert(0, "/app/pipelines/posekimodo")
    sys.path.insert(0, "/app/pipelines")
    import pictures

    pictures.main("/pose.task", "/out")
    files = {}
    for f in sorted(os.listdir("/out")):
        files[f] = open(os.path.join("/out", f), "rb").read()
    return files


@app.local_entrypoint()
def main(out: str = "data/eval/pose-kimodo/inputs/pictures"):
    os.makedirs(out, exist_ok=True)
    for name, data in run.remote().items():
        with open(os.path.join(out, name), "wb") as f:
            f.write(data)
    print("saved", out)
