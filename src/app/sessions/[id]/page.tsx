"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceNodeTree } from "@/components/filters/ServiceNodeTree";
import { VirtualLogTable } from "@/components/logs/VirtualLogTable";
import { TimelineHeatRibbon } from "@/components/timeline/TimelineHeatRibbon";
import { fetchSearch } from "@/lib/search/client";
import type { IndexProgress, LogEntry, ServiceNodeTree as Tree, TimeBucket } from "@/lib/types";
import styles from "./analysis.module.css";

const LEVELS = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"] as const;

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tree, setTree] = useState<Tree[]>([]);
  const [buckets, setBuckets] = useState<TimeBucket[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<IndexProgress | null>(null);
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [timeFromMs, setTimeFromMs] = useState<number | undefined>();
  const [timeToMs, setTimeToMs] = useState<number | undefined>();
  const [contextEntries, setContextEntries] = useState<LogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const searchInputRef = useRef({
    query,
    regex,
    levels,
    selectedServices,
    selectedNodes,
    timeFromMs,
    timeToMs,
  });

  useEffect(() => {
    searchInputRef.current = {
      query,
      regex,
      levels,
      selectedServices,
      selectedNodes,
      timeFromMs,
      timeToMs,
    };
  }, [query, regex, levels, selectedServices, selectedNodes, timeFromMs, timeToMs]);

  const runSearch = useCallback(
    async (cursor?: string | null, append = false) => {
      const input = searchInputRef.current;
      const data = await fetchSearch(sessionId, {
        query: input.query,
        regex: input.regex,
        levels: input.levels as typeof LEVELS[number][],
        services: input.selectedServices,
        nodeKeys: input.selectedNodes,
        timeFromMs: input.timeFromMs,
        timeToMs: input.timeToMs,
        cursor: cursor ?? undefined,
      });

      setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      if (!append) setTree(data.tree);
      return data;
    },
    [sessionId],
  );

  const loadSearch = useCallback(async () => {
    setLoadingMore(false);
    await runSearch(null, false);
  }, [runSearch]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await runSearch(nextCursor, true);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, runSearch]);

  useEffect(() => {
    let cancelled = false;

    async function refreshData() {
      const statusRes = await fetch(`/api/sessions/${sessionId}/status`);
      const statusData = (await statusRes.json()) as IndexProgress;
      if (cancelled) return;

      setStatus(statusData);
      if (statusData.status === "ready") {
        const data = await fetchSearch(sessionId, {});
        const timelineRes = await fetch(`/api/sessions/${sessionId}/timeline`);
        const timelineData = (await timelineRes.json()) as { buckets: TimeBucket[] };
        if (cancelled) return;
        setEntries(data.entries);
        setTotal(data.total);
        setNextCursor(data.nextCursor);
        setTree(data.tree);
        setBuckets(timelineData.buckets);
        return true;
      }
      return false;
    }

    const timer = setInterval(async () => {
      const done = await refreshData();
      if (done) clearInterval(timer);
    }, 1500);

    void refreshData().then((done) => {
      if (done) clearInterval(timer);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  async function openContext(entry: LogEntry) {
    setSelectedId(entry.id);
    const res = await fetch(`/api/sessions/${sessionId}/search?aroundId=${entry.id}`);
    const data = (await res.json()) as { entries: LogEntry[] };
    setContextEntries(data.entries);
  }

  function toggleService(service: string) {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  function toggleNode(service: string, node: string) {
    const key = `${service}::${node}`;
    setSelectedNodes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const hasMore = Boolean(nextCursor) && entries.length < total;

  return (
    <AppShell
      title={`Session ${sessionId.slice(0, 8)}`}
      subtitle={status?.status === "ready" ? "索引完成" : "索引中…"}
      action={
        <Link href="/" className={styles.back}>
          ← 返回
        </Link>
      }
    >
      <div className={styles.layout}>
        <ServiceNodeTree
          tree={tree}
          selectedServices={selectedServices}
          selectedNodes={selectedNodes}
          onToggleService={toggleService}
          onToggleNode={toggleNode}
        />

        <section className={styles.main}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              placeholder="搜索关键字…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadSearch()}
            />
            <label className={styles.regex}>
              <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
              正则
            </label>
            <select
              multiple
              className={styles.levels}
              value={levels}
              onChange={(e) =>
                setLevels(Array.from(e.target.selectedOptions, (o) => o.value))
              }
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button type="button" className={styles.searchBtn} onClick={() => void loadSearch()}>
              搜索
            </button>
            <span className={styles.count}>
              已加载 {entries.length.toLocaleString()} / {total.toLocaleString()} 条
            </span>
          </div>

          {status && status.status !== "ready" && (
            <div className={styles.progress}>
              索引进度 {status.indexedFiles}/{status.totalFiles} 文件 ·{" "}
              {status.indexedLines.toLocaleString()} 行
              {status.currentFile ? ` · 当前 ${status.currentFile}` : ""}
            </div>
          )}

          <VirtualLogTable
            entries={entries}
            selectedId={selectedId}
            highlight={query}
            onSelect={openContext}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={() => void loadMore()}
          />
        </section>

        {contextEntries.length > 0 && (
          <aside className={styles.context}>
            <header>
              <h3>上下文</h3>
              <button type="button" onClick={() => setContextEntries([])}>
                关闭
              </button>
            </header>
            <ul>
              {contextEntries.map((e) => (
                <li key={e.id} className={e.id === selectedId ? styles.ctxSelected : ""}>
                  <code>{e.lineNumber}</code> {e.message}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <TimelineHeatRibbon
        buckets={buckets}
        bucketSizeMs={60_000}
        timeFromMs={timeFromMs}
        timeToMs={timeToMs}
        onSelectRange={async (from, to) => {
          setTimeFromMs(from);
          setTimeToMs(to);
          searchInputRef.current = {
            ...searchInputRef.current,
            timeFromMs: from,
            timeToMs: to,
          };
          setLoadingMore(false);
          const data = await fetchSearch(sessionId, {
            query: searchInputRef.current.query,
            regex: searchInputRef.current.regex,
            levels: searchInputRef.current.levels as typeof LEVELS[number][],
            services: searchInputRef.current.selectedServices,
            nodeKeys: searchInputRef.current.selectedNodes,
            timeFromMs: from,
            timeToMs: to,
          });
          setEntries(data.entries);
          setTotal(data.total);
          setNextCursor(data.nextCursor);
        }}
      />
    </AppShell>
  );
}
