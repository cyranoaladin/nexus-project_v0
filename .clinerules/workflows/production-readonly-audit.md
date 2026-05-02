# Production Read-only Audit

This workflow must not modify production.

## Step 1: Prepare commands

Use only read-only commands.

Never print secret values.

## Step 2: Check PM2

Run:

```bash
pm2 list
pm2 describe all
```

## Step 3: Find app directories

Run:

```bash
find /home -maxdepth 4 -type f \( -name "package.json" -o -name "schema.prisma" -o -name "next.config.*" -o -name ".env" \) 2>/dev/null | sort
```

## Step 4: Check runtime

Run:

```bash
node -v
npm -v
which node
which npm
```

## Step 5: Check LaTeX

Run:

```bash
which pdflatex || true
pdflatex --version | head -n 5 || true
```

## Step 6: Check disk

Run:

```bash
df -h
du -sh /home/nexus 2>/dev/null || true
```

## Step 7: Check Nginx

Run:

```bash
systemctl is-active nginx || true
nginx -t || true
```

## Step 8: Redacted env keys

Only print keys, never values.

```bash
for f in $(find /home -maxdepth 5 -type f -name ".env" 2>/dev/null); do
  echo "--- $f"
  sed -E "s/=.*$/=***REDACTED***/" "$f" | sort
done
```

## Step 9: Report

Report:

* app path;
* PM2 process names;
* Node version;
* whether pdflatex exists;
* generated report storage readiness;
* deployment risks.
