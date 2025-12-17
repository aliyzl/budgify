module.exports = {
  apps: [
    // Backend Development
    {
      name: 'backend-dev',
      script: 'npm',
      args: 'run dev',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      error_file: './logs/backend-dev-error.log',
      out_file: './logs/backend-dev-out.log',
      log_file: './logs/backend-dev.log',
      time: true,
    },
    // Backend Production
    {
      name: 'backend-prod',
      script: 'node',
      args: 'dist/index.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/backend-prod-error.log',
      out_file: './logs/backend-prod-out.log',
      log_file: './logs/backend-prod.log',
      time: true,
    },
    // Frontend Development
    {
      name: 'frontend-dev',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/frontend-dev-error.log',
      out_file: './logs/frontend-dev-out.log',
      log_file: './logs/frontend-dev.log',
      time: true,
    },
    // Frontend Production
    {
      name: 'frontend-prod',
      script: 'npm',
      args: 'run preview',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/frontend-prod-error.log',
      out_file: './logs/frontend-prod-out.log',
      log_file: './logs/frontend-prod.log',
      time: true,
    },
  ],
};

