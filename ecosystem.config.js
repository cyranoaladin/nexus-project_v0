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
        PORT: process.env.PORT || 3001,
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || 'true',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://nexusreussite.academy',
      },
    },
  ],
};
