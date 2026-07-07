import fs from "fs";
import path from "path";
import { createGunzip } from "zlib";
import readline from "readline";
import { getDb } from "@/lib/db/client";
import { parseLogLine } from "@/lib/parser";
import type { IndexProgress } from "@/lib/types";

const BATCH_SIZE = 5000;
const BUCKET_SIZE_MS = 60_000;

const progressMap = new Map<string, IndexProgress>();

export function getIndexProgress(sessionId: string): IndexProgress | null {
  return progressMap.get(sessionId) ?? null;
}

function updateProgress(sessionId: string, patch: Partial<IndexProgress>) {
  const current = progressMap.get(sessionId);
  if (current) progressMap.set(sessionId, { ...current, ...patch });
}

async function openLineStream(filePath: string) {
  const isGz = filePath.endsWith(".gz");
  const input = isGz
    ? fs.createReadStream(filePath).pipe(createGunzip())
    : fs.createReadStream(filePath, { encoding: "utf-8" });

  return readline.createInterface({ input, crlfDelay: Infinity });
}

export async function indexSourceFile(
  sessionId: string,
  sourceFileId: string,
  filePath: string,
  serviceName: string,
  nodeName: string,
) {
  const db = getDb();
  const insertEntry = db.prepare(`
    INSERT INTO log_entries (
      session_id, source_file_id, timestamp_ms, level,
      service_name, node_name, message, raw, line_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO log_entries_fts(rowid, message, raw) VALUES (?, ?, ?)
  `);
  const upsertBucket = db.prepare(`
    INSERT INTO time_buckets (session_id, bucket_start_ms, bucket_size_ms, count, error_count)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(session_id, bucket_start_ms, bucket_size_ms) DO UPDATE SET
      count = count + 1,
      error_count = error_count + excluded.error_count
  `);

  let lastTimestampMs: number | null = null;
  let lineNumber = 0;
  let indexedLines = 0;

  const rl = await openLineStream(filePath);
  const tx = db.transaction((batch: Array<{ lastInsertRowid: number | bigint }>) => {
    for (const row of batch) {
      void row.lastInsertRowid;
    }
  });

  let batch: Array<ReturnType<typeof insertEntry.run>> = [];

  for await (const rawLine of rl) {
    lineNumber += 1;
    const parsed = parseLogLine(rawLine, lastTimestampMs);
    if (parsed.timestampMs !== null) lastTimestampMs = parsed.timestampMs;

    const info = insertEntry.run(
      sessionId,
      sourceFileId,
      parsed.timestampMs,
      parsed.level,
      serviceName,
      nodeName,
      parsed.message || rawLine,
      rawLine,
      lineNumber,
    );
    const rowId = Number(info.lastInsertRowid);
    insertFts.run(rowId, parsed.message || rawLine, rawLine);
    batch.push(info);

    if (parsed.timestampMs !== null) {
      const bucketStart = Math.floor(parsed.timestampMs / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
      upsertBucket.run(
        sessionId,
        bucketStart,
        BUCKET_SIZE_MS,
        parsed.level === "ERROR" ? 1 : 0,
      );
    }

    if (batch.length >= BATCH_SIZE) {
      tx(batch);
      batch = [];
      indexedLines = lineNumber;
      updateProgress(sessionId, { indexedLines, currentFile: path.basename(filePath) });
    }
  }

  if (batch.length > 0) tx(batch);

  db.prepare(
    `UPDATE source_files SET total_lines = ?, parse_status = 'done' WHERE id = ?`,
  ).run(lineNumber, sourceFileId);

  updateProgress(sessionId, { indexedLines: lineNumber });
  return lineNumber;
}

export async function indexSession(sessionId: string) {
  const db = getDb();
  const files = db
    .prepare(`SELECT * FROM source_files WHERE session_id = ? ORDER BY original_name`)
    .all(sessionId) as Array<{
    id: string;
    storage_path: string;
    service_name: string;
    node_name: string;
    original_name: string;
  }>;

  progressMap.set(sessionId, {
    sessionId,
    status: "indexing",
    totalFiles: files.length,
    indexedFiles: 0,
    totalLines: 0,
    indexedLines: 0,
  });

  db.prepare(`UPDATE sessions SET status = 'indexing' WHERE id = ?`).run(sessionId);

  try {
    let totalLines = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      db.prepare(`UPDATE source_files SET parse_status = 'indexing' WHERE id = ?`).run(file.id);
      updateProgress(sessionId, {
        indexedFiles: i,
        currentFile: file.original_name,
      });

      const lines = await indexSourceFile(
        sessionId,
        file.id,
        file.storage_path,
        file.service_name,
        file.node_name,
      );
      totalLines += lines;
      updateProgress(sessionId, { indexedFiles: i + 1, totalLines, indexedLines: totalLines });
    }

    db.prepare(`UPDATE sessions SET status = 'ready' WHERE id = ?`).run(sessionId);
    updateProgress(sessionId, { status: "ready", indexedFiles: files.length, totalLines });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Index failed";
    db.prepare(`UPDATE sessions SET status = 'failed', error_message = ? WHERE id = ?`).run(
      message,
      sessionId,
    );
    updateProgress(sessionId, { status: "failed", error: message });
    throw error;
  }
}

export function scheduleIndexing(sessionId: string) {
  setImmediate(() => {
    indexSession(sessionId).catch((err) => console.error("Indexing failed:", err));
  });
}
