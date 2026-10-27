"""Meta Model API calls that look at pictures: the adult check and the move scan.

Every picture sent here has had faces pixelated first (done on Modal before anything else sees a frame). Nothing here saves a picture."""
import base64
import json
import os
import re
import time
import urllib.request

# prices from docs/research/meta-rules-api.md: muse-spark-1.3, USD per million tokens
PRICE_IN, PRICE_OUT = 1.25, 4.25


def _env():
    base = os.environ.get("META_BASE_URL", "https://api.meta.ai/v1")
    key = os.environ.get("META_API_KEY")
    model = os.environ.get("META_MODEL", "muse-spark-1.3")
    if not key:
        raise RuntimeError("META_API_KEY is not set (load ~/.config/ninja/meta.env first)")
    return base, key, model


def chat(images_jpeg, text, schema=None, max_tokens=20000, effort="low", timeout=300):
    """One chat call with images (JPEG bytes) and text; returns (text, usage). `schema` asks for constrained JSON."""
    base, key, model = _env()
    content = [{"type": "text", "text": text}] + [
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b).decode()}} for b in images_jpeg]
    body = {"model": model, "messages": [{"role": "user", "content": content}], "max_tokens": max_tokens, "temperature": 0.2, "reasoning_effort": effort}
    if schema:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "answer", "schema": schema}}
    req = urllib.request.Request(base + "/chat/completions", json.dumps(body).encode(), {"content-type": "application/json", "authorization": f"Bearer {key}"})
    t0 = time.time()
    out = json.load(urllib.request.urlopen(req, timeout=timeout))
    usage = dict(out.get("usage") or {}, seconds=round(time.time() - t0, 1), model=model)
    return out["choices"][0]["message"]["content"], usage


def cost_usd(usage):
    return round((usage.get("prompt_tokens", 0) * PRICE_IN + usage.get("completion_tokens", 0) * PRICE_OUT) / 1e6, 4)


def parse_json(text):
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0)) if m else None


ADULT_SCHEMA = {"type": "object", "required": ["all_adults", "children_seen", "people", "reasons"], "additionalProperties": False,
                "properties": {"all_adults": {"enum": ["yes", "no", "unsure"]}, "children_seen": {"type": "boolean"},
                               "people": {"type": "integer"}, "reasons": {"type": "array", "items": {"type": "string"}}}}

ADULT_PROMPT = """You are a safety check before a video is analysed. The pictures are sample frames from one video; faces are pixelated on purpose.
Title: {title}
Channel: {uploader}
Description: {description}

Decide whether EVERY person who moves or competes in these frames is an adult. Use body size and proportions, the size of the equipment and course, clothing, signs and the text above.
Answer all_adults = "yes" only if you are confident everyone is an adult; "no" if any person looks like a child or young teenager; "unsure" if you cannot tell.
children_seen = true if any child may be present, even in the background. people = how many different people you can see. reasons = at most four short reasons."""


def verdict_from(answer):
    """Only a clear 'yes' with no child seen passes; anything else (including a missing answer) skips the segment."""
    ok = bool(answer) and answer.get("all_adults") == "yes" and not answer.get("children_seen", True)
    return {"pass": ok, "answer": answer}


def adult_check(frames_jpeg, info):
    text = ADULT_PROMPT.format(title=info.get("title"), uploader=info.get("uploader") or info.get("channel"), description=(info.get("description") or "")[:1200])
    raw, usage = chat(frames_jpeg, text, ADULT_SCHEMA)
    try:
        answer = parse_json(raw)
    except Exception:
        answer = None
    v = verdict_from(answer)
    v.update(usage=usage, usd=cost_usd(usage), frames_sent=len(frames_jpeg))
    return v


SCAN_SCHEMA = {"type": "object", "required": ["segments"], "additionalProperties": False, "properties": {"segments": {"type": "array", "items": {
    "type": "object", "required": ["start_s", "end_s", "obstacle", "move", "side_view", "note"], "additionalProperties": False,
    "properties": {"start_s": {"type": "number"}, "end_s": {"type": "number"}, "obstacle": {"type": "string"}, "move": {"type": "string"},
                   "side_view": {"type": "boolean"}, "note": {"type": "string"}}}}}}

SCAN_PROMPT = """These are frames from a ninja-warrior style video, in time order, each labelled with its time in seconds in the top-left corner (faces are pixelated on purpose).
List every stretch where a person attempts an obstacle. For each: start_s and end_s (seconds, from the labels), the obstacle in plain words (for example warped wall, salmon ladder, rope swing, balance steps, gap jump, ledge, floating steps, slider), the move in plain words, whether the camera sees it from the side, and one short note.
Only use what you can see; if the labels do not let you tell the times, say so in the note. Return an empty list if no obstacle is attempted."""


def scan_sheet(frames_jpeg, info=None):
    raw, usage = chat(frames_jpeg, SCAN_PROMPT, SCAN_SCHEMA)
    try:
        segs = (parse_json(raw) or {}).get("segments", [])
    except Exception:
        segs = []
    return {"segments": segs, "usage": usage, "usd": cost_usd(usage)}
