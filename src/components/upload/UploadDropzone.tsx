"use client";

import { useCallback, useState } from "react";
import { inferServiceNode } from "@/lib/parser";
import styles from "./UploadDropzone.module.css";

const CHUNK_SIZE = 5 * 1024 * 1024;

export interface UploadFileItem {
  id: string;
  file: File;
  serviceName: string;
  nodeName: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
}

interface Props {
  sessionId: string;
  onComplete: () => void;
}

function makeId() {
  return crypto.randomUUID();
}

export function UploadDropzone({ sessionId, onComplete }: Props) {
  const [items, setItems] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next = Array.from(files).map((file) => {
      const inferred = inferServiceNode(file.name);
      return {
        id: makeId(),
        file,
        serviceName: inferred.serviceName,
        nodeName: inferred.nodeName,
        progress: 0,
        status: "pending" as const,
      };
    });
    setItems((prev) => [...prev, ...next]);
  }, []);

  async function uploadFile(item: UploadFileItem) {
    const totalChunks = Math.max(1, Math.ceil(item.file.size / CHUNK_SIZE));
    setItems((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f)),
    );

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, item.file.size);
      const blob = item.file.slice(start, end);
      const form = new FormData();
      form.append("fileId", item.id);
      form.append("fileName", item.file.name);
      form.append("serviceName", item.serviceName);
      form.append("nodeName", item.nodeName);
      form.append("chunkIndex", String(chunkIndex));
      form.append("totalChunks", String(totalChunks));
      form.append("isLast", String(chunkIndex === totalChunks - 1));
      form.append("chunk", blob);

      const res = await fetch(`/api/sessions/${sessionId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");

      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      setItems((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, progress } : f)),
      );
    }

    setItems((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: "done", progress: 100 } : f)),
    );
  }

  async function handleStart() {
    if (!items.length) return;
    setUploading(true);
    try {
      for (const item of items) {
        if (item.status !== "done") await uploadFile(item);
      }
      await fetch(`/api/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalize: true }),
      });
      onComplete();
    } catch {
      setItems((prev) =>
        prev.map((f) => (f.status === "uploading" ? { ...f, status: "error" } : f)),
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.dropzone}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <p>拖拽日志文件到此处，或</p>
        <label className={styles.pickBtn}>
          选择文件
          <input
            type="file"
            multiple
            accept=".log,.txt,.gz"
            hidden
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>
        <p className={styles.hint}>支持 .log / .txt / .gz，可多选多服务多节点</p>
      </div>

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.card}>
              <div className={styles.cardHead}>
                <strong>{item.file.name}</strong>
                <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className={styles.fields}>
                <label>
                  服务
                  <input
                    value={item.serviceName}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((f) =>
                          f.id === item.id ? { ...f, serviceName: e.target.value } : f,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  节点
                  <input
                    value={item.nodeName}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((f) =>
                          f.id === item.id ? { ...f, nodeName: e.target.value } : f,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <div className={styles.progress}>
                <div className={styles.bar} style={{ width: `${item.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!items.length || uploading}
          onClick={handleStart}
        >
          {uploading ? "上传中…" : "开始上传并索引"}
        </button>
      </div>
    </div>
  );
}
