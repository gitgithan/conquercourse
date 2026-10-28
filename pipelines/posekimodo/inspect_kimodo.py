"""CPU-only look at Kimodo's constraint classes (CC-54): what a key pose can be given as. Run: modal run pipelines/posekimodo/inspect_kimodo.py"""
import modal

KIMODO_COMMIT = "e1c219c99b4b94ba48be1fb6a1cbc64ecee4c954"
app = modal.App("cc54-kimodo-inspect")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "cmake", "build-essential", "libeigen3-dev", "pybind11-dev")
    .pip_install("torch", "numpy")
    .pip_install(f"git+https://github.com/nv-tlabs/kimodo.git@{KIMODO_COMMIT}")
)


@app.function(image=image, timeout=900)
def look():
    import inspect

    import kimodo.constraints as C

    out = {}
    for name, cls in inspect.getmembers(C, inspect.isclass):
        if cls.__module__ == C.__name__:
            try:
                out[name] = {"init": str(inspect.signature(cls.__init__)), "doc": (inspect.getdoc(cls) or "")[:300]}
            except Exception as e:  # noqa: BLE001
                out[name] = {"error": str(e)}
    src = inspect.getsource(C.FullBodyConstraintSet) if hasattr(C, "FullBodyConstraintSet") else ""
    return {"classes": out, "fullbody_source": src[:3500]}


@app.local_entrypoint()
def main():
    import json

    r = look.remote()
    for k, v in r["classes"].items():
        print(k, v)
    print(r["fullbody_source"])
