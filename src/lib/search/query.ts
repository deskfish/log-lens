import type { LogLevel } from "@/lib/types";

export interface SearchWhere {
  sql: string[];
  args: Array<string | number>;
}

export function buildSearchWhere(
  sessionId: string,
  opts: {
    levels?: LogLevel[];
    services?: string[];
    nodeKeys?: string[];
    timeFromMs?: number;
    timeToMs?: number;
    cursor?: { ts: number; id: number } | null;
    tablePrefix?: string;
  },
): SearchWhere {
  const p = opts.tablePrefix ? `${opts.tablePrefix}.` : "";
  const where: string[] = [`${p ? `${p}session_id` : "session_id"} = ?`];
  const args: Array<string | number> = [sessionId];

  if (opts.levels?.length) {
    where.push(`${p}level IN (${opts.levels.map(() => "?").join(",")})`);
    args.push(...opts.levels);
  }
  if (opts.nodeKeys?.length) {
    const clauses = opts.nodeKeys.map(() => `(${p}service_name = ? AND ${p}node_name = ?)`).join(" OR ");
    where.push(`(${clauses})`);
    for (const key of opts.nodeKeys) {
      const [service, node] = key.split("::");
      args.push(service, node);
    }
  } else if (opts.services?.length) {
    where.push(`${p}service_name IN (${opts.services.map(() => "?").join(",")})`);
    args.push(...opts.services);
  }
  if (opts.timeFromMs !== undefined) {
    where.push(`(${p}timestamp_ms IS NULL OR ${p}timestamp_ms >= ?)`);
    args.push(opts.timeFromMs);
  }
  if (opts.timeToMs !== undefined) {
    where.push(`(${p}timestamp_ms IS NULL OR ${p}timestamp_ms <= ?)`);
    args.push(opts.timeToMs);
  }
  if (opts.cursor) {
    where.push(
      `(COALESCE(${p}timestamp_ms, 9223372036854775807) > ? OR (${p}timestamp_ms = ? AND ${p}id > ?))`,
    );
    args.push(opts.cursor.ts, opts.cursor.ts, opts.cursor.id);
  }

  return { sql: where, args };
}

export function mapLogRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    sessionId: String(row.session_id),
    sourceFileId: String(row.source_file_id),
    timestampMs: row.timestamp_ms === null ? null : Number(row.timestamp_ms),
    level: String(row.level),
    serviceName: String(row.service_name),
    nodeName: String(row.node_name),
    message: String(row.message),
    raw: String(row.raw),
    lineNumber: Number(row.line_number),
  };
}

export function buildNextCursor(
  entries: Array<{ id: number; timestampMs: number | null }>,
  limit: number,
): string | null {
  const last = entries[entries.length - 1];
  if (!last || entries.length < limit) return null;
  return `${last.timestampMs ?? 9223372036854775807}:${last.id}`;
}
