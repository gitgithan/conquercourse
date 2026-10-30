import json

import pytest

from ccpipe import calls


class Job:
    def __init__(self, i):
        self.object_id = f"fc-{i}"


def test_wait_survives_drops_and_timeouts():
    seq = iter([TimeoutError(), ConnectionError("lost"), TimeoutError(), "answer"])

    def get():
        v = next(seq)
        if isinstance(v, Exception):
            raise v
        return v

    logs = []
    assert calls.wait(get, "lift", log=logs.append, nap=lambda s: None) == "answer"
    assert len(logs) == 1 and "ConnectionError" in logs[0]


def test_wait_gives_up():
    t = iter(range(0, 1000, 100))

    def get():
        raise TimeoutError()

    with pytest.raises(RuntimeError):
        calls.wait(get, "x", give_up_s=250, clock=lambda: next(t), nap=lambda s: None)


def test_spawn_once_writes_id_and_resumes(tmp_path):
    p = str(tmp_path / "calls.json")
    ledger = {}
    n = []

    def spawn():
        n.append(1)
        return Job(len(n))

    assert calls.spawn_once(ledger, p, "a", "mask", spawn) == "fc-1"
    # a fresh process reads the file and does not spawn again
    again = calls.load_ledger(p)
    assert calls.spawn_once(again, p, "a", "mask", spawn) == "fc-1"
    assert len(n) == 1 and json.load(open(p)) == {"a": {"mask": "fc-1"}}


def test_spawn_once_retries_a_stream_drop(tmp_path):
    p = str(tmp_path / "calls.json")
    state = {"n": 0}

    def spawn():
        state["n"] += 1
        if state["n"] < 3:
            raise ConnectionError("StreamTerminatedError")
        return Job(7)

    assert calls.spawn_once({}, p, "a", "lift", spawn, nap=lambda s: None) == "fc-7"
