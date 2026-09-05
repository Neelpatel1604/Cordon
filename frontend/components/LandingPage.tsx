import Link from "next/link";
import AuroraBackground from "@/components/AuroraBackground";
import GatewayDiagram from "@/components/GatewayDiagram";
import { CORDON_NAME, CORDON_TAGLINE } from "@/lib/brand";

const FEATURES = [
  {
    title: "Secure by default",
    body: "Every request is HMAC-signed. Invalid, expired, or replayed calls stop at the gateway.",
  },
  {
    title: "Rate limiting",
    body: "Per-API-key token bucket protects upstream quotas before traffic reaches Cohere.",
  },
  {
    title: "Request coalescing",
    body: "Identical in-flight requests share one upstream resolution instead of fanning out.",
  },
  {
    title: "Semantic cache",
    body: "Embeddings + Qdrant match paraphrased queries - not just exact string repeats.",
  },
] as const;

export default function LandingPage() {
  return (
    <>
      <AuroraBackground />
      <div className="relative mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <header className="mb-16 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">LLM gateway</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 md:text-4xl">{CORDON_NAME}</h1>
          </div>
          <Link
            href="/console"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
          >
            Open console
          </Link>
        </header>

        <section className="mb-16">
          <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-zinc-100 md:text-4xl">
            {CORDON_TAGLINE}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
            Cordon sits between your application and Cohere. It authenticates traffic, enforces limits,
            deduplicates concurrent requests, and caches semantically similar queries - so fewer calls
            reach the provider.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/console"
              className="rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              Try the live demo
            </Link>
            <a
              href="https://docs.cohere.com/reference/about"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              Cohere API docs
            </a>
          </div>
        </section>

        <section className="mb-16">
          <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Architecture</h3>
          <p className="mb-6 max-w-3xl text-sm leading-6 text-zinc-400">
            Standard three-zone layout. Clients send signed HTTPS into Cordon. The gateway owns auth, rate
            limits, coalescing, and semantic cache. Qdrant and Cohere stay outside the trust boundary.
          </p>
          <GatewayDiagram />
        </section>

        <section className="mb-16 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h3 className="text-sm font-medium text-zinc-100">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mb-16 rounded-xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
          <h3 className="text-xs uppercase tracking-[0.2em] text-zinc-500">What you will see in the console</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            The dashboard shows live gateway metrics: cache hits, coalesced requests, upstream calls, and
            per-request decisions. Send chat or embed traffic and watch how Cordon reduces load on Cohere.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="font-mono text-3xl font-semibold text-zinc-100">48</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">Requests in</p>
            </div>
            <p className="text-center font-mono text-zinc-600">{"->"}</p>
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm">
              <p className="flex justify-between text-teal-300">
                <span>Cache hits</span>
                <span>25</span>
              </p>
              <p className="flex justify-between text-violet-300">
                <span>Coalesced</span>
                <span>15</span>
              </p>
              <p className="flex justify-between text-amber-300">
                <span>Cohere calls</span>
                <span>6</span>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Example traffic mix - 42 upstream calls avoided (87.5% reduction)
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
          <h3 className="text-sm font-medium text-zinc-100">Semantic cache demo</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Send a question once, then send a paraphrase. Cordon matches meaning via embeddings - not exact
            strings.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-400">
              What is the capital of France?
            </div>
            <div className="rounded-lg border border-teal-900/40 bg-teal-950/20 p-3 font-mono text-xs text-teal-200">
              Which city is France&apos;s capital?
              <span className="mt-2 block text-[10px] uppercase tracking-wider text-teal-400/80">
                {"->"} semantic cache hit
              </span>
            </div>
          </div>
          <Link
            href="/console"
            className="mt-6 inline-block text-sm text-zinc-300 underline decoration-zinc-600 underline-offset-4 hover:text-zinc-100"
          >
            Run this in the console
          </Link>
        </section>

        <footer className="mt-16 border-t border-zinc-800 pt-8 text-center text-xs text-zinc-600">
          {CORDON_NAME}. {CORDON_TAGLINE}
        </footer>
      </div>
    </>
  );
}
