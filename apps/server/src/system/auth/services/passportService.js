/**
 * @file Passport.js Local Strategy — validates email/password against admin.portal_users
 * @module auth/services/passportService
 *
 * portal_users is auth-only identity. Tenant linkage is resolved via
 * admin.portal_user_tenants. The user's home tenant — used for the
 * post-login active-tenant verification — is the earliest active
 * binding (employees and clients have exactly one; vendor_contacts may
 * have several and the x-tenant-code header overrides at request time).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from '../../../db/db.js';

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await db('portalUsers', 'admin').findOneBy([{ email }]);

      if (!user) return done(null, false, { message: 'Incorrect email.' });

      // Soft delete check
      if (user.deactivated_at !== null) {
        return done(null, false, { message: 'User account is inactive.' });
      }

      // Locked status check
      if (user.status === 'locked') {
        return done(null, false, { message: 'Account is locked. Contact your administrator.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

      // Resolve home binding + tenant
      const tenant = await db.oneOrNone(
        `SELECT t.*
         FROM admin.portal_user_tenants b
         JOIN admin.tenants t ON t.id = b.tenant_id
         WHERE b.portal_user_id = $1 AND b.deactivated_at IS NULL
         ORDER BY b.created_at ASC
         LIMIT 1`,
        [user.id],
      );
      if (!tenant || tenant.deactivated_at !== null) {
        return done(null, false, { message: 'Tenant is inactive.' });
      }

      // Attach tenant context for the auth controller
      user._tenant = tenant;

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

export default passport;
