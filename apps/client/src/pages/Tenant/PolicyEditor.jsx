/**
 * @file PolicyEditor — accordion-based policy matrix for Layer 1 RBAC configuration
 * @module client/pages/Tenant/PolicyEditor
 *
 * Reads the policy_catalog for structure, loads current policies for the selected
 * role, and renders a grouped accordion matrix with level selectors per entry.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import PrimaryButton from '../../components/shared/PrimaryButton.jsx';
import SecondaryButton from '../../components/shared/SecondaryButton.jsx';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CircularProgress from '@mui/material/CircularProgress';

import { createPortal } from 'react-dom';

import { usePolicyCatalog, usePoliciesForRole, useSyncPolicies } from '../../hooks/usePolicies.js';

/* ── Helpers ──────────────────────────────────────────────────── */

const ROOT_KEY = '::::'; // policyKey('', null, null) → '' + '::' + '' + '::' + ''

function policyKey(module, router, action) {
  return `${module}::${router || ''}::${action || ''}`;
}

/** Cascade: action → router → module → root → '' (used for module + router headings). */
function resolveLevel(edits, key, routerKey, moduleKey) {
  return edits[key] ?? edits[routerKey] ?? edits[moduleKey] ?? edits[ROOT_KEY] ?? '';
}

/**
 * Exact-match resolution — used for action rows.
 *
 * Mirrors `rbac.resolveLevel()` on the server: any action address whose
 * catalog row is `policy_required !== false` requires an exact-match
 * policy grant; broader grants do NOT satisfy it. `buildCatalogTree`
 * only emits `policy_required !== false` rows into the action maps, so
 * every rendered action row uses this resolver. Displaying the cascade
 * here would lie — the user would see Export = F inherited from
 * Vendors:F while the endpoint returns 403.
 */
function resolveExact(edits, key) {
  return edits[key] ?? '';
}

/**
 * Build a tree from flat catalog rows.
 *
 * Four entry types:
 *   1. Module heading   (router=null, action=null) → sets mod.label
 *   2. Module action    (router=null, action≠null) → mod.actions Map
 *   3. Router heading   (router≠null, action=null) → mod.routers Map
 *   4. Router action    (router≠null, action≠null) → rtr.actions Map (nested)
 *
 * Grantability: rows with `policy_required: false` represent capabilities
 * that exist in the API but are intentionally NOT independently grantable
 * (e.g. legacy router-level access codes hidden in favor of finer actions).
 * They aren't filtered out at build time — the renderer hides their
 * level-selector toggle but still uses them so router+action nodes don't
 * accidentally synthesize a grantable router heading. Empty router groups
 * (no grantable router-level toggle and no grantable actions) are pruned
 * during rendering.
 */
function buildCatalogTree(catalogRows) {
  const sorted = [...catalogRows].sort((a, b) => a.sort_order - b.sort_order);
  const modules = new Map();

  for (const entry of sorted) {
    const grantable = entry.policy_required !== false;

    if (!modules.has(entry.module)) {
      modules.set(entry.module, { label: entry.module, grantable: true, actions: new Map(), routers: new Map() });
    }
    const mod = modules.get(entry.module);

    if (entry.router === null && entry.action === null) {
      mod.label = entry.label;
      mod.grantable = grantable;
    } else if (entry.router === null && entry.action !== null) {
      if (!grantable) continue;
      mod.actions.set(entry.action, { label: entry.label, description: entry.description });
    } else if (entry.action === null) {
      const existing = mod.routers.get(entry.router);
      mod.routers.set(entry.router, {
        label: entry.label,
        description: entry.description,
        grantable,
        actions: existing?.actions ?? new Map(),
      });
    } else {
      if (!grantable) continue;
      let rtr = mod.routers.get(entry.router);
      if (!rtr) {
        // No router-heading row in the catalog. Synthesize a label-only
        // node — never grantable, since the catalog didn't expose a
        // router-level toggle for this name. Granting the synthetic router
        // would have implicitly opened any other endpoints the router
        // serves (e.g. raw CRUD), which is not what the catalog author
        // intended.
        rtr = { label: entry.router, description: '', grantable: false, actions: new Map() };
        mod.routers.set(entry.router, rtr);
      }
      rtr.actions.set(entry.action, { label: entry.label, description: entry.description });
    }
  }

  return modules;
}

/* ── Level selector ───────────────────────────────────────────── */

const LEVELS = [
  { value: '', label: '\u2014' },
  { value: 'none', label: 'N' },
  { value: 'view', label: 'V' },
  { value: 'full', label: 'F' },
];

function LevelSelector({ value, onChange, disabled }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value || ''}
      onChange={(_, val) => { if (val !== null) onChange(val); }}
      disabled={disabled}
    >
      {LEVELS.map((l) => (
        <ToggleButton key={l.value} value={l.value} sx={{ minWidth: 32, px: 1 }}>
          {l.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/* ── Component ────────────────────────────────────────────────── */

export default function PolicyEditor({ roleId, readOnly = false, actionsContainer }) {
  const { data: catalogRes, isLoading: catalogLoading } = usePolicyCatalog();
  const { data: policiesRes, isLoading: policiesLoading } = usePoliciesForRole(roleId);
  const syncMut = useSyncPolicies();

  const catalogTree = useMemo(
    () => buildCatalogTree(catalogRes?.rows ?? []),
    [catalogRes],
  );

  const serverPolicies = useMemo(() => {
    const map = {};
    for (const p of policiesRes?.records ?? []) {
      map[policyKey(p.module, p.router, p.action)] = p.level;
    }
    return map;
  }, [policiesRes]);

  const [edits, setEdits] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEdits(serverPolicies);
    setDirty(false);
  }, [serverPolicies]);

  const handleChange = useCallback((key, level) => {
    setEdits((prev) => {
      const next = { ...prev };
      if (level === '') {
        delete next[key];
      } else {
        next[key] = level;
      }
      return next;
    });
    setDirty(true);
  }, []);

  const handleDiscard = useCallback(() => {
    setEdits(serverPolicies);
    setDirty(false);
  }, [serverPolicies]);

  const handleSave = useCallback(async () => {
    const policies = Object.entries(edits).map(([key, level]) => {
      const [module, router, action] = key.split('::');
      return { module, router: router || null, action: action || null, level };
    });
    try {
      await syncMut.mutateAsync({ roleId, policies });
      setDirty(false);
    } catch (err) {
      console.error('[PolicyEditor] save failed', err);
    }
  }, [edits, roleId, syncMut]);

  if (catalogLoading || policiesLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Action buttons — portalled to tab row */}
      {actionsContainer && createPortal(
        <>
          {dirty && !readOnly && (
            <SecondaryButton size="small" onClick={handleDiscard}>Discard</SecondaryButton>
          )}
          <PrimaryButton
            size="small"
            disabled={!dirty || readOnly || syncMut.isPending}
            onClick={handleSave}
          >
            {syncMut.isPending ? 'Saving\u2026' : 'Save Policies'}
          </PrimaryButton>
        </>,
        actionsContainer,
      )}

      {/* Legend */}
      <Typography variant="caption" color="text.secondary">
        {'\u2014'} = Inherit &nbsp; N = None &nbsp; V = View &nbsp; F = Full
      </Typography>

      {/* Accordion per module */}
      {[...catalogTree.entries()].map(([moduleName, mod]) => {
        const moduleKey = policyKey(moduleName, null, null);
        // Skip empty modules: nothing grantable at module, action, or router level.
        const visibleRouters = [...mod.routers.entries()].filter(
          ([, rtr]) => rtr.grantable !== false || rtr.actions.size > 0,
        );
        if (mod.grantable === false && mod.actions.size === 0 && visibleRouters.length === 0) {
          return null;
        }
        return (
          <Accordion key={moduleName} defaultExpanded={false} disableGutters variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                <Typography variant="subtitle2">{mod.label}</Typography>
                {mod.grantable !== false && (
                  <Box onClick={(e) => e.stopPropagation()}>
                    <LevelSelector
                      value={resolveLevel(edits, moduleKey, moduleKey, moduleKey)}
                      onChange={(val) => handleChange(moduleKey, val)}
                      disabled={readOnly}
                    />
                  </Box>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {/* Module-level actions (e.g. Reset Password) */}
              {[...mod.actions.entries()].map(([actionName, act]) => {
                const actionKey = policyKey(moduleName, null, actionName);
                return (
                  <Box
                    key={actionName}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.5,
                      px: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">{act.label}</Typography>
                    <LevelSelector
                      value={resolveExact(edits, actionKey)}
                      onChange={(val) => handleChange(actionKey, val)}
                      disabled={readOnly}
                    />
                  </Box>
                );
              })}

              {/* Router rows (with nested router-action sub-rows) */}
              {visibleRouters.map(([routerName, rtr]) => {
                const routerKey = policyKey(moduleName, routerName, null);
                const hasActions = rtr.actions && rtr.actions.size > 0;

                const actionRows = hasActions ? [...rtr.actions.entries()].map(([actionName, act]) => {
                  const actionKey = policyKey(moduleName, routerName, actionName);
                  return (
                    <Box
                      key={actionName}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.5,
                        pl: 4,
                        pr: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                        borderRadius: 0.5,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">{act.label}</Typography>
                      <LevelSelector
                        value={resolveExact(edits, actionKey)}
                        onChange={(val) => handleChange(actionKey, val)}
                        disabled={readOnly}
                      />
                    </Box>
                  );
                }) : null;

                if (hasActions) {
                  return (
                    <Accordion
                      key={routerName}
                      defaultExpanded={false}
                      disableGutters
                      elevation={0}
                      sx={{
                        bgcolor: 'transparent',
                        '&::before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          minHeight: 0,
                          px: 1,
                          '& .MuiAccordionSummary-content': { my: 0.5 },
                          '&:hover': { bgcolor: 'action.hover' },
                          borderRadius: 0.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                          <Typography variant="body2">{rtr.label}</Typography>
                          {rtr.grantable !== false && (
                            <Box onClick={(e) => e.stopPropagation()}>
                              <LevelSelector
                                value={resolveLevel(edits, routerKey, routerKey, moduleKey)}
                                onChange={(val) => handleChange(routerKey, val)}
                                disabled={readOnly}
                              />
                            </Box>
                          )}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 0 }}>
                        {actionRows}
                      </AccordionDetails>
                    </Accordion>
                  );
                }

                return (
                  <Box
                    key={routerName}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.5,
                      px: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="body2">{rtr.label}</Typography>
                    {rtr.grantable !== false && (
                      <LevelSelector
                        value={resolveLevel(edits, routerKey, routerKey, moduleKey)}
                        onChange={(val) => handleChange(routerKey, val)}
                        disabled={readOnly}
                      />
                    )}
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
