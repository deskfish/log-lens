import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "log-lens.db");
const SCHEMA_PATH = path.join(process.cwd(), "src/lib/db/schema.sql");

let db: Database.Database | null = null;

export function ensureDataDirs() {
  fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDirs();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    db.exec(schema);
  }
  return db;
}

export function getUploadDir(sessionId: string) {
  const dir = path.join(DATA_DIR, "uploads", sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export { DATA_DIR, DB_PATH };
