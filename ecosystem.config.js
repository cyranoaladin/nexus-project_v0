module.exports = {
  apps: [
    {
      name: 'nexus-prod',
      script: '.next/standalone/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        AUTH_TRUST_HOST: 'true',
        NEXTAUTH_URL: 'http://127.0.0.1:3005',
      },
    },
  ],
};
