import styles from "./LogLevelBadge.module.css";
import type { LogLevel } from "@/lib/types";

const LEVEL_CLASS: Record<LogLevel, string> = {
  ERROR: styles.error,
  WARN: styles.warn,
  INFO: styles.info,
  DEBUG: styles.debug,
  TRACE: styles.trace,
  UNKNOWN: styles.unknown,
};

export function LogLevelBadge({ level }: { level: LogLevel | string }) {
  const key = (level in LEVEL_CLASS ? level : "UNKNOWN") as LogLevel;
  return <span className={`${styles.badge} ${LEVEL_CLASS[key]}`}>{key}</span>;
}
