/**
 * @file Auth API methods — login, logout, refresh, getMe, check, changePassword
 * @module client/services/authApi
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import client from './client.js';

export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  logout: () => client.post('/auth/logout'),
  refresh: () => client.post('/auth/refresh'),
  getMe: () => client.get('/auth/me'),
  check: () => client.get('/auth/check'),
  changePassword: (currentPassword, newPassword) =>
    client.post('/auth/change-password', { currentPassword, newPassword }),
};

export default authApi;
