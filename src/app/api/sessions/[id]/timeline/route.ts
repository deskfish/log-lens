import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bucketSizeMs = Number(request.nextUrl.searchParams.get("bucketSizeMs") ?? 60_000);

  const db = getDb();
  const buckets = db
    .prepare(
      `SELECT bucket_start_ms, count, error_count FROM time_buckets
       WHERE session_id = ? AND bucket_size_ms = ?
       ORDER BY bucket_start_ms`,
    )
    .all(id, bucketSizeMs) as Array<{
    bucket_start_ms: number;
    count: number;
    error_count: number;
  }>;

  return NextResponse.json({
    bucketSizeMs,
    buckets: buckets.map((b) => ({
      bucketStartMs: b.bucket_start_ms,
      count: b.count,
      errorCount: b.error_count,
    })),
  });
}
