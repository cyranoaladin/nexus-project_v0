module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'nexus-app',
      script: '.next/standalone/server.js',
      // DO NOT raise this above 1 (or switch exec_mode to 'cluster') without first
      // configuring a distributed rate-limit backend (REDIS_URL or
      // UPSTASH_REDIS_REST_URL/TOKEN — see lib/rate-limit/index.ts). Rate limiting
      // falls back to a per-process in-memory store when neither is set, which is
      // only correct with exactly 1 instance. See
      // docs/audits/2026-07-29-production-rate-limit-mode.md.
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        HOSTNAME: '127.0.0.1',
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || 'true',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://nexusreussite.academy',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        HOSTNAME: '127.0.0.1',
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || 'true',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://nexusreussite.academy',
      },
    },
  ],
};
