# Release fingerprint build contract

Production builds require one non-secret input:

```bash
NEXUS_RELEASE_SOURCE_SHA="$(git rev-parse HEAD)" npm run build
```

`NEXUS_RELEASE_SOURCE_SHA` must be the exact lowercase 40-hex source commit used for the build. The build derives both `SERVER_RELEASE_SHA` and `CLIENT_RELEASE_SHA` from that single value. These derived values must never be supplied independently.

Production builds fail closed when the source value is absent, malformed, uppercase, padded, or shortened. Development, tests, and the governed E2E build use the explicit all-zero 40-hex fingerprint when no source SHA is supplied. An explicitly supplied malformed value always fails.

The fingerprint is not a secret. It must not contain a branch, filesystem path, release directory, token, environment value, or generated artifact hash. No generated fingerprint file is committed, avoiding a self-referential commit SHA.
