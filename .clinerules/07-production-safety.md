# Production Safety

## Never do this without explicit approval

- deploy to production;
- run destructive migrations;
- print `.env` values;
- delete production files;
- restart PM2;
- modify Nginx;
- change DNS;
- change payment configuration;
- run commands that write to production directories.

## Read-only production audit

Allowed only when explicitly requested:
- `pm2 list`
- `pm2 describe`
- `node -v`
- `npm -v`
- `find` for safe filenames
- `df -h`
- `nginx -t`
- `.env` keys with values redacted

## Secrets

When reading `.env`, redact values:
`DATABASE_URL=***REDACTED***`

Never print:
- API keys;
- database passwords;
- JWT secrets;
- SMTP passwords;
- payment credentials;
- LLM keys.

## Generated report production readiness

Before enabling generated reports in production, verify:
- database migration deployed;
- `GENERATED_REPORTS_DIR` exists;
- permissions allow the app/worker to write;
- directory is outside `public/`;
- `pdflatex` exists if LaTeX compilation is enabled;
- worker is supervised by PM2;
- logs do not contain private content;
- disk space is sufficient.
