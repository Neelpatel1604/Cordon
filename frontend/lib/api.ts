import { signRequest } from "@/lib/signer";
import type { Decision, HealthResponse, MetricsResponse, PlayResult } from "@/lib/types";

export const CORDON_URL =
  process.env.NEXT_PUBLIC_CORDON_URL ?? "http://127.0.0.1:8000";
const API_KEY = process.env.NEXT_PUBLIC_CORDON_API_KEY ?? "demo-key";
const API_SECRET = process.env.NEXT_PUBLIC_CORDON_API_SECRET ?? "demo-secret";

function asDecision(value: string | null, status: number): Decision {
  if (value === "origin" || value === "cache" || value === "coalesced") {
    return value;
  }
  if (status === 401) return "auth_rejected";
  if (status === 429) return "rate_limited";
  return "error";
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${CORDON_URL}/health`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const response = await fetch(`${CORDON_URL}/v1/metrics`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Metrics failed (${response.status})`);
  }
  return response.json();
}

export async function signedPost(
  path: "/v1/chat" | "/v1/embed",
  body: unknown,
  options?: { signed?: boolean },
): Promise<PlayResult> {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.signed !== false) {
    Object.assign(headers, await signRequest("POST", path, payload, API_KEY, API_SECRET));
  }

  const started = performance.now();
  const response = await fetch(`${CORDON_URL}${path}`, {
    method: "POST",
    headers,
    body: payload,
  });
  const latencyMs = performance.now() - started;
  const raw = await response.text();
  let parsed: unknown = raw;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  const decision = asDecision(response.headers.get("X-Cordon-Decision"), response.status);
  const scoreHeader = response.headers.get("X-Cordon-Cache-Score");
  const needHeader = response.headers.get("X-Cordon-Cache-Need");
  const grayHeader = response.headers.get("X-Cordon-Cache-Gray");
  const error =
    !response.ok && parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as { message: string }).message)
      : !response.ok
        ? `Request failed (${response.status})`
        : undefined;

  return {
    status: response.status,
    decision,
    latencyMs,
    body: parsed,
    error,
    cacheScore: scoreHeader ? Number(scoreHeader) : undefined,
    cacheMatch: response.headers.get("X-Cordon-Cache-Match") ?? undefined,
    cacheVia: response.headers.get("X-Cordon-Cache-Via") ?? undefined,
    cacheNeed: needHeader ? Number(needHeader) : undefined,
    cacheGray: grayHeader ? Number(grayHeader) : undefined,
  };
}

function extractEmbeddingVectors(embeddings: unknown): number[][] {
  if (!embeddings) {
    return [];
  }
  if (Array.isArray(embeddings)) {
    return embeddings.filter((item): item is number[] => Array.isArray(item));
  }
  if (typeof embeddings !== "object") {
    return [];
  }
  const record = embeddings as Record<string, unknown>;
  const floats = record.float ?? record.float_;
  if (Array.isArray(floats)) {
    return floats.filter((item): item is number[] => Array.isArray(item));
  }
  return [];
}

function formatEmbeddings(embeddings: unknown): string {
  const vectors = extractEmbeddingVectors(embeddings);
  if (!vectors.length) {
    return JSON.stringify(embeddings, null, 2);
  }

  const valuesPerLine = 8;
  const lines = [
    "Embedding response",
    `  vectors: ${vectors.length}`,
    `  dimensions: ${vectors[0]?.length ?? 0}`,
    "  scroll for full vector",
    "",
  ];

  vectors.forEach((vector, index) => {
    lines.push(`vector[${index}]`);
    for (let offset = 0; offset < vector.length; offset += valuesPerLine) {
      const chunk = vector
        .slice(offset, offset + valuesPerLine)
        .map((value) => value.toFixed(5))
        .join(", ");
      lines.push(`  [${offset}] ${chunk}`);
    }
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function extractReply(body: unknown): string {
  if (!body || typeof body !== "object") {
    return typeof body === "string" ? body : JSON.stringify(body, null, 2);
  }
  const record = body as Record<string, unknown>;
  const message = record.message;
  if (message && typeof message === "object") {
    const content = (message as { content?: unknown }).content;
    if (Array.isArray(content)) {
      const text = content
        .filter((part) => part && typeof part === "object" && "text" in part)
        .map((part) => String((part as { text: string }).text))
        .join("\n")
        .trim();
      if (text) return text;
    }
  }
  if (record.embeddings) {
    return formatEmbeddings(record.embeddings);
  }
  if (record.message && typeof record.message === "string") {
    return record.message;
  }
  return JSON.stringify(body, null, 2);
}
