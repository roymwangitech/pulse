import { createServer } from 'http';
import { mkdir } from 'fs/promises';
import app from './app.js';
import { config } from './config/index.js';
import { setupSocketIO } from './sockets/index.js';
import { prisma } from './lib/prisma.js';

async function main() {
  await mkdir(config.upload.dir, { recursive: true });

  const httpServer = createServer(app);
  const io = setupSocketIO(httpServer);
  app.set('io', io);

  httpServer.listen(config.port, () => {
    console.log(`PulseChat API running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
