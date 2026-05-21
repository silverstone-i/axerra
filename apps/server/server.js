/**
 * @file Server entry point — starts Express on configured port
 * @module server/server
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import 'dotenv/config';
import app from './src/app.js';
import logger from './src/lib/logger.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, (err) => {
  if (err) {
    logger.error('Error starting server:', err);
    return;
  }

  logger.info(`Server running in ${process.env.NODE_ENV} mode at http://${HOST}:${PORT}`);
});
