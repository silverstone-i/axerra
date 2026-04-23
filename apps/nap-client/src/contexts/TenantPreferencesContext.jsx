/**
 * @file TenantPreferencesContext — provides tenant UI preferences to all components
 * @module nap-client/contexts/TenantPreferencesContext
 *
 * Fetches the single tenant_preferences row via React Query and exposes
 * values (e.g. defaultPageSize) through context so shared components like
 * DataTable can read them without prop-drilling.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { createContext, useContext, useMemo } from 'react';
import { useTenantPreferences } from '../hooks/useTenantPreferences.js';

const TenantPreferencesContext = createContext({ defaultPageSize: 25 });

const DEFAULTS = { defaultPageSize: 25 };

export function TenantPreferencesProvider({ children }) {
  const { data } = useTenantPreferences();

  const prefs = useMemo(() => {
    const row = data?.rows?.[0];
    if (!row) return DEFAULTS;
    return {
      defaultPageSize: row.default_page_size ?? 25,
    };
  }, [data]);

  return <TenantPreferencesContext.Provider value={prefs}>{children}</TenantPreferencesContext.Provider>;
}

/** @returns {{ defaultPageSize: number }} */
export function useTenantPrefs() {
  return useContext(TenantPreferencesContext);
}
