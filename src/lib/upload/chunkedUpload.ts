import fs from "fs";
import path from "path";
import { getUploadDir } from "@/lib/db/client";

export async function saveChunk(
  sessionId: string,
  fileId: string,
  chunkIndex: number,
  data: Buffer,
) {
  const dir = path.join(getUploadDir(sessionId), fileId, "chunks");
  fs.mkdirSync(dir, { recursive: true });
  const chunkPath = path.join(dir, `chunk-${chunkIndex}`);
  await fs.promises.writeFile(chunkPath, data);
  return chunkPath;
}

export async function mergeChunks(
  sessionId: string,
  fileId: string,
  fileName: string,
  totalChunks: number,
) {
  const dir = path.join(getUploadDir(sessionId), fileId);
  const chunksDir = path.join(dir, "chunks");
  const finalPath = path.join(getUploadDir(sessionId), `${fileId}-${fileName}`);

  const writeStream = fs.createWriteStream(finalPath);
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunksDir, `chunk-${i}`);
    const chunk = await fs.promises.readFile(chunkPath);
    writeStream.write(chunk);
    await fs.promises.unlink(chunkPath);
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on("error", reject);
  });

  await fs.promises.rm(chunksDir, { recursive: true, force: true });
  return finalPath;
}
