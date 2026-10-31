-- Community characters (CC-108): the packaged 34-bone characters players make, and the jobs that make them.
-- `kind` lets the shared "Latest creations" panel keep objects and characters in one table ('character' today; the object gallery may use 'object').
-- `owner` is a one-way player code (never an address). `glb` and `thumb` are base64 text, the way community photos are stored; move the glb to R2 when the count passes about 500.
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'character',
  status TEXT NOT NULL DEFAULT 'ok',
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  route TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  faces INTEGER NOT NULL,
  thumb TEXT NOT NULL,
  glb TEXT NOT NULL,
  picks INTEGER NOT NULL DEFAULT 0,
  last_pick TEXT,
  reports INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS characters_latest ON characters (kind, status, ts);
CREATE INDEX IF NOT EXISTS characters_owner ON characters (owner);
CREATE INDEX IF NOT EXISTS characters_prompt ON characters (prompt_key);
-- One row per started job: who started it (only they may ask about it), the day of the slot, and whether the slot was already settled.
-- `state` moves running -> done | refunded exactly once, by a conditional update, so asking again can never give a slot back twice.
CREATE TABLE IF NOT EXISTS character_jobs (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  owner TEXT NOT NULL,
  day TEXT NOT NULL,
  provider TEXT NOT NULL,
  prompt TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'running'
);
