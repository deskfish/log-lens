import type { LogLevel } from "@/lib/types";

export interface SearchQueryParams {
  query?: string;
  regex?: boolean;
  levels?: LogLevel[];
  services?: string[];
  nodeKeys?: string[];
  timeFromMs?: number;
  timeToMs?: number;
  cursor?: string | null;
  limit?: number;
}

export function buildSearchParams(input: SearchQueryParams) {
  const sp = new URLSearchParams();
  if (input.query) sp.set("query", input.query);
  if (input.regex) sp.set("regex", "true");
  input.levels?.forEach((l) => sp.append("level", l));
  input.services?.forEach((s) => sp.append("service", s));
  input.nodeKeys?.forEach((k) => sp.append("nodeKey", k));
  if (input.timeFromMs !== undefined) sp.set("timeFromMs", String(input.timeFromMs));
  if (input.timeToMs !== undefined) sp.set("timeToMs", String(input.timeToMs));
  if (input.cursor) sp.set("cursor", input.cursor);
  if (input.limit) sp.set("limit", String(input.limit));
  return sp;
}

export interface SearchResponse {
  entries: import("@/lib/types").LogEntry[];
  total: number;
  nextCursor: string | null;
  tree: import("@/lib/types").ServiceNodeTree[];
}

export async function fetchSearch(sessionId: string, input: SearchQueryParams): Promise<SearchResponse> {
  const sp = buildSearchParams(input);
  const res = await fetch(`/api/sessions/${sessionId}/search?${sp}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json() as Promise<SearchResponse>;
}
