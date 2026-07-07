"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import styles from "./new.module.css";

export default function NewSessionPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function ensureSession() {
    if (sessionId) return sessionId;
    setCreating(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { session: { id: string } };
    setSessionId(data.session.id);
    setCreating(false);
    return data.session.id;
  }

  return (
    <AppShell title="新建分析" subtitle="上传多服务多节点日志">
      <div className={styles.steps}>
        <span className={styles.active}>① 选择文件</span>
        <span className={styles.active}>② 标注服务/节点</span>
        <span>③ 上传索引</span>
      </div>
      {creating ? (
        <p className={styles.loading}>创建会话中…</p>
      ) : sessionId ? (
        <UploadDropzone
          sessionId={sessionId}
          onComplete={() => router.push(`/sessions/${sessionId}`)}
        />
      ) : (
        <button type="button" className={styles.startBtn} onClick={() => ensureSession()}>
          开始新建分析
        </button>
      )}
    </AppShell>
  );
}
