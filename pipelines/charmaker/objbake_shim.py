"""One import point for the bake helpers (pipelines/ccpipe/objbake.py), so a test can run with or without the repo's pipelines folder on the path."""
import os, sys
_here = os.path.dirname(os.path.abspath(__file__))
_pipes = os.path.join(_here, "..")
if _pipes not in sys.path:
    sys.path.insert(0, _pipes)
from ccpipe.objbake import decimate, unwrap, bake_texture, bake_textured  # noqa: E402,F401
