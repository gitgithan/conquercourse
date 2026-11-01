# Client for the deployed app (modal deploy modal_s5s11.py): start a job and poll it in short calls, because one long stream drops on this network.
# usage: python3 run_s5s11.py <s11|s5a|s5b> <spec.json> <name>      then:  modal volume get cc-film-s5s11-out <name>.mp4 <path>
import modal, sys, json, time
what, spec, name = sys.argv[1:4]
S = json.load(open(spec))
fn = modal.Function.from_name("cc-film-s11", "s11" if what == "s11" else "s5")
call = fn.spawn(S, name) if what == "s11" else fn.spawn("shot5.mjs" if what == "s5b" else "grec.mjs", S, name)
print("spawned", call.object_id, flush=True)
while True:
    try: call.get(timeout=20); print("done", name); break
    except TimeoutError: pass
    except Exception as e: print("poll", type(e).__name__, str(e)[:100], flush=True); time.sleep(5)
