# Nginx Configuration

## SSL Certificates

### Option 1: Let's Encrypt (Recommended for Production)

```bash
# Install certbot
apt-get install certbot

# Generate certificates (HTTP-01 challenge)
certbot certonly --standalone -d nexus.example.com

# Copy certificates to nginx/ssl/
cp /etc/letsencrypt/live/nexus.example.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/nexus.example.com/privkey.pem nginx/ssl/

# Set proper permissions
chmod 600 nginx/ssl/privkey.pem
```

### Option 2: Self-Signed Certificates (Development/Testing Only)

```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=TN/ST=Tunis/L=Tunis/O=Nexus/OU=IT/CN=localhost"

# Set proper permissions
chmod 600 nginx/ssl/privkey.pem
```

⚠️ **Warning**: Browsers will show security warnings with self-signed certificates.

## Configuration

### Update server_name

Edit `nginx.conf` and replace `server_name _;` with your actual domain:

```nginx
server_name nexus.example.com;
```

### Adjust CSP (Content Security Policy)

The default CSP is restrictive. You may need to adjust based on your needs:

```nginx
add_header Content-Security-Policy "default-src 'self'; ...
```

Common adjustments:
- Allow Google Fonts: `font-src 'self' https://fonts.gstatic.com;`
- Allow analytics: `script-src 'self' https://www.googletagmanager.com;`
- Allow CDN: `script-src 'self' https://cdn.example.com;`

### Rate Limiting

Adjust rate limits in `nginx.conf` based on your traffic:

```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
```

- `10m` = 10MB memory for tracking IPs (~160,000 IPs)
- `rate=10r/s` = 10 requests per second

## Testing

### Validate Configuration

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Reload Configuration (No Downtime)

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Monitoring

### View Access Logs

```bash
docker compose -f docker-compose.prod.yml logs -f nginx
```

### View Error Logs

```bash
docker compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/error.log
```

## Security Headers Verification

Test your headers at:
- https://securityheaders.com
- https://observatory.mozilla.org

Expected Grade: A or A+
