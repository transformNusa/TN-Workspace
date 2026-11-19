-- Fase 5-6: timesheet, template/berulang, dan tool.
-- template: workspace & prioritas supaya task hasil template tidak selalu kosong.
ALTER TABLE task_templates ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE task_templates ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
-- task berulang: penjaga agar occurrence tidak dibuat dua kali saat status bolak-balik.
ALTER TABLE tasks ADD COLUMN recurrence_parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;
-- resource hasil tool (Image Resizer dsb.) bisa dilampirkan ke task.
ALTER TABLE task_resources ADD COLUMN tool_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON tasks (recurrence_parent_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_ended ON time_entries (ended_at);
