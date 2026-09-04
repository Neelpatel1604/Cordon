from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.clients.signer import sign_request  # noqa: E402


IDENTICAL = "What is the capital of France?"
SIMILAR = [
    "What's the capital city of France?",
    "Tell me France's capital.",
    "Which city is the capital of France?",
]
NOVEL = [
    "Explain token-bucket rate limiting in one sentence.",
    "What does request coalescing mean for an API gateway?",
    "Why would a proxy cache LLM responses by embedding them?",
]


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def signed_headers(method: str, path: str, body: bytes) -> dict[str, str]:
    headers = sign_request(
        method,
        path,
        body,
        api_key=_env("CORDON_API_KEY_ID", "demo-key"),
        secret=_env("CORDON_API_KEY_SECRET", "demo-secret"),
    )
    headers["Content-Type"] = "application/json"
    return headers


async def post_chat(client: httpx.AsyncClient, base_url: str, message: str) -> tuple[int, str, float]:
    path = "/v1/chat"
    payload = json.dumps(
        {"messages": [{"role": "user", "content": message}]},
        separators=(",", ":"),
    ).encode("utf-8")
    started = time.perf_counter()
    response = await client.post(
        f"{base_url}{path}",
        content=payload,
        headers=signed_headers("POST", path, payload),
        timeout=60.0,
    )
    latency = (time.perf_counter() - started) * 1000
    return response.status_code, response.headers.get("X-Cordon-Decision", "-"), latency


async def run_wave(
    client: httpx.AsyncClient,
    base_url: str,
    label: str,
    messages: list[str],
) -> None:
    print(f"\n=== {label} ({len(messages)} requests) ===")
    results = await asyncio.gather(*[post_chat(client, base_url, message) for message in messages])
    for status, decision, latency in results:
        print(f"  {status}  decision={decision:<10}  {latency:.0f}ms")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Exercise Cordon layers with correlated traffic.")
    parser.add_argument("--base-url", default=_env("CORDON_BASE_URL", "http://127.0.0.1:8000"))
    args = parser.parse_args()

    async with httpx.AsyncClient() as client:
        health = await client.get(f"{args.base_url}/health", timeout=10.0)
        print(f"health: {health.status_code} {health.text}")

        await run_wave(client, args.base_url, "identical (coalescing)", [IDENTICAL] * 4)
        await asyncio.sleep(0.3)
        await run_wave(client, args.base_url, "semantically similar (cache)", SIMILAR)
        await run_wave(client, args.base_url, "novel (origin)", NOVEL)

        metrics = await client.get(f"{args.base_url}/v1/metrics", timeout=10.0)
        print("\n=== /v1/metrics ===")
        print(json.dumps(metrics.json(), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
