import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { getDb } from "@/lib/db/client";
import type { Session } from "@/lib/types";
import styles from "./page.module.css";

function getSessions(): Session[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM source_files sf WHERE sf.session_id = s.id) AS file_count,
        (SELECT COUNT(DISTINCT service_name) FROM source_files sf WHERE sf.session_id = s.id) AS service_count
       FROM sessions s ORDER BY s.created_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: row.status as Session["status"],
    createdAt: String(row.created_at),
    fileCount: Number(row.file_count ?? 0),
    serviceCount: Number(row.service_count ?? 0),
  }));
}

export default function HomePage() {
  const sessions = getSessions();

  return (
    <AppShell
      subtitle="多服务日志合并分析"
      action={
        <Link href="/sessions/new" className={styles.cta}>
          + 新建分析
        </Link>
      }
    >
      <section className={styles.hero}>
        <h1>跨服务、跨节点，一条时间线看清全部日志</h1>
        <p>上传多份日志，按时间合并检索，热力时间轴快速定位异常峰值。</p>
      </section>

      {sessions.length === 0 ? (
        <div className={styles.empty}>
          <p>还没有分析任务</p>
          <Link href="/sessions/new" className={styles.cta}>
            创建第一个分析
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <h2>{session.name}</h2>
                <span className={`${styles.badge} ${styles[session.status]}`}>
                  {session.status}
                </span>
              </div>
              <p className={styles.meta}>
                {session.fileCount ?? 0} 文件 · {session.serviceCount ?? 0} 服务
              </p>
              <p className={styles.time}>{new Date(session.createdAt).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
