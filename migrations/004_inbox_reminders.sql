-- Fase 4: inbox manual + pengingat.
-- Nomor tiket (#1234) dan tautan pertama disimpan agar bisa ditampilkan/dibuka tanpa mem-parse ulang.
ALTER TABLE inbox_items ADD COLUMN ticket_ref TEXT;
ALTER TABLE inbox_items ADD COLUMN url TEXT;
-- Pengingat bisa dibisukan per task (bible 9.11).
ALTER TABLE tasks ADD COLUMN remind_muted INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks (status, due_at);
