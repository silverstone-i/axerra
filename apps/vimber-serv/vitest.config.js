/**
 * @file Vitest configuration for vimber-serv
 * @module vimber-serv/vitest.config
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['docs/**', 'node_modules/**', 'vitest.config.js'],
    },
    exclude: ['node_modules', 'dist'],
  },
});
