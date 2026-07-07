import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import type { LogLevel } from "@/lib/types";

const DEFAULT_LIMIT = 200;

function parseCursor(cursor?: string | null) {
  if (!cursor) return null;
  const [ts, id] = cursor.split(":");
  return { ts: Number(ts), id: Number(id) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const query = sp.get("query") ?? "";
  const regex = sp.get("regex") === "true";
  const levels = sp.getAll("level") as LogLevel[];
  const services = sp.getAll("service");
  const nodeKeys = sp.getAll("nodeKey");
  const timeFromMs = sp.get("timeFromMs") ? Number(sp.get("timeFromMs")) : undefined;
  const timeToMs = sp.get("timeToMs") ? Number(sp.get("timeToMs")) : undefined;
  const cursor = parseCursor(sp.get("cursor"));
  const limit = Math.min(Number(sp.get("limit") ?? DEFAULT_LIMIT), 500);
  const aroundId = sp.get("aroundId") ? Number(sp.get("aroundId")) : undefined;

  const db = getDb();

  if (aroundId) {
    const center = db
      .prepare(`SELECT * FROM log_entries WHERE id = ? AND session_id = ?`)
      .get(aroundId, id) as Record<string, unknown> | undefined;
    if (!center) return NextResponse.json({ entries: [], total: 0 });

    const entries = db
      .prepare(
        `SELECT * FROM log_entries
         WHERE session_id = ? AND id BETWEEN ? AND ?
         ORDER BY COALESCE(timestamp_ms, 9223372036854775807), id`,
      )
      .all(id, aroundId - 50, aroundId + 50);

    return NextResponse.json({ entries, total: entries.length, mode: "context" });
  }

  const where: string[] = ["session_id = ?"];
  const args: Array<string | number> = [id];

  if (levels.length) {
    where.push(`level IN (${levels.map(() => "?").join(",")})`);
    args.push(...levels);
  }
  if (nodeKeys.length) {
    const clauses = nodeKeys.map(() => "(service_name = ? AND node_name = ?)").join(" OR ");
    where.push(`(${clauses})`);
    for (const key of nodeKeys) {
      const [service, node] = key.split("::");
      args.push(service, node);
    }
  } else if (services.length) {
    where.push(`service_name IN (${services.map(() => "?").join(",")})`);
    args.push(...services);
  }
  if (timeFromMs !== undefined) {
    where.push(`(timestamp_ms IS NULL OR timestamp_ms >= ?)`);
    args.push(timeFromMs);
  }
  if (timeToMs !== undefined) {
    where.push(`(timestamp_ms IS NULL OR timestamp_ms <= ?)`);
    args.push(timeToMs);
  }
  if (cursor) {
    where.push(`(COALESCE(timestamp_ms, 9223372036854775807) > ? OR (timestamp_ms = ? AND id > ?))`);
    args.push(cursor.ts, cursor.ts, cursor.id);
  }

  let entries: Array<Record<string, unknown>> = [];
  let total = 0;

  if (query.trim()) {
    if (regex) {
      try {
        const re = new RegExp(query, "i");
        const all = db
          .prepare(
            `SELECT * FROM log_entries WHERE ${where.join(" AND ")}
             ORDER BY COALESCE(timestamp_ms, 9223372036854775807), id LIMIT 5000`,
          )
          .all(...args) as Array<Record<string, unknown>>;
        const filtered = all.filter((row) => re.test(String(row.message)) || re.test(String(row.raw)));
        total = filtered.length;
        entries = filtered.slice(0, limit);
      } catch {
        return NextResponse.json({ error: "Invalid regex" }, { status: 400 });
      }
    } else {
      const ftsQuery = query
        .trim()
        .split(/\s+/)
        .map((t) => `${t.replace(/["*]/g, "")}*`)
        .join(" ");

      const ftsRows = db
        .prepare(
          `SELECT le.* FROM log_entries_fts
           JOIN log_entries le ON le.id = log_entries_fts.rowid
           WHERE log_entries_fts MATCH ? AND le.session_id = ?
           ORDER BY COALESCE(le.timestamp_ms, 9223372036854775807), le.id
           LIMIT ?`,
        )
        .all(ftsQuery, id, limit) as Array<Record<string, unknown>>;

      entries = ftsRows;
      total = ftsRows.length;
    }
  } else {
    total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM log_entries WHERE ${where.join(" AND ")}`)
        .get(...args) as { c: number }
    ).c;

    entries = db
      .prepare(
        `SELECT * FROM log_entries WHERE ${where.join(" AND ")}
         ORDER BY COALESCE(timestamp_ms, 9223372036854775807), id
         LIMIT ?`,
      )
      .all(...args, limit) as Array<Record<string, unknown>>;
  }

  const mapped = entries.map((row) => ({
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
  }));

  const last = mapped[mapped.length - 1];
  const nextCursor =
    last && mapped.length === limit
      ? `${last.timestampMs ?? 9223372036854775807}:${last.id}`
      : null;

  const tree = db
    .prepare(
      `SELECT service_name, node_name, COUNT(*) AS count
       FROM log_entries WHERE session_id = ?
       GROUP BY service_name, node_name ORDER BY service_name, node_name`,
    )
    .all(id) as Array<{ service_name: string; node_name: string; count: number }>;

  const serviceMap = new Map<string, { count: number; nodes: { nodeName: string; count: number }[] }>();
  for (const row of tree) {
    if (!serviceMap.has(row.service_name)) {
      serviceMap.set(row.service_name, { count: 0, nodes: [] });
    }
    const svc = serviceMap.get(row.service_name)!;
    svc.count += row.count;
    svc.nodes.push({ nodeName: row.node_name, count: row.count });
  }

  return NextResponse.json({
    entries: mapped,
    total,
    nextCursor,
    tree: Array.from(serviceMap.entries()).map(([serviceName, data]) => ({
      serviceName,
      count: data.count,
      nodes: data.nodes,
    })),
  });
}
