# ADR-0024: ModuleBar primaryActions contract — no `color`

**Status**: Accepted
**Date**: 2026-04-27

## Context

`ModuleBar` renders toolbar action buttons through a small dispatch table that
maps an action's `variant` to one of three branded button wrappers:

```js
const VARIANT_TO_BUTTON = {
  contained: PrimaryButton,
  outlined: SecondaryButton,
  text: TertiaryButton,
};
```

Each branded wrapper owns its full color story per BRAND.md — `PrimaryButton`
is navy with a gold stripe, `SecondaryButton` is transparent with navy text on
a strong border, `TertiaryButton` is navy text on a transparent ground (with
an opt-in `danger` prop for inline ghost destructive affordances per
BRAND.md §"Tertiary (ghost) button").

ModuleBar nevertheless forwarded an `action.color` prop to the wrapper:

```jsx
<ButtonComponent color={action.color || 'primary'} ... />
```

This created an asymmetric, footgun contract:

- `PrimaryButton` honored it because its `{...rest}` spread overrode the
  hardcoded `color="primary"` — passing `color: 'error'` would tint a primary
  button red, in direct violation of BRAND.md §"Destructive actions".
- `SecondaryButton` and `TertiaryButton` ignored it because their hardcoded
  `sx` (e.g. `color: theme.palette.brand.navyText`) wins over MUI's `color`
  prop. Authors expecting a red Archive or green Restore got navy.

By the time issue [#35](https://github.com/silverstone-i/axerra/issues/35)
was filed, 25+ pages were passing `color: 'error'` / `color: 'success'` to
`variant: 'outlined'` actions in the belief they were getting semantic
styling. They rendered navy — accidentally brand-correct, intentionally
broken.

BRAND.md is unambiguous on the underlying styling rule:

> Do **not** use red fill for destructive buttons. Keep the primary navy with
> a clear label. Red is reserved for *status* (something is broken), not
> *action* (the user is taking a step).

So the contract was promising something the brand forbids.

## Decision

`primaryActions` items take exactly these keys:

```ts
{ label: string,
  variant: 'contained' | 'outlined' | 'text',
  disabled?: boolean,
  onClick: () => void,
  icon?: ReactNode }
```

No `color`. ModuleBar does not forward a `color` prop to its branded button
wrappers. Brand styling is owned end-to-end by `PrimaryButton`,
`SecondaryButton`, `TertiaryButton`.

Destructive primaries follow BRAND.md §"Destructive actions": navy fill,
clear destructive label ("Archive", "Delete invoice", "Reverse"). The one
brand-sanctioned color override is `TertiaryButton`'s `danger` prop for
inline ghost destructive affordances. If a `variant: 'text'` ModuleBar
action ever needs it, extend the contract with a `danger: true` flag at
that point — not preemptively. (No `variant: 'text'` actions exist in
`apps/client/src/pages/` today.)

## Consequences

- ModuleBar action rendering simplifies; no per-variant color routing.
- All existing `color: 'error' | 'success' | 'warning' | 'primary' |
  'secondary'` keys in `primaryActions` configs across pages and in
  `selectionUtils.buildBulkActions` are dead and removed in the same
  change. No visual diff — they were never honored on
  outlined/text variants, and the contained-variant primary color matches
  the branded `PrimaryButton`'s hardcoded navy.
- The contract is enforced by convention, code review, and the JSDoc on
  `ModuleBar.jsx`. No client-side test infrastructure exists in this
  repo (no `*.test.*` files, no vitest config in `apps/client`), so a
  unit/integration test for this contract is deferred. Visual verification
  per PR is sufficient given the deterministic styling.
- Future: if `primaryActions` configs grow a real need for semantic
  styling variation (e.g. a confirmed product requirement for green
  approval buttons that BRAND.md is amended to allow), revisit by adding
  a `tone` prop to `SecondaryButton`/`TertiaryButton` with theme-defined
  variants. That is the deferred Option B from issue #35; not warranted
  today.

## References

- Issue [#35](https://github.com/silverstone-i/axerra/issues/35)
- [BRAND.md §"Destructive actions"](../branding/BRAND.md)
- `apps/client/src/components/layout/ModuleBar.jsx`
- `apps/client/src/components/shared/PrimaryButton.jsx`,
  `SecondaryButton.jsx`, `TertiaryButton.jsx`
