import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Backend listening on port ${PORT}`);
});
