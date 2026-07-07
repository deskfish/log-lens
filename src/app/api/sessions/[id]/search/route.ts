import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import {
  buildNextCursor,
  buildSearchWhere,
  mapLogRow,
} from "@/lib/search/query";
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
      .prepare(`SELECT id FROM log_entries WHERE id = ? AND session_id = ?`)
      .get(aroundId, id);
    if (!center) return NextResponse.json({ entries: [], total: 0, nextCursor: null });

    const entries = db
      .prepare(
        `SELECT * FROM log_entries
         WHERE session_id = ? AND id BETWEEN ? AND ?
         ORDER BY COALESCE(timestamp_ms, 9223372036854775807), id`,
      )
      .all(id, aroundId - 50, aroundId + 50) as Array<Record<string, unknown>>;

    return NextResponse.json({
      entries: entries.map(mapLogRow),
      total: entries.length,
      nextCursor: null,
      mode: "context",
    });
  }

  const filterOpts = { levels, services, nodeKeys, timeFromMs, timeToMs, cursor };
  const { sql: where, args } = buildSearchWhere(id, filterOpts);

  let rows: Array<Record<string, unknown>> = [];
  let total = 0;

  if (query.trim()) {
    if (regex) {
      try {
        const re = new RegExp(query, "i");
        const batchSize = Math.max(limit * 4, 2000);
        const batch = db
          .prepare(
            `SELECT * FROM log_entries WHERE ${where.join(" AND ")}
             ORDER BY COALESCE(timestamp_ms, 9223372036854775807), id
             LIMIT ?`,
          )
          .all(...args, batchSize) as Array<Record<string, unknown>>;

        const filtered = batch.filter(
          (row) => re.test(String(row.message)) || re.test(String(row.raw)),
        );
        rows = filtered.slice(0, limit);
        total = filtered.length;
      } catch {
        return NextResponse.json({ error: "Invalid regex" }, { status: 400 });
      }
    } else {
      const ftsQuery = query
        .trim()
        .split(/\s+/)
        .map((t) => `${t.replace(/["*]/g, "")}*`)
        .join(" ");

      const { sql: leWhere, args: leArgs } = buildSearchWhere(id, {
        ...filterOpts,
        tablePrefix: "le",
      });

      const countRow = db
        .prepare(
          `SELECT COUNT(*) AS c FROM log_entries_fts
           JOIN log_entries le ON le.id = log_entries_fts.rowid
           WHERE log_entries_fts MATCH ? AND ${leWhere.join(" AND ")}`,
        )
        .get(ftsQuery, ...leArgs) as { c: number };
      total = countRow.c;

      rows = db
        .prepare(
          `SELECT le.* FROM log_entries_fts
           JOIN log_entries le ON le.id = log_entries_fts.rowid
           WHERE log_entries_fts MATCH ? AND ${leWhere.join(" AND ")}
           ORDER BY COALESCE(le.timestamp_ms, 9223372036854775807), le.id
           LIMIT ?`,
        )
        .all(ftsQuery, ...leArgs, limit) as Array<Record<string, unknown>>;
    }
  } else {
    total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM log_entries WHERE ${where.join(" AND ")}`)
        .get(...args) as { c: number }
    ).c;

    rows = db
      .prepare(
        `SELECT * FROM log_entries WHERE ${where.join(" AND ")}
         ORDER BY COALESCE(timestamp_ms, 9223372036854775807), id
         LIMIT ?`,
      )
      .all(...args, limit) as Array<Record<string, unknown>>;
  }

  const mapped = rows.map(mapLogRow);
  const nextCursor = buildNextCursor(mapped, limit);

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
