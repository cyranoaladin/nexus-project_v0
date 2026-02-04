module.exports = {
  apps: [
    {
      name: 'zenflow-daemon',
      script: '.zenflow/daemon/server.ts',
      interpreter: 'tsx',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '.zenflow/logs/daemon-error.log',
      out_file: '.zenflow/logs/daemon-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: 10000,
      max_restarts: 10,
      restart_delay: 5000,
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: false,
    },
  ],
};
