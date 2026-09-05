"use client";

import type { Decision } from "@/lib/types";

const STEPS = [
  { id: "auth", label: "auth" },
  { id: "rate", label: "rate" },
  { id: "coal", label: "coalesce" },
  { id: "cache", label: "cache" },
  { id: "origin", label: "cohere" },
] as const;

type StepState = "idle" | "pass" | "active" | "fail" | "skip";

function statesFor(decision: Decision | null): StepState[] {
  if (!decision) return ["idle", "idle", "idle", "idle", "idle"];
  if (decision === "auth_rejected") return ["fail", "skip", "skip", "skip", "skip"];
  if (decision === "rate_limited") return ["pass", "fail", "skip", "skip", "skip"];
  if (decision === "coalesced") return ["pass", "pass", "active", "skip", "skip"];
  if (decision === "cache") return ["pass", "pass", "pass", "active", "skip"];
  if (decision === "origin") return ["pass", "pass", "pass", "pass", "active"];
  if (decision === "error") return ["pass", "pass", "pass", "pass", "fail"];
  return ["fail", "skip", "skip", "skip", "skip"];
}

const DEFAULT_NOTE: Record<Decision, string> = {
  origin: "Cache miss. One Cohere call.",
  cache: "Semantic hit in Qdrant.",
  coalesced: "Shared an in-flight duplicate.",
  auth_rejected: "Rejected before upstream.",
  rate_limited: "Token bucket empty.",
  error: "Request failed before a clean response.",
};

function isFailure(decision: Decision): boolean {
  return decision === "auth_rejected" || decision === "rate_limited" || decision === "error";
}

function failureTone(decision: Decision): "rose" | "orange" {
  return decision === "rate_limited" ? "orange" : "rose";
}

function stepClass(state: StepState, decision: Decision): string {
  const tone = failureTone(decision);
  if (state === "active") {
    return isFailure(decision)
      ? tone === "orange"
        ? "font-medium text-orange-400"
        : "font-medium text-rose-400"
      : "font-medium text-teal-400";
  }
  if (state === "fail") {
    return tone === "orange" ? "font-medium text-orange-400" : "font-medium text-rose-400";
  }
  if (state === "pass") return "text-zinc-400";
  if (state === "skip") return "text-zinc-500";
  return "text-zinc-500";
}

function arrowClass(from: StepState, to: StepState, decision: Decision): string {
  const tone = failureTone(decision);
  if (to === "fail" || (isFailure(decision) && to === "active")) {
    return tone === "orange" ? "text-orange-900" : "text-rose-800";
  }
  if (to === "active") return "text-teal-700";
  if (from === "skip" || to === "skip") return "text-zinc-600";
  return "text-zinc-500";
}

function footerClass(decision: Decision): string {
  if (decision === "rate_limited") {
    return "border-orange-900/50 bg-orange-950/25 text-orange-100/90";
  }
  if (isFailure(decision)) {
    return "border-rose-900/50 bg-rose-950/25 text-rose-100/90";
  }
  return "border-zinc-800/60 text-zinc-300";
}

function noteClass(decision: Decision): string {
  if (decision === "rate_limited") return "text-orange-200/80";
  if (isFailure(decision)) return "text-rose-200/80";
  return "text-zinc-500";
}

function footerNote(
  decision: Decision,
  status?: number,
  cacheScore?: number,
  cacheMatch?: string,
  cacheVia?: string,
): string {
  const base = DEFAULT_NOTE[decision];
  const bits: string[] = [];
  if (status && isFailure(decision)) {
    bits.push(String(status));
  }
  bits.push(base);
  if (cacheScore !== undefined && Number.isFinite(cacheScore)) {
    bits.push(`score ${cacheScore.toFixed(2)}`);
  }
  if (cacheVia) {
    bits.push(cacheVia);
  }
  if (cacheMatch) {
    bits.push(`matched "${cacheMatch}"`);
  }
  return bits.join(" · ");
}

type PipelineTraceProps = {
  decision: Decision | null;
  status?: number;
  cacheScore?: number;
  cacheMatch?: string;
  cacheVia?: string;
};

export default function PipelineTrace({
  decision,
  status,
  cacheScore,
  cacheMatch,
  cacheVia,
}: PipelineTraceProps) {
  if (!decision) {
    return null;
  }

  const states = statesFor(decision);
  const note = footerNote(decision, status, cacheScore, cacheMatch, cacheVia);

  return (
    <p className={`border-t px-4 py-2 font-mono text-[11px] leading-5 ${footerClass(decision)}`}>
      {STEPS.map((step, index) => (
        <span key={step.id}>
          {index > 0 ? (
            <span className={arrowClass(states[index - 1], states[index], decision)}>{" -> "}</span>
          ) : null}
          <span className={stepClass(states[index], decision)}>{step.label}</span>
        </span>
      ))}
      {note ? <span className={noteClass(decision)}> · {note}</span> : null}
    </p>
  );
}
