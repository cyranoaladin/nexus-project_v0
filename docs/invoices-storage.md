# Invoice PDF Storage — Deployment Guide

## Overview

Invoice PDFs are stored on the local filesystem. The storage path is configurable via environment variable.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `INVOICE_STORAGE_DIR` | `<cwd>/data/invoices/` | Absolute path to invoice PDF storage directory |

## Production Requirements

1. **Persistent volume**: The storage directory MUST be on a persistent volume (Docker named volume, host bind mount, or network storage). Container-local storage will lose data on restart.

2. **Backup**: Include the storage directory in your backup strategy. PDFs are the legal record of issued invoices.

3. **Permissions**: The Node.js process must have read+write access to the storage directory. The `ensureInvoiceStorageReady()` function verifies this at runtime.

4. **Disk space**: Each invoice PDF is ~50-100KB. Plan for ~1GB per 10,000 invoices.

## Docker Compose Example

```yaml
services:
  nexus-next-app:
    volumes:
      - invoice_data:/app/data/invoices

volumes:
  invoice_data:
    driver: local
```

## Runtime Check

The `ensureInvoiceStorageReady()` function (from `lib/invoice/storage.ts`) verifies:
- Directory exists (creates it if needed)
- Directory is writable (writes + deletes a test file)

Call it at application startup or before the first invoice creation to fail fast.

## Future: S3-Compatible Storage (P3)

A future iteration will add S3-compatible storage (MinIO / AWS S3) as an alternative backend. The API layer (`storeInvoicePDF`, `readInvoicePDF`) is already abstracted to support this swap without changing consumers.

| Variable (future) | Description |
|-------------------|-------------|
| `INVOICE_STORAGE_BACKEND` | `local` (default) or `s3` |
| `INVOICE_S3_BUCKET` | S3 bucket name |
| `INVOICE_S3_REGION` | AWS region |
| `INVOICE_S3_ENDPOINT` | Custom endpoint (MinIO) |
