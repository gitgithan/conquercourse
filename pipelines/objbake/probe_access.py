"""CPU probe (no GPU): can the existing `sam-hf` account already read the gated weights TRELLIS.2 and Pixal3D load?
It only asks Hugging Face for the file list; it downloads nothing, accepts nothing and creates nothing."""
import modal

app = modal.App("cc-objbake-probe")
image = modal.Image.debian_slim(python_version="3.11").pip_install("huggingface_hub")


@app.function(image=image, secrets=[modal.Secret.from_name("sam-hf")], timeout=120)
def probe():
    import os

    from huggingface_hub import HfApi

    api, out = HfApi(token=os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")), {}
    for repo in ["microsoft/TRELLIS.2-4B", "microsoft/TRELLIS-image-large", "TencentARC/Pixal3D",
                 "facebook/dinov3-vitl16-pretrain-lvd1689m", "briaai/RMBG-2.0",
                 "tencent/Hunyuan3D-2.1", "stabilityai/stable-fast-3d"]:
        try:
            files = [s.rfilename for s in api.model_info(repo, files_metadata=False).siblings]
            # model_info lists names even for gated repos; a metadata request on one file shows real access
            from huggingface_hub import get_hf_file_metadata, hf_hub_url
            f = next((x for x in files if x.endswith(".json") or x.endswith(".safetensors")), files[0])
            m = get_hf_file_metadata(hf_hub_url(repo, f), token=api.token)
            out[repo] = {"access": "yes", "files": len(files), "checked": f, "size": m.size}
        except Exception as e:  # gated or missing
            out[repo] = {"access": "no", "error": type(e).__name__ + ": " + str(e)[:160]}
    return out


@app.local_entrypoint()
def main():
    import json
    print(json.dumps(probe.remote(), indent=1))
