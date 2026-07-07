"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import { LogLevelBadge } from "./LogLevelBadge";
import type { LogEntry } from "@/lib/types";
import styles from "./VirtualLogTable.module.css";

interface Props {
  entries: LogEntry[];
  selectedId?: number | null;
  onSelect?: (entry: LogEntry) => void;
  highlight?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function VirtualLogTable({
  entries,
  selectedId,
  onSelect,
  highlight,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  });

  useEffect(() => {
    loadingRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el || !onLoadMore) return;

    function handleScroll() {
      if (!hasMore || loadingRef.current || !onLoadMore) return;
      const distance = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      if (distance < 160) onLoadMore();
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, onLoadMore, entries.length]);

  function renderMessage(message: string) {
    if (!highlight?.trim()) return message;
    const idx = message.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx < 0) return message;
    return (
      <>
        {message.slice(0, idx)}
        <mark className={styles.highlight}>{message.slice(idx, idx + highlight.length)}</mark>
        {message.slice(idx + highlight.length)}
      </>
    );
  }

  return (
    <div className={styles.wrap}>
      <div ref={parentRef} className={styles.viewport}>
        <div className={styles.header}>
          <span>时间</span>
          <span>级别</span>
          <span>服务</span>
          <span>节点</span>
          <span>消息</span>
        </div>
        <div className={styles.rows} style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index];
            const isSelected = selectedId === entry.id;
            return (
              <div
                key={entry.id}
                className={`${styles.row} ${isSelected ? styles.selected : ""}`}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
                onDoubleClick={() => onSelect?.(entry)}
              >
                <span className={styles.time}>
                  {entry.timestampMs
                    ? dayjs(entry.timestampMs).format("HH:mm:ss.SSS")
                    : "—"}
                </span>
                <span>
                  <LogLevelBadge level={entry.level} />
                </span>
                <span className={styles.meta}>{entry.serviceName}</span>
                <span className={styles.meta}>{entry.nodeName}</span>
                <span className={styles.message}>{renderMessage(entry.message)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(hasMore || loadingMore) && (
        <div className={styles.footer}>
          {loadingMore ? (
            <span className={styles.footerText}>加载中…</span>
          ) : (
            <button type="button" className={styles.loadMoreBtn} onClick={onLoadMore}>
              加载更多
            </button>
          )}
        </div>
      )}
    </div>
  );
}
