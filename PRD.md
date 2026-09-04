# PRD: Cordon
### A gateway that makes serving Cohere's API cheaper, safer, and more resilient

**Author:** [Your Name]
**Status:** Draft v2

---

## 1. What This Is

Cordon is a proxy layer that sits in front of Cohere's API (Chat, Embed, Rerank). It is built **on top of Cohere's own product** — not a claim about what Cohere itself is missing — as a way to demonstrate, hands-on, the class of problems a platform team handles when serving a model API reliably at scale: fair usage, cost control, and request trust.

Every request to Cohere passes through four layers before it's actually sent:

```
Client request
      │
      ▼
① Signed-Request Auth      → reject invalid or replayed signatures
      │
      ▼
② Token-Bucket Rate Limiter → reject if the caller's key is out of budget
      │
      ▼
③ Semantic Cache Lookup     → return a cached answer if a similar request was seen recently
      │  (cache miss)
      ▼
④ Coalescing Check          → if an identical request is already in-flight, wait and share its result
      │  (no in-flight duplicate)
      ▼
⑤ Real call to Cohere API   → actual Chat / Embed / Rerank call
      │
      ▼
⑥ Store result in cache + release any coalesced waiters
      │
      ▼
Response returned to client
```

---

## 2. Goals

| Goal | Success Criteria |
|---|---|
| Cost reduction | Measurable % of requests served without hitting Cohere (via cache + coalescing) |
| Fair usage / stability | No key can exceed its token bucket, verified under concurrent load |
| Security | Tampered or replayed requests are rejected before reaching any other layer |
| Correctness under concurrency | No race conditions in rate limiting or coalescing, proven via load test |
| No mocks | Every layer runs against a real Cohere API key and a real running vector DB |

### Non-Goals
- Multi-region / distributed deployment (single-node is fine)
- A UI/dashboard beyond basic metrics output
- Supporting every Cohere endpoint (Chat + Embed is enough to prove the pattern)
- A general-purpose auth system (signing scheme is intentionally simple, not OAuth-scale)

---

## 3. Where Cohere Is Used

Two distinct roles, both live:

1. **The protected backend** — Layer ⑤ makes real calls to Cohere's `chat` and `embed` endpoints.
2. **Inside Cordon itself** — the semantic cache (Layer ③) uses Cohere's `embed` endpoint to vectorize incoming requests, so "is this request similar to one I've already answered" is itself a Cohere-powered decision.

---

## 4. Component Breakdown

### 4.1 Signed-Request Auth
- HMAC-SHA256 signing of each request (shared secret per API key)
- Signature includes timestamp + nonce
- Requests outside a time window, or with a previously-seen nonce, are rejected (replay protection)

### 4.2 Token-Bucket Rate Limiter
- One bucket per API key, fixed capacity, fixed refill rate
- Must be correct under concurrent access — no double-spending the last token under simultaneous requests
- Rejected requests return a clear 429 with retry-after

### 4.3 Semantic Cache
- Incoming request text → Cohere `embed` → vector
- Compare against stored vectors (cosine similarity) in the vector DB
- Above a similarity threshold → return cached response
- Below threshold → cache miss, proceed to coalescing/real call
- Eviction: TTL-based expiry, plus a max-size cap with LRU eviction

### 4.4 Request Coalescing
- Requests are hashed (on exact content, separate from the semantic cache)
- If an identical request is already in flight, the new caller attaches to the pending result instead of issuing a new Cohere call
- Implemented via a shared future/promise keyed by request hash, with correct cleanup after resolution

### 4.5 Metrics & Load Test
- Track: cache hit rate, coalesced-request rate, requests actually reaching Cohere, rate-limit rejections, p50/p99 latency
- A load-testing script fires concurrent, partially-overlapping requests (some identical, some semantically similar, some novel) and reports these metrics with each layer toggled on/off, to show each component's individual contribution

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language / backend framework | Python + FastAPI | Async-native, good fit for I/O-bound gateway work, fast to build and test |
| LLM API | Cohere (Chat, Embed) | The system being protected and the embedding source for the cache |
| Vector DB | **Qdrant** (self-hosted via Docker) | Open-source, no managed-cloud signup needed, documented native Cohere integration, fast enough for real load-test numbers, runs fully live with zero cost |
| Rate limiting | Custom token-bucket implementation (Python, asyncio-safe) | Built from scratch intentionally — the algorithm correctness under concurrency is the point |
| Coalescing | Custom in-memory future/promise registry (asyncio) | Same reasoning — this is the core "real engineering" component |
| Auth | Custom HMAC signing/verification | Standard pattern (same idea as AWS SigV4), implemented directly rather than pulled from a library |
| Load testing | Locust or a custom asyncio load script | Needs to generate concurrent, correlated (some identical/similar) request patterns, which generic load tools don't do out of the box |
| Containerization | Docker Compose | One-command run: Cordon + Qdrant together |

---

## 6. Frontend (Dashboard)

A minimal Next.js dashboard, secondary to the core gateway, gives live visibility into what Cordon is doing — useful for demoing the system without reading logs.

**Scope (kept intentionally thin):**
- Single page, no auth, no routing complexity
- Polls Cordon's `/metrics` endpoint (or a WebSocket, if time allows) and displays:
  - Requests per layer: rejected (auth), rejected (rate limit), cache hits, coalesced, real Cohere calls
  - Live latency (p50/p99)
  - A running request log/table (timestamp, decision, layer, latency)
- Built with Next.js + a lightweight chart library (e.g. Recharts)
- Purely a read layer — no logic lives here; all decisions and state stay in the backend

**Why it's scoped this way:** the dashboard exists to make the backend's behavior legible at a glance, not to be a product surface in its own right. The engineering substance of the project remains the gateway itself — the UI should take a fraction of the total build effort.

---

## 7. Risks & Open Questions

- Cohere's rate limits on a trial API key may cap how much real load-testing is possible — plan the load test around trial-tier limits, or budget for a small amount of paid usage
- Semantic similarity threshold tuning (too loose → wrong cached answers served; too tight → cache barely helps) needs to be empirically tuned and reported, not just assumed
- Coalescing only helps for genuinely concurrent duplicate requests — the load test must be designed to actually produce that pattern, or this component will show no effect

---

## 8. How This Gets Framed

Cordon is described as **built on Cohere's API**, not **for Cohere** — it is a self-directed project to understand, through direct implementation, the scaling and security problems named in Cohere's own engineering responsibilities (serving an API at scale, building security features on a platform), not a claim to have solved something Cohere's own platform team hasn't already handled at a much larger scale.