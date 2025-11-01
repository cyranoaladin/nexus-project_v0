# Compression Brotli avec NGINX

Brotli est activé en plus de Gzip dans `config/nginx.conf`.

```nginx
brotli on;
brotli_types text/plain text/css application/javascript application/json application/xml image/svg+xml;
```

- Conserver Gzip pour compatibilité navigateurs.
- Associer à un cache agressif sur `/_next/static/*`, `/images/*`, `/_next/image`.
