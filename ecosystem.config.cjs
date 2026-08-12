module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'assess-frontend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        PORT: 3087,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3087,
        API_URL: 'https://api.assess.nileagi.com',
        PUBLIC_URL: 'https://assess.nileagi.com',
      },
    },
  ],
};
