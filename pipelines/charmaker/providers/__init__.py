"""Providers. `PROVIDERS` is the registry the CLI and the Modal job read; add a provider by adding it here (docs/character-pipeline.md, "Add a provider")."""
from .tripo import TripoMaker
from .route_a import RouteAMaker

PROVIDERS = {"route-a": RouteAMaker, "tripo": TripoMaker}
