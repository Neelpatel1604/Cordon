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
  };
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
    return JSON.stringify(record.embeddings, null, 2);
  }
  if (record.message && typeof record.message === "string") {
    return record.message;
  }
  return JSON.stringify(body, null, 2);
}
