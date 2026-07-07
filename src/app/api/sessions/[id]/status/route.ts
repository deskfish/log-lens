import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getIndexProgress } from "@/lib/indexer/streamIndexer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = db
    .prepare(`SELECT parse_status, total_lines FROM source_files WHERE session_id = ?`)
    .all(id) as Array<{ parse_status: string; total_lines: number }>;

  const live = getIndexProgress(id);
  const totalFiles = files.length;
  const indexedFiles = files.filter((f) => f.parse_status === "done").length;
  const totalLines = files.reduce((sum, f) => sum + f.total_lines, 0);

  return NextResponse.json({
    sessionId: id,
    status: live?.status ?? session.status,
    totalFiles,
    indexedFiles: live?.indexedFiles ?? indexedFiles,
    totalLines: live?.totalLines ?? totalLines,
    indexedLines: live?.indexedLines ?? totalLines,
    currentFile: live?.currentFile,
    error: live?.error ?? session.error_message,
  });
}
