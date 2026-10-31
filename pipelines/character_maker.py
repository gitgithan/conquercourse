"""The character maker as a Modal web app (CC-108): the site's server calls `submit` and then `status`, the way it does for the photo-to-object lift.

  modal deploy pipelines/character_maker.py        # needs the Modal secret `cc-char` (META_API_KEY, META_BASE_URL, CC_CHAR_TOKEN); see docs/character-pipeline.md

`submit` takes {token, prompt}, starts a job and returns {id}; `status` takes {token, id} and returns {state: running, stage, attempt} |
{state: done, glb, thumb, meta} (both base64) | {state: failed, reason, refund}. The job runs charmaker.maker.run (route A) and keeps nothing: the picture
and the cut-out live in memory for the job. The 3D lift is the GPU class in the app `cc-photo-to-object` (deployed separately). Status: written, not deployed
(creating the secret needs the owner's approval). """
import base64
import os
import time

import modal

app = modal.App("cc-character-maker")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("numpy<2", "scipy", "pillow", "xatlas==0.0.9", "fast-simplification", "fastapi[standard]", "meta-sam-parser")
    .add_local_python_source("ccpipe", "charmaker")
    .add_local_file(os.path.join(os.path.dirname(__file__), "..", "public", "assets", "characters", "rookie-a.glb"), "/assets/rookie-a.glb")
)
secrets = [modal.Secret.from_name("cc-char")]
stages = modal.Dict.from_name("cc-char-stages", create_if_missing=True)


def _put(call_id, **kw):
    try:
        stages.put(call_id, {**kw, "at": round(time.time(), 1)})
    except Exception:  # noqa: BLE001  a failed note never stops a job
        pass


@app.function(image=image, timeout=1500, secrets=secrets)
def make_job(prompt: str, seed: int = 42) -> dict:
    os.environ.setdefault("CC_ROOKIE_GLB", "/assets/rookie-a.glb")
    from charmaker import maker
    from charmaker.contracts import Request
    from charmaker.providers import PROVIDERS
    cid = modal.current_function_call_id()
    try:
        r = maker.run(PROVIDERS["route-a"](), Request(prompt=prompt, seed=seed), progress=lambda s, i: _put(cid, stage=s, attempt=i.get("attempt", 1)))
    except maker.Failed as e:
        return {"state": "failed", "reason": e.why[:200], "refund": e.refund}
    meta = {k: v for k, v in r.package.meta.items() if k != "owner"}
    meta.update(route=r.route, faces=r.package.meta.get("faces", 0), notes=r.notes)
    return {"state": "done", "glb": base64.b64encode(r.package.glb).decode(), "thumb": base64.b64encode(r.package.thumb_webp).decode(), "meta": meta}


def _ok(token):
    import hmac
    want = os.environ.get("CC_CHAR_TOKEN", "")
    return bool(want) and hmac.compare_digest(str(token or ""), want)


@app.function(image=image, secrets=secrets)
@modal.fastapi_endpoint(method="POST")
def submit(item: dict):
    if not _ok(item.get("token")):
        return {"error": "not allowed"}
    prompt = str(item.get("prompt") or "")[:140]
    if len(prompt) < 3:
        return {"error": "bad prompt"}
    return {"id": make_job.spawn(prompt).object_id}


@app.function(image=image, secrets=secrets)
@modal.fastapi_endpoint(method="POST")
def status(item: dict):
    from modal.functions import FunctionCall
    if not _ok(item.get("token")):
        return {"state": "failed", "reason": "not allowed", "refund": False}
    cid = str(item.get("id") or "")
    try:
        return FunctionCall.from_id(cid).get(timeout=0)
    except TimeoutError:
        try:
            got = stages.get(cid) or {}
        except Exception:  # noqa: BLE001
            got = {}
        return {"state": "running", "stage": got.get("stage"), "attempt": got.get("attempt", 1)}
    except Exception as e:  # noqa: BLE001
        return {"state": "failed", "reason": f"the maker stopped ({type(e).__name__})", "refund": True}
