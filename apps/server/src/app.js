/**
 * @file Express application setup — middleware chain, auth, and route mounting
 * @module server/app
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { authRedis } from './middleware/authRedis.js';
import { auditContext } from './middleware/auditContext.js';
import { registerAuditResolver } from './lib/registerAuditResolver.js';
import apiRoutes from './apiRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Wire pg-schemata's audit-actor resolver to the ambient request context.
// Registered once at module load so both the runtime server (server.js) and
// the contract-test harness (which imports app.js directly) pick it up.
registerAuditResolver();

const app = express();

const defaultOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : defaultOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Health check (before auth)
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Auth middleware — JWT verify, tenant resolution (bypasses login/refresh/logout)
app.use('/api', authRedis());

// Ambient request context — populates AsyncLocalStorage with userId / schema /
// tenantId so pg-schemata's audit resolver and downstream helpers can read
// them without controllers threading the actor explicitly.
app.use('/api', auditContext);

// API routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (_req, res) => {
  res.send('Axerra API is running');
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use(errorHandler);

export default app;
