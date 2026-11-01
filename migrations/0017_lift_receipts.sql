-- One row per 3D lift job whose piece has been shared (CC-103): a lift's receipt can publish one piece, once.
CREATE TABLE IF NOT EXISTS lift_receipts (
  id TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);
