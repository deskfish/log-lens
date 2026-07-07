CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  node_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  total_lines INTEGER NOT NULL DEFAULT 0,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  source_file_id TEXT NOT NULL,
  timestamp_ms INTEGER,
  level TEXT NOT NULL DEFAULT 'UNKNOWN',
  service_name TEXT NOT NULL,
  node_name TEXT NOT NULL,
  message TEXT NOT NULL,
  raw TEXT NOT NULL,
  line_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_log_session_time ON log_entries(session_id, timestamp_ms, id);
CREATE INDEX IF NOT EXISTS idx_log_session_level ON log_entries(session_id, level);
CREATE INDEX IF NOT EXISTS idx_log_session_service ON log_entries(session_id, service_name, node_name);

CREATE VIRTUAL TABLE IF NOT EXISTS log_entries_fts USING fts5(
  message,
  raw,
  content='log_entries',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS time_buckets (
  session_id TEXT NOT NULL,
  bucket_start_ms INTEGER NOT NULL,
  bucket_size_ms INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, bucket_start_ms, bucket_size_ms)
);

CREATE TABLE IF NOT EXISTS upload_chunks (
  session_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  PRIMARY KEY (session_id, file_id, chunk_index)
);
