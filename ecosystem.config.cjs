module.exports = {
  apps: [
    {
      name: 'smp-hub-bot',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      exec_mode: "fork",
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
