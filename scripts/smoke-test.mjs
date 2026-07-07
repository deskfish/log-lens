#!/usr/bin/env node
/**
 * Log Lens API smoke test.
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

const ERROR_LOG =
  "/Users/sunlacey/codespace/company/flybot/rt/flybot2.0/channel-hub/channel-hub-web/LOG_FILE_PATH:./logs_IS_UNDEFINED/channel-hub/error.log";
const SYSTEM_LOG =
  "/Users/sunlacey/codespace/company/flybot/rt/flybot2.0/channel-hub/channel-hub-web/LOG_FILE_PATH:./logs_IS_UNDEFINED/channel-hub/system.log";

async function uploadFile(sessionId, filePath, serviceName, nodeName) {
  const fs = await import("fs");
  const { randomUUID } = await import("crypto");
  const fileName = filePath.split("/").pop() ?? "test.log";
  const fileId = randomUUID();
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("fileId", fileId);
  form.append("fileName", fileName);
  form.append("serviceName", serviceName);
  form.append("nodeName", nodeName);
  form.append("chunkIndex", "0");
  form.append("totalChunks", "1");
  form.append("isLast", "true");
  form.append("chunk", new Blob([buffer]), fileName);

  const res = await fetch(`${BASE}/api/sessions/${sessionId}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return fileId;
}

async function waitReady(sessionId, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE}/api/sessions/${sessionId}/status`);
    const data = await res.json();
    process.stdout.write(
      `\r  索引: ${data.status} ${data.indexedLines}/${data.totalLines} 行`,
    );
    if (data.status === "ready") {
      console.log("");
      return data;
    }
    if (data.status === "failed") throw new Error(data.error ?? "Index failed");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Index timeout");
}

async function main() {
  console.log(`Log Lens smoke test → ${BASE}`);

  const createRes = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "flybot-channel-hub-test" }),
  });
  const { session } = await createRes.json();
  console.log(`✓ Session: ${session.id}`);

  console.log("✓ Uploading channel-hub error.log …");
  await uploadFile(session.id, ERROR_LOG, "channel-hub", "web-1");
  console.log("✓ Uploading channel-hub system.log …");
  await uploadFile(session.id, SYSTEM_LOG, "channel-hub", "web-1");

  await fetch(`${BASE}/api/sessions/${session.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finalize: true }),
  });

  const status = await waitReady(session.id);
  console.log(`✓ Indexed ${status.totalLines} lines from ${status.totalFiles} files`);

  const searchRes = await fetch(
    `${BASE}/api/sessions/${session.id}/search?query=DecodeException`,
  );
  const search = await searchRes.json();
  console.log(`✓ Search "DecodeException": ${search.total} hits`);

  const timelineRes = await fetch(`${BASE}/api/sessions/${session.id}/timeline`);
  const timeline = await timelineRes.json();
  console.log(`✓ Timeline buckets: ${timeline.buckets.length}`);

  console.log(`\n✅ All passed. Open: ${BASE}/sessions/${session.id}`);
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
