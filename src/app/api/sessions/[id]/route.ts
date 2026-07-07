import { NextRequest, NextResponse } from "next/server";
import { scheduleIndexing } from "@/lib/indexer/streamIndexer";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { finalize?: boolean };

  if (body.finalize) {
    scheduleIndexing(id);
    return NextResponse.json({ ok: true, indexing: true });
  }

  return NextResponse.json({ ok: true });
}
