-- Skema awal Alip Workspace (lihat bagian 8 bible). Waktu disimpan sebagai ISO-8601 UTC.
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT NOT NULL, color TEXT, icon TEXT, sort_order INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru','proses','menunggu','selesai')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('rendah','normal','tinggi','urgent')),
  due_at TEXT, waiting_since TEXT, last_touched_at TEXT, completed_at TEXT,
  resume_note TEXT, recurrence_rule TEXT, template_id TEXT, source_inbox_item_id TEXT
);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE TABLE subtasks (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT NOT NULL, partition_id TEXT NOT NULL UNIQUE,
  service TEXT NOT NULL DEFAULT 'generic' CHECK (service IN ('whatsapp','telegram','gmail','outlook','zimbra','sunfish','support','kiro','generic')),
  home_url TEXT, keep_alive INTEGER NOT NULL DEFAULT 0, native_only INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE task_resources (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('url','whatsapp','telegram','email','ticket','file','folder','launcher','tool')),
  title TEXT NOT NULL, target TEXT, profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  launcher_app TEXT, meta_json TEXT
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, content_md TEXT NOT NULL DEFAULT ''
);
CREATE TABLE time_entries (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL, ended_at TEXT, duration_seconds INTEGER, note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  synced_to_sunfish INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_started ON time_entries(started_at);
CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  source TEXT NOT NULL CHECK (source IN ('whatsapp','telegram','email','ticket','manual')),
  sender TEXT, preview TEXT, received_at TEXT,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru','ditunda','dijadikan_task','diabaikan')),
  linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL, snooze_until TEXT
);
CREATE TABLE snippets (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  title TEXT NOT NULL, body TEXT NOT NULL, variables_json TEXT
);
CREATE TABLE task_templates (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT NOT NULL, subtasks_json TEXT, resources_json TEXT, recurrence_rule TEXT
);
CREATE TABLE tools (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  tool_id TEXT NOT NULL UNIQUE, manifest_json TEXT NOT NULL, install_path TEXT,
  enabled INTEGER NOT NULL DEFAULT 1, dock_slot TEXT
);
CREATE TABLE layout (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  slot_id TEXT NOT NULL UNIQUE, tool_id TEXT, size INTEGER
);
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE, type TEXT NOT NULL, payload_json TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_activity_task ON activity_log(task_id);
CREATE TABLE settings (
  key TEXT PRIMARY KEY, value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
