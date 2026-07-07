export type SessionStatus = "pending" | "indexing" | "ready" | "failed";
export type ParseStatus = "pending" | "indexing" | "done" | "failed";
export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" | "UNKNOWN";

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  createdAt: string;
  fileCount?: number;
  serviceCount?: number;
}

export interface SourceFile {
  id: string;
  sessionId: string;
  serviceName: string;
  nodeName: string;
  originalName: string;
  storagePath: string;
  totalLines: number;
  parseStatus: ParseStatus;
}

export interface LogEntry {
  id: number;
  sessionId: string;
  sourceFileId: string;
  timestampMs: number | null;
  level: LogLevel;
  serviceName: string;
  nodeName: string;
  message: string;
  raw: string;
  lineNumber: number;
}

export interface TimeBucket {
  bucketStartMs: number;
  count: number;
  errorCount: number;
}

export interface SearchFilters {
  query?: string;
  regex?: boolean;
  levels?: LogLevel[];
  services?: string[];
  nodes?: string[];
  timeFromMs?: number;
  timeToMs?: number;
  cursor?: string;
  limit?: number;
}

export interface ServiceNodeTree {
  serviceName: string;
  count: number;
  nodes: { nodeName: string; count: number }[];
}

export interface IndexProgress {
  sessionId: string;
  status: SessionStatus;
  totalFiles: number;
  indexedFiles: number;
  totalLines: number;
  indexedLines: number;
  currentFile?: string;
  error?: string;
}
