import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db/client";
import { mergeChunks, saveChunk } from "@/lib/upload/chunkedUpload";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const form = await request.formData();

  const fileId = String(form.get("fileId") || uuid());
  const fileName = String(form.get("fileName") || "unknown.log");
  const serviceName = String(form.get("serviceName") || "unknown");
  const nodeName = String(form.get("nodeName") || "default");
  const chunkIndex = Number(form.get("chunkIndex") ?? 0);
  const totalChunks = Number(form.get("totalChunks") ?? 1);
  const isLast = form.get("isLast") === "true";
  const chunk = form.get("chunk");

  if (!(chunk instanceof Blob)) {
    return NextResponse.json({ error: "Missing chunk" }, { status: 400 });
  }

  const db = getDb();
  const session = db.prepare(`SELECT id FROM sessions WHERE id = ?`).get(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const buffer = Buffer.from(await chunk.arrayBuffer());
  await saveChunk(sessionId, fileId, chunkIndex, buffer);

  if (!isLast) {
    return NextResponse.json({ ok: true, fileId, chunkIndex });
  }

  const storagePath = await mergeChunks(sessionId, fileId, fileName, totalChunks);
  db.prepare(
    `INSERT INTO source_files (id, session_id, service_name, node_name, original_name, storage_path, parse_status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(fileId, sessionId, serviceName, nodeName, fileName, storagePath);

  return NextResponse.json({ ok: true, fileId, completed: true });
}
