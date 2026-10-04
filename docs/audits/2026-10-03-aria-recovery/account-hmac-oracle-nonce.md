# Independent token oracle and encrypted-handoff nonce

2026-10-05. The deterministic test entropy spy previously returned 32 bytes
for every randomBytes call. Encrypted handoff issuance also requires a 12-byte
AES-GCM nonce; the test replaced that nonce incorrectly. RED proof 1791154985:
2 failed / 98 passed. The spy now controls only the 32-byte token entropy and
delegates other lengths to the original CSPRNG. Assertions require one token
generation and one nonce generation; the independent HMAC digest oracle and
raw-token comparison remain intact. GREEN proof 1791155199: 12 suites / 110
tests on disposable PostgreSQL. This changes no production crypto primitive
and does not dismiss or suppress any CodeQL alert.
