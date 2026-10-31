-- CC-247: finished pieces and wallpapers that a player chose to share in Community.
-- owner is a one-way code of the browser's random session id (functions/_lib/player.ts); no address, name or email is kept.
-- status: 'pending' (only the owner sees it), 'approved' (everyone sees it), 'removed' (the owner deleted it; the files are emptied).
-- Not for production until the product owner says yes. Preview only: wrangler d1 execute conquercourse-preview --remote --file migrations/0014_community_items.sql
-- Undo: DROP TABLE community_items.
CREATE TABLE IF NOT EXISTS community_items (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('piece', 'wallpaper')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
  created_at INTEGER NOT NULL,
  removed_at INTEGER,
  thumb TEXT NOT NULL DEFAULT '',
  glb TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  moderation TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS community_items_owner ON community_items (owner, status, created_at);
CREATE INDEX IF NOT EXISTS community_items_public ON community_items (status, created_at);
