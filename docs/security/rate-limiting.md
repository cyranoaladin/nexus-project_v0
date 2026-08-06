# Rate limiting

La specification canonique, la matrice des routes, le contrat Redis, la politique HMAC et le rollback sont documentes dans [distributed-rate-limiting.md](./distributed-rate-limiting.md).

Les anciens exemples Upstash et les fallbacks implicites ne sont plus supportes. En production, `RATE_LIMIT_BACKEND=redis` est obligatoire et toute indisponibilite est traitee en fail-closed.
