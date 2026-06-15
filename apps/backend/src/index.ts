import { createApp } from './app.js';
import { seedRoles } from './lib/seedRoles.js';
import { startCronJobs } from './lib/cron.js';
import { logger } from './lib/logger.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = createApp();


// Guard: JWT_SECRET obligatoire en production
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET non défini — arrêt du serveur');
  process.exit(1);
}

app.listen(PORT, () => {
  logger.info(`Backend listening on port ${PORT}`);
  seedRoles();
  startCronJobs();
});
