# API benchmark lane

This lane measures a running disposable server. It is deliberately separate
from functional Jest and Playwright gates because wall-clock latency is not a
deterministic functional assertion.

Run it against an already-started local standalone server:

```bash
BENCHMARK_BASE_URL=http://127.0.0.1:3002 npm run benchmark:api
```

Optional controls:

- `BENCHMARK_ITERATIONS` defaults to `20`.
- `BENCHMARK_P95_LIMIT_MS` defaults to `500`.

The command exits non-zero when a request fails or a measured p95 exceeds the
configured threshold. It does not mock handlers, start services, or contact a
production host.
