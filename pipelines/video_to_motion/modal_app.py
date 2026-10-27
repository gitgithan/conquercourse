"""Modal app for video to motion: privacy masking, SAM 3D Body, MHR to SOMA-X.

Run from a laptop or VM with a Modal token; weights come from the `sam-checkpoints`
(read-only use) and `hf-cache` volumes; the Hugging Face token comes from the `sam-hf` secret.
Raw frames are processed in memory; only masked images, a receipt and numbers come back.
"""
import io
import time

import modal

APP = "cc-video-to-motion"
CK = "/ck"
SAM3_CKPT = f"{CK}/hf/sam3/sam3.pt"
BODY_DIR = f"{CK}/body/sam-3d-body-dinov3"

app = modal.App(APP)
ck_vol = modal.Volume.from_name("sam-checkpoints")
hf_vol = modal.Volume.from_name("hf-cache")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0", "build-essential")
    .pip_install("torch==2.10.0", "torchvision", index_url="https://download.pytorch.org/whl/cu128")
    .pip_install(
        "numpy<2", "scipy", "opencv-python-headless", "pillow", "timm>=1.0.17", "einops", "ftfy==6.1.1",
        "regex", "iopath", "huggingface_hub", "pytorch-lightning", "yacs", "scikit-image", "dill", "pandas",
        "rich", "hydra-core", "pyrootutils", "networkx==3.2.1", "roma", "joblib", "loguru", "optree",
        "fvcore", "pycocotools", "trimesh", "warp-lang", "psutil", "decord", "tqdm", "cholespy", "rtree",
        "usd-core",
    )
    .run_commands(
        "git clone --depth 1 https://github.com/facebookresearch/sam3 /opt/sam3 && pip install --no-deps -e /opt/sam3",
        "git clone --depth 1 https://github.com/facebookresearch/sam-3d-body /opt/sam-3d-body",
        "pip install --no-deps py-soma-x",
        "pip install git+https://github.com/microsoft/MoGe.git",
        "pip install 'numpy<2' braceexpand omegaconf pyrender wandb webdataset jsonlines appdirs",
    )
    .env({"HF_HOME": "/hf", "PYTHONPATH": "/opt/sam-3d-body", "SAM3D_MHR_PATH": f"{BODY_DIR}/assets/mhr_model.pt"})
)

PERSON_T, FACE_T, PLATE_T = 0.5, 0.4, 0.4


def _jpeg(arr_rgb, q=92):
    from PIL import Image
    b = io.BytesIO()
    Image.fromarray(arr_rgb).save(b, "JPEG", quality=q)
    return b.getvalue()


@app.cls(
    gpu="L4", image=image, volumes={CK: ck_vol, "/hf": hf_vol}, secrets=[modal.Secret.from_name("sam-hf")],
    timeout=3 * 3600, max_containers=3, scaledown_window=120,
)
class Worker:
    @modal.enter()
    def load(self):
        import torch
        t0 = time.time()
        self.torch = torch
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor
        self.sam3 = Sam3Processor(
            build_sam3_image_model(checkpoint_path=SAM3_CKPT, load_from_HF=False), confidence_threshold=0.3)
        from sam_3d_body import load_sam_3d_body, SAM3DBodyEstimator
        model, cfg = load_sam_3d_body(f"{BODY_DIR}/model.ckpt", device="cuda", mhr_path=f"{BODY_DIR}/assets/mhr_model.pt")
        self.body = SAM3DBodyEstimator(sam_3d_body_model=model, model_cfg=cfg)
        self.moge = None
        self.load_s = time.time() - t0

    # ---------- privacy ----------
    def _detect(self, img_rgb):
        """Return {'person': [(mask, box, score)], 'face': [...], 'license plate': [...]}"""
        from PIL import Image
        state = self.sam3.set_image(Image.fromarray(img_rgb))
        out = {}
        for prompt, thr in (("person", PERSON_T), ("face", FACE_T), ("license plate", PLATE_T)):
            self.sam3.reset_all_prompts(state)
            st = self.sam3.set_text_prompt(state=state, prompt=prompt)
            masks, boxes, scores = st["masks"], st["boxes"], st["scores"]
            items = []
            for m, b, s in zip(masks, boxes, scores):
                if float(s) >= thr:
                    items.append((m.squeeze().cpu().numpy().astype(bool), b.cpu().numpy(), float(s)))
            out[prompt] = items
        return out

    @staticmethod
    def _grow(mask, px):
        import cv2
        import numpy as np
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
        return cv2.dilate(mask.astype(np.uint8), k).astype(bool)

    @staticmethod
    def _pixelate(img, mask, block):
        import cv2
        h, w = mask.shape
        small = cv2.resize(img, (max(1, w // block), max(1, h // block)), interpolation=cv2.INTER_AREA)
        pix = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
        img = img.copy()
        img[mask] = pix[mask]
        return img

    def _mask_faces(self, img, det):
        import numpy as np
        h, w = img.shape[:2]
        grow = max(3, round(0.004 * max(h, w)))
        out = img
        for key in ("face", "license plate"):
            for m, b, _ in det[key]:
                bw = max(8, int(b[2] - b[0]))
                out = self._pixelate(out, self._grow(m, grow), max(8, bw // 6))
        return out

    def _blur_people(self, img, det):
        import cv2
        import numpy as np
        h, w = img.shape[:2]
        grow = max(4, round(0.008 * max(h, w)))
        sigma = max(8, 0.02 * max(h, w))
        pm = np.zeros((h, w), bool)
        for m, _, _ in det["person"]:
            pm |= self._grow(m, grow)
        blur = cv2.GaussianBlur(img, (0, 0), sigma)
        out = img.copy()
        out[pm] = blur[pm]
        for key in ("face", "license plate"):  # faces and plates are pixelated on top
            for m, b, _ in det[key]:
                out = self._pixelate(out, self._grow(m, grow), max(8, int(b[2] - b[0]) // 6))
        return out, pm

    # ---------- camera ----------
    @modal.method()
    def estimate_focal(self, frames_jpeg):
        """Median vertical focal length (px) over some frames, with MoGe 2; None if it cannot run."""
        import cv2
        import numpy as np
        try:
            from moge.model.v2 import MoGeModel
            if self.moge is None:
                self.moge = MoGeModel.from_pretrained("Ruicheng/moge-2-vitl-normal").to("cuda").eval()
                hf_vol.commit()
            fs = []
            for fj in frames_jpeg:
                im = cv2.cvtColor(cv2.imdecode(np.frombuffer(fj, np.uint8), 1), cv2.COLOR_BGR2RGB)
                h, w = im.shape[:2]
                t = self.torch.tensor(im / 255, dtype=self.torch.float32, device="cuda").permute(2, 0, 1)
                k = self.moge.infer(t)["intrinsics"].cpu().numpy()
                fs.append(float(k[1, 1] * h))
            return {"focal_px": float(np.median(fs)), "all": fs, "model": "Ruicheng/moge-2-vitl-normal"}
        except Exception as e:  # report, fall back to SAM 3D Body's own default
            return {"focal_px": None, "error": repr(e)[:500]}

    # ---------- faces masked, nothing else (for the adult check and the scan) ----------
    @modal.method()
    def mask_for_review(self, frames_jpeg, blur_people=False):
        """Faces and plates pixelated first; with blur_people the whole person is blurred as well. Returns JPEGs and receipt rows.

        The adult check needs the body shape (faces masked, people kept); the scan and everything kept in git use blur_people=True."""
        import cv2
        import numpy as np
        torch = self.torch
        t0 = time.time()
        out, receipt = [], []
        for i, fj in enumerate(frames_jpeg):
            img = cv2.cvtColor(cv2.imdecode(np.frombuffer(fj, np.uint8), 1), cv2.COLOR_BGR2RGB)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                det = self._detect(img)
            shown = self._blur_people(img, det)[0] if blur_people else self._mask_faces(img, det)
            out.append(_jpeg(shown))
            receipt.append({"i": i, "people": len(det["person"]), "faces": len(det["face"]), "plates": len(det["license plate"])})
        return {"masked": out, "receipt": receipt, "seconds": time.time() - t0, "load_s": self.load_s}

    # ---------- privacy + measure ----------
    @modal.method()
    def privacy_and_measure(self, frames_jpeg, first_index, focal_px=None, prev_center=None):
        """frames_jpeg: list of raw JPEG bytes. Returns masked JPEGs, receipt rows, per-frame measurements.

        Faces and plates are pixelated first; the body model sees that face-masked image, never the original
        image returned. Returned pictures have people blurred too.
        """
        import cv2
        import numpy as np
        torch = self.torch
        t0 = time.time()
        masked, receipt, measured = [], [], []
        center = prev_center
        for i, fj in enumerate(frames_jpeg):
            idx = first_index + i
            img = cv2.cvtColor(cv2.imdecode(np.frombuffer(fj, np.uint8), 1), cv2.COLOR_BGR2RGB)
            h, w = img.shape[:2]
            with torch.autocast("cuda", dtype=torch.bfloat16):
                det = self._detect(img)
            face_masked = self._mask_faces(img, det)       # step 1: faces and plates
            stored, _ = self._blur_people(img, det)         # what we keep: people blurred as well
            masked.append(_jpeg(stored))
            receipt.append({"frame": idx, "people": len(det["person"]), "faces": len(det["face"]),
                            "plates": len(det["license plate"]),
                            "person_scores": [round(s, 3) for _, _, s in det["person"]],
                            "face_scores": [round(s, 3) for _, _, s in det["face"]]})
            # pick the athlete: biggest person box, nearest the last one when several
            boxes = [b for _, b, _ in det["person"]]
            rec = {"frame": idx, "ok": False}
            if boxes:
                def score(b):
                    area = (b[2] - b[0]) * (b[3] - b[1])
                    if center is None:
                        return area
                    c = np.array([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])
                    return area / (1 + np.linalg.norm(c - center) / max(h, w))
                b = max(boxes, key=score)
                center = np.array([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])
                bw, bh = b[2] - b[0], b[3] - b[1]
                box = np.array([max(0, b[0] - 0.1 * bw), max(0, b[1] - 0.1 * bh),
                                min(w, b[2] + 0.1 * bw), min(h, b[3] + 0.1 * bh)])
                cam = None
                if focal_px:
                    cam = torch.tensor([[[focal_px, 0, w / 2], [0, focal_px, h / 2], [0, 0, 1]]], dtype=torch.float32)
                try:
                    outs = self.body.process_one_image(face_masked, bboxes=box[None], cam_int=cam)
                except Exception as e:
                    outs = []
                    rec["error"] = repr(e)[:300]
                if outs:
                    o = outs[0]
                    rec.update(ok=True, bbox=[float(x) for x in o["bbox"]], focal=float(np.asarray(o["focal_length"]).reshape(-1)[0]),
                               cam_t=np.asarray(o["pred_cam_t"], float).tolist(),
                               kp3d=np.asarray(o["pred_keypoints_3d"], float).tolist(),
                               kp2d=np.asarray(o["pred_keypoints_2d"], float).tolist(),
                               shape=np.asarray(o["shape_params"], float).reshape(-1).tolist(),
                               model_params=np.asarray(o["mhr_model_params"], float).reshape(-1).tolist(),
                               image_wh=[w, h])
            measured.append(rec)
        return {"masked": masked, "receipt": receipt, "measured": measured,
                "last_center": None if center is None else center.tolist(),
                "seconds": time.time() - t0, "load_s": self.load_s}

    # ---------- one adult photo -> body shape (CC-41) ----------
    @modal.method()
    def shape_from_photo(self, photo_jpeg):
        """One photo of one adult. Faces are pixelated first; the body model sees only that masked image.

        Returns numbers only: the 45 MHR shape numbers, the 68 scale numbers, a height estimate and a receipt.
        No picture and no face data leave the container.
        """
        import cv2
        import numpy as np
        torch = self.torch
        img = cv2.cvtColor(cv2.imdecode(np.frombuffer(photo_jpeg, np.uint8), 1), cv2.COLOR_BGR2RGB)
        h, w = img.shape[:2]
        with torch.autocast("cuda", dtype=torch.bfloat16):
            det = self._detect(img)
        receipt = {"people": len(det["person"]), "faces": len(det["face"]), "image_wh": [w, h]}
        if len(det["person"]) != 1:
            return {"ok": False, "reason": f"need exactly one person, found {len(det['person'])}", "receipt": receipt}
        if len(det["face"]) < 1:
            return {"ok": False, "reason": "no face found to mask; refusing to run on an unmasked face", "receipt": receipt}
        face_masked = self._mask_faces(img, det)  # step 1: faces first
        b = det["person"][0][1]
        bw, bh = b[2] - b[0], b[3] - b[1]
        box = np.array([max(0, b[0] - 0.1 * bw), max(0, b[1] - 0.1 * bh), min(w, b[2] + 0.1 * bw), min(h, b[3] + 0.1 * bh)])
        outs = self.body.process_one_image(face_masked, bboxes=box[None])
        if not outs:
            return {"ok": False, "reason": "SAM 3D Body found no body", "receipt": receipt}
        o = outs[0]
        shape = np.asarray(o["shape_params"], float).reshape(-1)
        mp = np.asarray(o["mhr_model_params"], float).reshape(-1)
        mhr = torch.jit.load(f"{BODY_DIR}/assets/mhr_model.pt", map_location="cpu")
        rest = torch.zeros(1, 204)
        rest[0, 136:] = torch.from_numpy(mp[136:]).float()  # body scale numbers, no pose
        with torch.no_grad():
            verts, _ = mhr(torch.from_numpy(shape).float()[None], rest, torch.zeros(1, 72))
        height_m = float((verts[0, :, 1].max() - verts[0, :, 1].min()) / 100.0)
        return {"ok": True, "shape_params": shape.tolist(), "scale_params": mp[136:].tolist(),
                "height_m_estimate": round(height_m, 3), "receipt": receipt}

    # ---------- MHR to SOMA ----------
    @modal.method()
    def mhr_to_soma(self, shape, model_params, ok):
        """shape (N,45), model_params (N,204) lists for the frames with ok; returns SOMA joint positions (m)."""
        import numpy as np
        torch = self.torch
        from soma import SOMALayer
        from soma.fitting.pose_inversion import PoseInversion
        from soma.units import Unit
        t0 = time.time()
        sp = np.asarray(shape, np.float32)
        mp = np.asarray(model_params, np.float32)
        N = len(sp)
        soma = SOMALayer(identity_model_type="mhr", device="cuda", mode="warp", output_unit=Unit.CENTIMETERS)
        inv = PoseInversion(soma, low_lod=False)
        import glob
        mhr_path = glob.glob("/hf/hub/models--nvidia--soma-x/snapshots/*/MHR/mhr_model_lod1.pt")[0]
        mhr = torch.jit.load(mhr_path, map_location="cuda")
        flex = mp[:, 130:136]
        scales = mp[:, 136:]
        rots, trans, errs, joints = [], [], [], []
        bs = 32
        fe = torch.zeros(1, 72, device="cuda")
        for s in range(0, N, bs):
            e = min(N, s + bs)
            ic = torch.from_numpy(sp[s:e]).cuda()
            mpt = torch.from_numpy(mp[s:e]).cuda()
            inv.prepare_identity(ic, torch.from_numpy(scales[s:e]).cuda(),
                                 kwargs={"bone_length_flexibles": torch.from_numpy(flex[s:e]).cuda()})
            with torch.no_grad():
                verts, _ = mhr(ic, mpt, fe.expand(e - s, -1))
            res = inv.fit(verts, body_iters=2, finger_iters=0, full_iters=1, lie_iters=3, lie_lambda=1e-1,
                          autograd_iters=0, leaf_weight=1.0, batch_size=None)
            with torch.no_grad():
                o = soma.pose(res["rotations"][:, 1:].contiguous(), res["root_translation"], absolute_pose=True, fk_only=True, pose2rot=False)
            joints.append(o["joints"].cpu())
            rots.append(res["rotations"].cpu())
            trans.append(res["root_translation"].cpu())
            errs.append(res["per_vertex_error"].cpu())
        rotations = torch.cat(rots)
        root_t = torch.cat(trans)
        err = torch.cat(errs)
        names = list(soma.rig_data["joint_names"])
        return {"joint_names": [str(n) for n in names], "n_rot_joints": int(rotations.shape[1]),
                "root_translation_cm": root_t.numpy().tolist(),
                "vertex_err_cm": {"mean": float(err.mean()), "median": float(err.median()), "max": float(err.max())},
                "joints_cm": torch.cat(joints).numpy().tolist(),
                "seconds": time.time() - t0}


@app.local_entrypoint()
def shape_from_photo(photo: str, out: str):
    """modal run pipelines/video_to_motion/modal_app.py::shape_from_photo --photo p.jpg --out dir/

    Writes dir/shape.json (numbers only, no picture). The photo never leaves the container unmasked and is not copied.
    Then: python tools/mhr_look/retarget.py MHR_MODEL_PT public/assets/characters/rookie-a.glb OUT --shape dir/shape.json --name custom --height-m 1.80
    """
    import json
    from pathlib import Path
    res = Worker().shape_from_photo.remote(Path(photo).read_bytes())
    o = Path(out); o.mkdir(parents=True, exist_ok=True)
    (o / "shape.json").write_text(json.dumps(res, indent=2))
    print({k: v for k, v in res.items() if k not in ("shape_params", "scale_params")})
