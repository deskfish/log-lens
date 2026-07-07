"use client";

import { formatLogTime, formatLogTimeOfDay } from "@/lib/datetime";
import type { TimeBucket } from "@/lib/types";
import styles from "./TimelineHeatRibbon.module.css";

interface Props {
  buckets: TimeBucket[];
  bucketSizeMs: number;
  timeFromMs?: number;
  timeToMs?: number;
  onSelectRange: (fromMs: number, toMs: number) => void;
}

export function TimelineHeatRibbon({
  buckets,
  bucketSizeMs,
  timeFromMs,
  timeToMs,
  onSelectRange,
}: Props) {
  if (!buckets.length) {
    return (
      <div className={styles.ribbon}>
        <span className={styles.empty}>暂无时间线数据</span>
      </div>
    );
  }

  const max = Math.max(...buckets.map((b) => b.count), 1);
  const minTs = buckets[0].bucketStartMs;
  const maxTs = buckets[buckets.length - 1].bucketStartMs + bucketSizeMs;

  return (
    <div className={styles.ribbon}>
      <div className={styles.bars}>
        {buckets.map((bucket) => {
          const height = Math.max(8, (bucket.count / max) * 100);
          const hasError = bucket.errorCount > 0;
          const inRange =
            timeFromMs !== undefined &&
            timeToMs !== undefined &&
            bucket.bucketStartMs >= timeFromMs &&
            bucket.bucketStartMs <= timeToMs;

          return (
            <button
              key={bucket.bucketStartMs}
              type="button"
              className={`${styles.bar} ${inRange ? styles.active : ""}`}
              style={{ height: `${height}%` }}
              title={`${formatLogTime(bucket.bucketStartMs)} · ${bucket.count} 条`}
              onClick={() =>
                onSelectRange(bucket.bucketStartMs, bucket.bucketStartMs + bucketSizeMs)
              }
            >
              <span
                className={`${styles.fill} ${hasError ? styles.errorPeak : ""}`}
              />
            </button>
          );
        })}
      </div>
      <div className={styles.labels}>
        <span>{formatLogTimeOfDay(minTs)}</span>
        <span className={styles.title}>Timeline Heat Ribbon (UTC+8)</span>
        <span>{formatLogTimeOfDay(maxTs)}</span>
      </div>
    </div>
  );
}
