import { createApp } from './app';
import { env } from './config/env';
import { startExpireCompOffJob } from './jobs/expire-compoff.job';

const app = createApp();

const server = app.listen(env.PORT, () => {
  startExpireCompOffJob();
  console.log(`[server] Running at http://localhost:${env.PORT}`);
  console.log(`[server] Environment: ${env.NODE_ENV}`);
  if (env.NODE_ENV === 'development') {
    console.log(`[server] API docs at http://localhost:${env.PORT}/api/docs`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
