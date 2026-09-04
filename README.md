# Cordon

A gateway in front of [Cohere's API](https://docs.cohere.com/reference/about). Every Chat or Embed request is signed, rate-limited, checked against a semantic cache (Qdrant + Cohere Embed), and coalesced if an identical call is already in flight.

```
Client → HMAC auth → token bucket → semantic cache → coalescing → Cohere
```

The Next.js console at `frontend/` lets you drive Chat/Embed and watch cache, coalescing, and metrics live.

## Prerequisites

- Python 3.12+
- Docker (for Qdrant, or the full stack)
- A Cohere API key from [the dashboard](https://dashboard.cohere.com/api-keys)

## Setup

```powershell
cd C:\Users\patel\Downloads\side-projects\Cordon
copy .env.example .env
```

Put your Cohere key in `.env`:

```
COHERE_API_KEY=your_key_here
CORDON_API_KEYS=demo-key:demo-secret
```

## Run

Qdrant plus the gateway:

```powershell
docker compose up --build
```

Or run Qdrant in Docker and the API locally:

```powershell
docker compose up qdrant
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health: `GET http://127.0.0.1:8000/health`
- Chat: `POST http://127.0.0.1:8000/v1/chat`
- Embed: `POST http://127.0.0.1:8000/v1/embed`
- Metrics: `GET http://127.0.0.1:8000/v1/metrics`

Successful proxy responses include `X-Cordon-Decision: cache | coalesced | origin`.

## Frontend console

Keep the backend running, then:

```powershell
cd C:\Users\patel\Downloads\side-projects\Cordon\frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI signs requests as `demo-key` / `demo-secret` and talks to `http://127.0.0.1:8000`.

Try this order:

1. **Send signed** — first call should show `origin`
2. **Send again** — same prompt should show `cache`
3. **Burst ×4** — at least one `coalesced`
4. **Unsigned** — `401`
5. Watch the pipeline rail, counters, and request log update

## Signed requests

Cordon rejects unsigned, expired, or replayed calls. Canonical string:

```
{METHOD}
{path}
{timestamp}
{nonce}
{sha256(raw_body)}
```

`X-Signature` is `hex(HMAC-SHA256(secret, canonical))`. From `backend/`:

```python
import json
from app.clients.signer import sign_request

body = json.dumps({"messages": [{"role": "user", "content": "hello"}]}).encode()
headers = sign_request("POST", "/v1/chat", body, "demo-key", "demo-secret")
```

## Tests

```powershell
cd backend
pytest
```

These cover HMAC (valid / expired / replay / tamper), concurrent token-bucket last-token, coalescing, and cache threshold hit/miss. They do not call Cohere.

## Load script

Needs a running gateway and a real `COHERE_API_KEY`. Concurrency is modest for trial-tier limits.

```powershell
cd backend
python scripts/load_test.py --base-url http://127.0.0.1:8000
```

The script fires identical requests (coalescing), paraphrases (semantic cache), and novel prompts, then prints `/v1/metrics`.

## Layout

```
backend/app/
  api/          HTTP routes only
  layers/       auth, rate limit, cache, coalescer
  pipeline/     request path through those layers
  services/     Cohere, Qdrant, metrics
  clients/      HMAC request signer
  schemas/      request/response models
```
