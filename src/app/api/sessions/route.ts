import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db/client";
import type { Session } from "@/lib/types";

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status as Session["status"],
    createdAt: String(row.created_at),
    fileCount: Number(row.file_count ?? 0),
    serviceCount: Number(row.service_count ?? 0),
  };
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM source_files sf WHERE sf.session_id = s.id) AS file_count,
        (SELECT COUNT(DISTINCT service_name) FROM source_files sf WHERE sf.session_id = s.id) AS service_count
       FROM sessions s ORDER BY s.created_at DESC`,
    )
    .all();
  return NextResponse.json({ sessions: rows.map((r) => mapSession(r as Record<string, unknown>)) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string };
  const id = uuid();
  const name = body.name?.trim() || `analysis-${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const db = getDb();
  db.prepare(`INSERT INTO sessions (id, name, status) VALUES (?, ?, 'pending')`).run(id, name);
  return NextResponse.json({ session: mapSession({ id, name, status: "pending", created_at: new Date().toISOString() }) });
}
