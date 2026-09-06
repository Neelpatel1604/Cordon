"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AuroraBackground from "@/components/AuroraBackground";
import MetricCard from "@/components/MetricCard";
import PipelineTrace from "@/components/PipelineTrace";
import { CORDON_NAME, CORDON_TAGLINE } from "@/lib/brand";
import { CORDON_URL, extractReply, fetchHealth, fetchMetrics, signedPost } from "@/lib/api";
import type { Decision, Endpoint, HealthResponse, MetricsResponse, PlayResult } from "@/lib/types";

const DEFAULT_PROMPT = "What is the capital of France?";
const PARAPHRASE_PROMPT = "Tell me capital of france";

const DECISION_STYLE: Record<Decision, string> = {
  origin: "border-amber-800 bg-amber-950 text-amber-200",
  cache: "border-teal-800 bg-teal-950 text-teal-200",
  coalesced: "border-violet-800 bg-violet-950 text-violet-200",
  auth_rejected: "border-rose-800 bg-rose-950 text-rose-200",
  rate_limited: "border-orange-800 bg-orange-950 text-orange-200",
  error: "border-zinc-700 bg-zinc-900 text-zinc-300",
};

function freshBurstPrompt(): string {
  return `Coalesce burst ${Date.now().toString(36)}: name one European capital.`;
}

const PRESETS: { label: string; text: string | (() => string) }[] = [
  { label: "Default", text: DEFAULT_PROMPT },
  { label: "Paraphrase", text: PARAPHRASE_PROMPT },
  { label: "Burst seed", text: freshBurstPrompt },
];

function summarizeBurst(results: PlayResult[]) {
  return results.reduce(
    (acc, item) => {
      acc[item.decision] = (acc[item.decision] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [endpoint, setEndpoint] = useState<Endpoint>("chat");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [lastSentPrompt, setLastSentPrompt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<PlayResult | null>(null);
  const [burst, setBurst] = useState<PlayResult[]>([]);
  const [healthError, setHealthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextHealth, nextMetrics] = await Promise.all([fetchHealth(), fetchMetrics()]);
      setHealth(nextHealth);
      setMetrics(nextMetrics);
      setHealthError(null);
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Backend unreachable");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const runOne = useCallback(
    async (text: string, options?: { signed?: boolean; nextEndpoint?: Endpoint }) => {
      const usedEndpoint = options?.nextEndpoint ?? endpoint;
      const path = usedEndpoint === "chat" ? "/v1/chat" : "/v1/embed";
      const body =
        usedEndpoint === "chat"
          ? { messages: [{ role: "user", content: text }] }
          : { texts: [text] };
      return signedPost(path, body, { signed: options?.signed });
    },
    [endpoint],
  );

  const handleSend = async (text = prompt) => {
    const query = text.trim();
    if (!query) {
      return;
    }
    setBusy(true);
    setBurst([]);
    setLastSentPrompt(query);
    try {
      const result = await runOne(query);
      setLast(result);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleBurst = async () => {
    const base = prompt.trim() || "Name one European capital.";
    const burstText = `${base} [burst-${Date.now().toString(36)}]`;
    setPrompt(burstText);
    setLastSentPrompt(burstText);
    setBusy(true);
    try {
      const results = await Promise.all(Array.from({ length: 4 }, () => runOne(burstText)));
      setBurst(results);
      setLast(results[0] ?? null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleUnsigned = async () => {
    const query = prompt.trim();
    if (!query) {
      return;
    }
    setBusy(true);
    setBurst([]);
    setLastSentPrompt(query);
    try {
      const result = await runOne(query, { signed: false });
      setLast(result);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const chartData = useMemo(
    () => [
      { name: "Cache", value: metrics?.cache_hits ?? 0, fill: "#5eead4" },
      { name: "Origin", value: metrics?.cohere_calls ?? 0, fill: "#fbbf24" },
      { name: "Coalesced", value: metrics?.coalesced ?? 0, fill: "#a78bfa" },
      { name: "Auth 401", value: metrics?.auth_rejected ?? 0, fill: "#fb7185" },
      { name: "429", value: metrics?.rate_limited ?? 0, fill: "#fb923c" },
    ],
    [metrics],
  );

  const burstSummary = burst.length ? summarizeBurst(burst) : null;
  const online = health?.status === "ok" && health.qdrant;

  return (
    <>
      <AuroraBackground />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-6 md:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Gateway console</p>
            <Link href="/" className="group inline-block">
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 transition-colors group-hover:text-white md:text-5xl">
                {CORDON_NAME}
              </h1>
            </Link>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{CORDON_TAGLINE}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
            >
              Back to home
            </Link>
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-teal-500" : "bg-rose-400"}`} />
              <span className="text-zinc-200">{online ? "Backend live" : "Backend offline"}</span>
              <span className="text-zinc-600">|</span>
              <span className="font-mono text-xs text-zinc-400">{CORDON_URL}</span>
            </div>
          </div>
        </header>

        {healthError ? (
          <div className="rounded-lg border border-rose-800 bg-rose-950 px-4 py-3 text-sm text-rose-100">
            {healthError}. Keep `docker compose up` running, then refresh.
          </div>
        ) : null}

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-zinc-100">Playground</h2>
              <div className="flex rounded-md border border-zinc-800 p-0.5">
                {(["chat", "embed"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setEndpoint(item)}
                    className={`rounded px-3 py-1 text-xs uppercase tracking-wider ${
                      endpoint === item ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <label className="mb-2 block text-xs uppercase tracking-wider text-zinc-500" htmlFor="playground-query">
              Query
            </label>
            <textarea
              id="playground-query"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !busy) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={4}
              placeholder={
                endpoint === "chat"
                  ? "Type a message to send through Cordon..."
                  : "Type text to embed through Cordon..."
              }
              className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setPrompt(typeof preset.text === "function" ? preset.text() : preset.text)
                  }
                  className="rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton disabled={busy || !prompt.trim()} onClick={() => void handleSend()}>
                {busy ? "Sending..." : "Send signed"}
              </ActionButton>
              <ActionButton disabled={busy || !prompt.trim()} onClick={() => void handleSend(prompt)}>
                Send again
              </ActionButton>
              <ActionButton disabled={busy || !prompt.trim()} onClick={() => void handleBurst()}>
                Burst x4
              </ActionButton>
              <ActionButton disabled={busy || !prompt.trim()} tone="danger" onClick={() => void handleUnsigned()}>
                Unsigned
              </ActionButton>
            </div>
          </section>

          <section className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-medium text-zinc-100">Last response</h2>
              {last ? (
                <span className={`shrink-0 rounded-md border px-3 py-1 text-xs uppercase tracking-wider ${DECISION_STYLE[last.decision]}`}>
                  {last.decision.replace("_", " ")} - {Math.round(last.latencyMs)}ms
                </span>
              ) : null}
            </div>
            {lastSentPrompt ? (
              <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">Sent query</span>
                  {lastSentPrompt !== prompt ? (
                    <button
                      type="button"
                      onClick={() => setPrompt(lastSentPrompt)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      Restore to editor
                    </button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap font-mono text-xs leading-5 text-zinc-400">{lastSentPrompt}</p>
              </div>
            ) : null}
            {last ? <SimilarityPanel result={last} /> : null}
            <div
              className={`flex h-64 max-h-64 flex-col overflow-hidden rounded-lg border bg-zinc-900 ${
                last?.decision === "rate_limited"
                  ? "border-orange-900/50"
                  : last?.error
                    ? "border-rose-900/50"
                    : "border-zinc-800"
              }`}
            >
              <pre
                className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-sm leading-6 ${
                  last?.decision === "rate_limited"
                    ? "text-orange-200"
                    : last?.error
                      ? "text-rose-200"
                      : "text-zinc-200"
                }`}
              >
                {last
                  ? last.error
                    ? last.error
                    : extractReply(last.body)
                  : "Send a request to see the reply and which layer served it."}
              </pre>
              {last ? (
                <PipelineTrace
                  decision={last.decision}
                  status={last.status}
                  cacheScore={last.cacheScore}
                  cacheMatch={last.cacheMatch}
                  cacheVia={last.cacheVia}
                />
              ) : null}
            </div>
            {burstSummary ? (
              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Burst breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(burstSummary).map(([name, count]) => (
                    <span
                      key={name}
                      className={`rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-wider ${DECISION_STYLE[name as Decision] ?? DECISION_STYLE.error}`}
                    >
                      {name} x{count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Cache hits" value={metrics?.cache_hits ?? 0} hint="Served from Qdrant" accent="#5eead4" />
          <MetricCard label="Cohere calls" value={metrics?.cohere_calls ?? 0} hint="Real upstream" accent="#fbbf24" />
          <MetricCard label="Coalesced" value={metrics?.coalesced ?? 0} hint="Shared in-flight" accent="#a78bfa" />
          <MetricCard label="Auth rejected" value={metrics?.auth_rejected ?? 0} hint="Bad / missing HMAC" accent="#fb7185" />
          <MetricCard label="Rate limited" value={metrics?.rate_limited ?? 0} hint="Token bucket empty" accent="#fb923c" />
          <MetricCard
            label="p50 / p99"
            value={Math.round(metrics?.latency_ms.p50 ?? 0)}
            hint={`${Math.round(metrics?.latency_ms.p99 ?? 0)}ms p99 - ${metrics?.latency_ms.count ?? 0} samples`}
            accent="#93c5fd"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-4 text-lg font-medium text-zinc-100">Layer mix</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-medium text-zinc-100">Request log</h2>
              <span className="text-xs text-zinc-500">from GET /v1/metrics</span>
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Endpoint</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-5 py-2 font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics?.recent ?? []).map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`} className="border-t border-zinc-800 text-zinc-300">
                      <td className="px-5 py-2 font-mono text-xs text-zinc-400">
                        {new Date(entry.timestamp * 1000).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2">{entry.endpoint}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] uppercase ${DECISION_STYLE[(entry.decision as Decision) || "error"]}`}>
                          {entry.decision}
                        </span>
                      </td>
                      <td className="px-5 py-2 font-mono text-xs">{entry.latency_ms.toFixed(0)}ms</td>
                    </tr>
                  ))}
                  {!metrics?.recent.length ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                        No traffic yet. Send a signed request.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function SimilarityPanel({ result }: { result: PlayResult }) {
  const score = result.cacheScore;
  const need = result.cacheNeed ?? 0.82;
  const gray = result.cacheGray ?? 0.7;
  const empty = result.cacheVia === "empty";
  const hit = result.decision === "cache" || result.decision === "coalesced";

  let verdict = "No neighbor in Qdrant yet. Send a matching question first to warm the cache.";
  if (!empty && score !== undefined && Number.isFinite(score)) {
    if (hit) {
      verdict = `Hit. Score ${score.toFixed(3)} met the bar.`;
    } else if (score >= need) {
      verdict = `Score ${score.toFixed(3)} is above ${need.toFixed(2)} but still missed. Check logs.`;
    } else if (score >= gray) {
      verdict = `Gray zone. ${score.toFixed(3)} is below hit ${need.toFixed(2)}. Rerank did not accept it.`;
    } else {
      verdict = `Miss. ${score.toFixed(3)} is below gray ${gray.toFixed(2)} (hit needs ${need.toFixed(2)}).`;
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Similarity</p>
      <p className="font-mono text-sm text-zinc-200">
        {empty || score === undefined || !Number.isFinite(score)
          ? "no neighbors"
          : `${score.toFixed(3)}  (hit >= ${need.toFixed(2)}, gray >= ${gray.toFixed(2)})`}
      </p>
      {result.cacheMatch ? (
        <p className="mt-1 font-mono text-[11px] text-zinc-500">nearest: {result.cacheMatch}</p>
      ) : null}
      <p className="mt-1 text-[11px] leading-5 text-zinc-500">{verdict}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-medium uppercase tracking-wider disabled:opacity-40 ${
        tone === "danger"
          ? "border-rose-900 bg-rose-950 text-rose-200 hover:bg-rose-900"
          : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
