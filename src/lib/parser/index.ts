import type { LogLevel } from "@/lib/types";

export interface ParsedLine {
  timestampMs: number | null;
  level: LogLevel;
  message: string;
}

const LEVEL_MAP: Record<string, LogLevel> = {
  ERROR: "ERROR",
  ERR: "ERROR",
  WARN: "WARN",
  WARNING: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
  TRACE: "TRACE",
};

const SPRING =
  /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+/i;
const SPRING_BRACKET =
  /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+\[[^\]]+\]\s+(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+/i;
const ISO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
const NGINX = /\[(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\]/;

function normalizeLevel(raw: string): LogLevel {
  return LEVEL_MAP[raw.toUpperCase()] ?? "UNKNOWN";
}

function parseSpringBracket(line: string): ParsedLine | null {
  const match = line.match(SPRING_BRACKET);
  if (!match) return null;
  const ts = Date.parse(match[1].replace(" ", "T"));
  const level = normalizeLevel(match[2]);
  const message = line.slice(match[0].length).trim();
  return { timestampMs: Number.isNaN(ts) ? null : ts, level, message };
}

function parseSpring(line: string): ParsedLine | null {
  const match = line.match(SPRING);
  if (!match) return null;
  const ts = Date.parse(match[1].replace(" ", "T"));
  const level = normalizeLevel(match[2]);
  const message = line.slice(match[0].length).trim();
  return { timestampMs: Number.isNaN(ts) ? null : ts, level, message };
}

function parseIso(line: string): ParsedLine | null {
  const match = line.match(ISO);
  if (!match) return null;
  const ts = Date.parse(match[1]);
  let level: LogLevel = "UNKNOWN";
  let message = line.slice(match[0].length).trim();
  const levelMatch = message.match(/^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b/i);
  if (levelMatch) {
    level = normalizeLevel(levelMatch[1]);
    message = message.slice(levelMatch[0].length).trim();
  }
  return { timestampMs: Number.isNaN(ts) ? null : ts, level, message };
}

function parseJson(line: string): ParsedLine | null {
  if (!line.startsWith("{")) return null;
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    const tsRaw = obj.timestamp ?? obj.time ?? obj["@timestamp"];
    const levelRaw = String(obj.level ?? obj.severity ?? "UNKNOWN");
    const message = String(obj.message ?? obj.msg ?? line);
    const ts =
      typeof tsRaw === "number"
        ? tsRaw
        : typeof tsRaw === "string"
          ? Date.parse(tsRaw)
          : null;
    return {
      timestampMs: ts && !Number.isNaN(ts) ? ts : null,
      level: normalizeLevel(levelRaw),
      message,
    };
  } catch {
    return null;
  }
}

function parseNginx(line: string): ParsedLine | null {
  const match = line.match(NGINX);
  if (!match) return null;
  const ts = Date.parse(match[1].replace(/:/, " "));
  return {
    timestampMs: Number.isNaN(ts) ? null : ts,
    level: "INFO",
    message: line,
  };
}

export function parseLogLine(line: string, lastTimestampMs: number | null): ParsedLine {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    return { timestampMs: lastTimestampMs, level: "UNKNOWN", message: "" };
  }

  const parsers = [parseSpringBracket, parseSpring, parseIso, parseJson, parseNginx];
  for (const parser of parsers) {
    const result = parser(trimmed);
    if (result) {
      if (result.timestampMs === null && lastTimestampMs !== null) {
        result.timestampMs = lastTimestampMs;
      }
      return result;
    }
  }

  return {
    timestampMs: lastTimestampMs,
    level: "UNKNOWN",
    message: trimmed,
  };
}

export function inferServiceNode(fileName: string): { serviceName: string; nodeName: string } {
  const base = fileName.replace(/\.(log|txt|gz)$/i, "");
  const parts = base.split(/[-_]/);
  if (parts.length >= 2) {
    return { serviceName: parts[0], nodeName: parts[1] };
  }
  return { serviceName: base || "unknown", nodeName: "default" };
}
