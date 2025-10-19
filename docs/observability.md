# Observabilité avec OpenTelemetry

Ce projet peut exporter des traces et métriques via OpenTelemetry.

## Variables d'environnement

- `OTEL_EXPORTER_OTLP_ENDPOINT` (ex: <http://otel-collector:4318/v1/traces>)
- `OTEL_EXPORTER_OTLP_HEADERS` (ex: Authorization=Bearer <token>)
- `OTEL_SERVICE_NAME` (défaut: nexus-reussite-app)

## Démarrage

L'initialisation est gérée par `instrumentation.ts` si les variables sont définies.

## Exemple docker-compose (extrait)

```yaml
services:
  next-app:
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318/v1/traces
      OTEL_SERVICE_NAME: nexus-reussite-app
  otel-collector:
    image: otel/opentelemetry-collector:latest
    ports:
      - "4318:4318"
```
