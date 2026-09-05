export type Decision =
  | "origin"
  | "cache"
  | "coalesced"
  | "auth_rejected"
  | "rate_limited"
  | "error";

export type Endpoint = "chat" | "embed";

export type HealthResponse = {
  status: "ok" | "degraded";
  qdrant: boolean;
};

export type RequestLogEntry = {
  timestamp: number;
  endpoint: string;
  decision: string;
  latency_ms: number;
};

export type MetricsResponse = {
  auth_rejected: number;
  rate_limited: number;
  cache_hits: number;
  cache_misses: number;
  coalesced: number;
  cohere_calls: number;
  latency_ms: {
    p50: number | null;
    p99: number | null;
    count: number;
  };
  recent: RequestLogEntry[];
};

export type PlayResult = {
  status: number;
  decision: Decision;
  latencyMs: number;
  body: unknown;
  error?: string;
  cacheScore?: number;
  cacheMatch?: string;
  cacheVia?: string;
  cacheNeed?: number;
  cacheGray?: number;
};
