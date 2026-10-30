"""Resumable Modal calls (CC-221): spawn once, write the call id to a file, poll in short steps.

A long .remote() call dies when the laptop link drops (StreamTerminatedError, seen 2026-10-30).
A spawned call keeps running on Modal, so a dropped link only costs one short poll.
"""
import json
import os
import time


def wait(get, what, give_up_s=2400, sleep=5, log=print, clock=time.time, nap=time.sleep):
    """Call get() until it returns. `get` raises TimeoutError while the job runs, and any other error when the link drops."""
    t0 = clock()
    while True:
        try:
            return get()
        except TimeoutError:
            pass
        except Exception as e:  # noqa: BLE001 (connection lost, SSL closed)
            log(f"[calls] {what}: {type(e).__name__}, polling again")
            nap(sleep)
        if clock() - t0 > give_up_s:
            raise RuntimeError(f"{what}: no answer in {give_up_s} s")


def load_ledger(path):
    return json.load(open(path)) if os.path.exists(path) else {}


def save_ledger(path, ledger):
    tmp = path + ".tmp"
    json.dump(ledger, open(tmp, "w"), indent=2)
    os.replace(tmp, path)


def spawn_once(ledger, path, key, stage, spawn, tries=4, nap=time.sleep):
    """Spawn `stage` for `key` unless the ledger already holds its call id; return the id. Retries a dropped link."""
    have = ledger.setdefault(key, {})
    if stage in have:
        return have[stage]
    for i in range(tries):
        try:
            have[stage] = spawn().object_id
            save_ledger(path, ledger)
            return have[stage]
        except Exception as e:  # noqa: BLE001
            print(f"[calls] spawn {key}/{stage}: {type(e).__name__}, try {i + 1} of {tries}")
            if i == tries - 1:
                raise
            nap(5)
