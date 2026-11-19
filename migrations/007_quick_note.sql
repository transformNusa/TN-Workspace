-- 007: catatan cepat (tool bawaan "Catatan") — satu textarea yang tersimpan di app.
CREATE TABLE IF NOT EXISTS quick_notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
