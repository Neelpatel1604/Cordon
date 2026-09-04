"use client";

import { motion } from "framer-motion";
import type { Decision } from "@/lib/types";

const STEPS = [
  { id: "auth", label: "Auth", detail: "HMAC + nonce" },
  { id: "rate", label: "Rate", detail: "Token bucket" },
  { id: "cache", label: "Cache", detail: "Qdrant match" },
  { id: "coal", label: "Coalesce", detail: "Share in-flight" },
  { id: "origin", label: "Cohere", detail: "Live API" },
] as const;

type StepState = "idle" | "pass" | "active" | "fail" | "skip";

function statesFor(decision: Decision | null): StepState[] {
  if (!decision) return ["idle", "idle", "idle", "idle", "idle"];
  if (decision === "auth_rejected") return ["fail", "skip", "skip", "skip", "skip"];
  if (decision === "rate_limited") return ["pass", "fail", "skip", "skip", "skip"];
  if (decision === "cache") return ["pass", "pass", "active", "skip", "skip"];
  if (decision === "coalesced") return ["pass", "pass", "pass", "active", "skip"];
  if (decision === "origin") return ["pass", "pass", "pass", "pass", "active"];
  return ["fail", "skip", "skip", "skip", "skip"];
}

function progressFor(states: StepState[]): number {
  let last = 0;
  states.forEach((state, index) => {
    if (state === "pass" || state === "active" || state === "fail") {
      last = index;
    }
  });
  return last / (STEPS.length - 1);
}

const CAPTION: Record<string, string> = {
  idle: "Send a request to light up the path",
  origin: "Missed cache — paid a real Cohere call",
  cache: "Similar request — served from Qdrant",
  coalesced: "Duplicate in flight — shared one Cohere call",
  auth_rejected: "Stopped at HMAC — missing or bad signature",
  rate_limited: "Stopped at the token bucket",
  error: "Request failed before a clean decision",
};

export default function PipelineRail({ decision }: { decision: Decision | null }) {
  const states = statesFor(decision);
  const progress = decision ? progressFor(states) : 0;
  const caption = CAPTION[decision ?? "idle"];

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-5 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Request path</p>
          <p className="mt-1 text-sm text-zinc-300">{caption}</p>
        </div>
        {decision ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-300">
            {decision.replace("_", " ")}
          </span>
        ) : null}
      </div>

      <div className="relative px-2 sm:px-6">
        <div className="absolute top-4 right-[10%] left-[10%] h-px bg-white/10" />
        <motion.div
          className="absolute top-4 left-[10%] h-px origin-left bg-gradient-to-r from-teal-400 to-sky-400"
          initial={false}
          animate={{
            width: `${progress * 80}%`,
            opacity: decision ? 1 : 0.25,
          }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        />

        <ol className="relative grid grid-cols-5">
          {STEPS.map((step, index) => {
            const state = states[index];
            return (
              <li key={step.id} className="flex flex-col items-center text-center">
                <motion.span
                  initial={false}
                  animate={{
                    scale: state === "active" || state === "fail" ? 1.08 : 1,
                    backgroundColor:
                      state === "fail"
                        ? "#fb7185"
                        : state === "active"
                          ? "#5eead4"
                          : state === "pass"
                            ? "#134e4a"
                            : "#111827",
                    borderColor:
                      state === "fail"
                        ? "#fb7185"
                        : state === "active"
                          ? "#5eead4"
                          : state === "pass"
                            ? "#2dd4bf"
                            : "rgba(255,255,255,0.16)",
                    color:
                      state === "active" || state === "fail" ? "#041016" : "#d4d4d8",
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold"
                >
                  {index + 1}
                </motion.span>
                <p className="mt-3 text-xs font-medium text-zinc-100 sm:text-sm">{step.label}</p>
                <p className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">{step.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
