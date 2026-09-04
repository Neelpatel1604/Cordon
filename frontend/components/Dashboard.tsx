"use client";

import { AnimatePresence, motion } from "framer-motion";
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
import PipelineRail from "@/components/PipelineRail";
import { CORDON_URL, extractReply, fetchHealth, fetchMetrics, signedPost } from "@/lib/api";
import type { Decision, Endpoint, HealthResponse, MetricsResponse, PlayResult } from "@/lib/types";

const PROMPTS = {
  identical: "What is the capital of France?",
  similar: "What's the capital city of France?",
  novel: "Explain token-bucket rate limiting in one sentence.",
};

const DECISION_STYLE: Record<Decision, string> = {
  origin: "bg-amber-400/15 text-amber-200 border-amber-300/30",
  cache: "bg-teal-400/15 text-teal-200 border-teal-300/30",
  coalesced: "bg-violet-400/15 text-violet-200 border-violet-300/30",
  auth_rejected: "bg-rose-400/15 text-rose-200 border-rose-300/30",
  rate_limited: "bg-orange-400/15 text-orange-200 border-orange-300/30",
  error: "bg-zinc-400/15 text-zinc-200 border-zinc-300/30",
};

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [endpoint, setEndpoint] = useState<Endpoint>("chat");
  const [prompt, setPrompt] = useState(PROMPTS.identical);
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
    const timer = window.setInterval(() => {
      void refresh();
    }, 1500);
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
    setBusy(true);
    setBurst([]);
    try {
      const result = await runOne(text);
      setLast(result);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleBurst = async () => {
    setBusy(true);
    try {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => runOne(PROMPTS.identical)),
      );
      setBurst(results);
      setLast(results[0] ?? null);
      setPrompt(PROMPTS.identical);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleUnsigned = async () => {
    setBusy(true);
    setBurst([]);
    try {
      const result = await runOne(prompt, { signed: false });
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

  const online = health?.status === "ok" && health.qdrant;

  return (
    <>
      <AuroraBackground />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-6 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Gateway console
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 md:text-5xl">
              Cordon
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Send signed Chat and Embed traffic through the live backend. Watch auth, rate limits,
              cache hits, coalescing, and real Cohere calls.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${online ? "bg-teal-500" : "bg-rose-400"}`} />
            <span className="text-zinc-200">{online ? "Backend live" : "Backend offline"}</span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono text-xs text-zinc-400">{CORDON_URL}</span>
          </div>
        </header>

        {healthError ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {healthError}. Keep `docker compose up` running, then refresh.
          </div>
        ) : null}

        <PipelineRail decision={last?.decision ?? null} />

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-white">Playground</h2>
              <div className="flex rounded-full bg-black/30 p-1">
                {(["chat", "embed"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setEndpoint(item)}
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider transition ${
                      endpoint === item ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none ring-teal-300/30 focus:ring-2"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton disabled={busy} onClick={() => void handleSend()}>
                {busy ? "Sending…" : "Send signed"}
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => void handleSend(prompt)}>
                Send again (cache)
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => void handleBurst()}>
                Burst ×4 (coalesce)
              </ActionButton>
              <ActionButton
                disabled={busy}
                onClick={() => {
                  setPrompt(PROMPTS.similar);
                  void handleSend(PROMPTS.similar);
                }}
              >
                Paraphrase (cache)
              </ActionButton>
              <ActionButton
                disabled={busy}
                onClick={() => {
                  setPrompt(PROMPTS.novel);
                  void handleSend(PROMPTS.novel);
                }}
              >
                Novel (origin)
              </ActionButton>
              <ActionButton disabled={busy} tone="danger" onClick={() => void handleUnsigned()}>
                Unsigned (401)
              </ActionButton>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              First send should be <span className="text-amber-200">origin</span>. The same text
              again should be <span className="text-teal-200">cache</span>. Four at once should show
              some <span className="text-violet-200">coalesced</span>.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-5"
          >
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-white">Last response</h2>
              {last ? (
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${DECISION_STYLE[last.decision]}`}>
                  {last.decision.replace("_", " ")} · {Math.round(last.latencyMs)}ms
                </span>
              ) : null}
            </div>
            <AnimatePresence mode="wait">
              <motion.pre
                key={`${last?.status}-${last?.decision}-${last?.latencyMs}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="h-64 max-w-full overflow-x-auto overflow-y-auto whitespace-pre rounded-lg bg-zinc-900 p-4 font-mono text-sm leading-6 text-zinc-200"
              >
                {last
                  ? last.error
                    ? last.error
                    : extractReply(last.body)
                  : "Send a request to see the Cohere reply and which layer served it."}
              </motion.pre>
            </AnimatePresence>
            {burst.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {burst.map((item, index) => (
                  <span
                    key={`${item.decision}-${index}`}
                    className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wider ${DECISION_STYLE[item.decision]}`}
                  >
                    #{index + 1} {item.decision}
                  </span>
                ))}
              </div>
            ) : null}
          </motion.section>
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
            hint={`${Math.round(metrics?.latency_ms.p99 ?? 0)}ms p99 · ${metrics?.latency_ms.count ?? 0} samples`}
            accent="#93c5fd"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-4 text-lg font-medium text-white">Layer mix</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#0b0f19",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-medium text-white">Request log</h2>
              <span className="text-xs text-zinc-500">from GET /v1/metrics</span>
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#0b0f19]/90 text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Endpoint</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-5 py-2 font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics?.recent ?? []).map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`} className="border-t border-white/5 text-zinc-300">
                      <td className="px-5 py-2 font-mono text-xs text-zinc-400">
                        {new Date(entry.timestamp * 1000).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2">{entry.endpoint}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase ${DECISION_STYLE[(entry.decision as Decision) || "error"]}`}>
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
