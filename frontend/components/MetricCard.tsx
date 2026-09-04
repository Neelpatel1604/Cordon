"use client";

type MetricCardProps = {
  label: string;
  value: number;
  hint: string;
  accent: string;
};

export default function MetricCard({ label, value, hint, accent }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
