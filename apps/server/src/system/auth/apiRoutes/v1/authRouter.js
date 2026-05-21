/**
 * @file Auth routes — login, refresh, logout, me, check, change-password, change-email (self-service) per PRD §3.1.1
 * @module auth/apiRoutes/v1/authRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import { login, refresh, logout, me, check, changePassword, changeEmail } from '../../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/change-password', changePassword);
router.patch('/me/email', changeEmail);
router.get('/me', me);
router.get('/check', check);

export default router;
