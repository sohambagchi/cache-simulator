# Cache Config Sliders Design (Approved)

Date: 2026-03-03
Scope: Hierarchy configuration UI for cache geometry inputs

## 1) Problem statement

The hierarchy builder currently uses free-form numeric inputs for `totalSizeBytes`, `blockSizeBytes`, and `associativity`, then auto-coerces values into power-of-two geometry and cross-level monotonic constraints. That behavior is technically safe, but it hides user intent and makes the UI feel unpredictable while exploring configurations.

The approved direction is to move these three geometry fields to discrete sliders so users can see valid domains, intentionally pick values, and still explore temporarily invalid hierarchy states. Validation continues to gate simulation execution; editing must remain permissive.

## 2) Goals and non-goals

### Goals
- Replace numeric inputs for total size, block size, and associativity with sliders in the hierarchy panel.
- Keep replacement and write policy fields as dropdowns.
- Use a fixed full domain for size-like sliders: powers of two from 32B to 32MB.
- Indicate cross-level soft limits visually (invalid-range shading), without hard-blocking selection.
- Show inline field-level invalid state/help text while preserving existing global status blocking and warning-list behavior.
- Keep the current ability to continue editing while configuration is invalid; no bypass toggle.

### Non-goals
- No changes to simulation engine semantics or policy behavior.
- No removal of existing global validation gating (`Run`/`Step` still disabled when config errors exist).
- No redesign of warning semantics for non-standard write policy combinations.
- No persistence or settings migration work in this change.

## 3) Current-state analysis (with concrete references)

- `src/ui/config/HierarchyBuilderPanel.tsx` renders the three geometry controls as `input type="number"`, and normalizes each change through `normalizeGeometryPatch` (nearest power-of-two coercion plus deterministic total-size recomputation).
- `src/state/reducer.ts` applies `constrainEnabledHierarchy(...)` on every `UPDATE_CONFIG`, which currently hard-adjusts downstream enabled levels to enforce total-size and block-size monotonicity.
- `src/validation/validateConfig.ts` already computes blocking errors for geometry consistency and monotonic hierarchy ordering (`HIERARCHY_MONOTONICITY`, `BLOCK_SIZE_MONOTONICITY`, `GEOMETRY_INCONSISTENT`).
- `src/state/selectors.ts` (`selectCanRunSimulation`) and `src/ui/controls/GlobalControlBar.tsx` use validation errors to keep simulation controls blocked and show global status text.
- `src/ui/config/HierarchyBuilderPanel.tsx` already has a warnings surface (`warning-list`) for non-blocking policy warnings; this should remain unchanged.
- `src/ui/config/HierarchyBuilderPanel.test.tsx` and `src/state/reducer.test.ts` currently assert the hard-coercion/hard-constraint behavior that will be replaced by soft-limit visual guidance.

## 4) UX behavior specification

### Slider domain
- **Total size slider:** fixed discrete powers-of-two domain from 32B (`2^5`) through 32MB (`2^25`).
- **Block size slider:** fixed discrete powers-of-two domain from 32B through 32MB.
- **Associativity slider:** discrete powers-of-two domain in ways (minimum 1 way, upper bound chosen for practical UI range), independent control from size sliders.

### Discrete steps and value display
- Sliders move by one exponent step at a time (no continuous in-between values).
- The UI displays formatted labels next to each slider (for example `128B`, `4KB`, `1MB`; associativity as `1-way`, `2-way`, etc.).
- Keyboard arrow input follows the same discrete exponent stepping.

### Soft limits and invalid-range shading
- Neighboring enabled levels define **soft limits** only:
  - Total size should increase with higher levels.
  - Block size should be non-decreasing with higher levels.
- Out-of-order ranges remain selectable and editable.
- Slider tracks show shaded invalid segments for out-of-order zones (example: if L1 total size is `128B`, L2 values below `128B` remain selectable but are shaded as invalid).
- Current thumb/value styling reflects invalid state when selection is outside soft limit.

### Inline errors and global behavior
- Field-level inline helper text appears under each geometry slider when that field contributes to a validation error.
- Error styling is local and immediate (input border/track/thumb/helper text), but does not lock the control.
- Existing global behavior is preserved:
  - blocking message/status remains in the global control bar,
  - `Run`/`Step` remain disabled via existing validation selector,
  - warning-list behavior for non-standard write policies remains unchanged.

## 5) Technical design

### Components
- Add a reusable slider primitive for discrete power-of-two values (for geometry fields) in the config UI layer.
- Refactor `src/ui/config/HierarchyBuilderPanel.tsx` to render three slider controls per level and keep policy dropdowns as-is.
- Add helper formatting/parsing utilities (bytes and ways labels, exponent/value mapping) in UI-focused utility module(s).

### State and data flow
- `onUpdateLevel` continues to dispatch `UPDATE_CONFIG` patches from `HierarchyBuilderPanel` through `src/App.tsx` into `src/state/reducer.ts`.
- Remove hard cross-level correction from reducer update flow so user-selected invalid combinations are preserved in state.
- Keep enabled-level guard (cannot disable final active level) unchanged.

### Validation interactions
- `src/validation/validateConfig.ts` remains the authoritative source for blocking errors.
- Slider inline invalid styling derives from current level value plus existing validation outputs (no separate permissive validation path).
- Soft-limit shading is computed in UI from neighboring enabled levels, independent from blocking logic.
- Existing global gating path remains unchanged (`selectCanRunSimulation` and reducer blocking messages).

## 6) Testing plan

### Unit tests
- Add tests for value-domain utilities (power-of-two domain generation, exponent/value conversion, human-readable formatting).
- Add tests for soft-limit range calculation (per level, with enabled/disabled neighbor combinations).

### UI tests
- Update/add `src/ui/config/HierarchyBuilderPanel.test.tsx` cases to verify:
  - slider rendering for geometry fields,
  - discrete step behavior,
  - invalid-range shading state hooks/classes,
  - inline field-level error helper rendering,
  - policy dropdowns remain dropdowns.

### Reducer tests
- Replace hard-constraint assertions in `src/state/reducer.test.ts` with assertions that reducer preserves selected (possibly invalid) values.
- Keep tests confirming final-enabled-level guard and reset/playback behavior.

### Integration tests
- Add flow tests showing user can select out-of-order values, observe inline/global error state, and recover to valid config without losing edits.
- Confirm simulation controls remain disabled while config errors exist and re-enable once resolved.

## 7) Risks and mitigations

- **Risk:** Users may misread soft limits as disabled ranges.
  - **Mitigation:** Use clear visual distinction between shaded-invalid and disabled; keep helper text explicit that selection is allowed but invalid for simulation.
- **Risk:** Removing reducer hard constraints may expose hidden assumptions in tests/components.
  - **Mitigation:** Update reducer/UI tests first and add targeted validation regression cases.
- **Risk:** Slider accessibility regressions.
  - **Mitigation:** Preserve labels/ARIA naming parity and verify keyboard step behavior and readable inline error text.
- **Risk:** Track shading implementation complexity across browsers.
  - **Mitigation:** Use robust CSS fallback where full segmented-track rendering is not available, while preserving invalid indicator near thumb/value.

## 8) Rollout and verification checklist

- [ ] Geometry numeric inputs replaced with sliders in `src/ui/config/HierarchyBuilderPanel.tsx`.
- [ ] Replacement/write policy controls still render as dropdowns.
- [ ] Size-like sliders enforce discrete 32B..32MB power-of-two domain.
- [ ] Neighbor soft limits are visual only (invalid-range shading), not hard-blocking.
- [ ] Invalid selections show inline field-level helper text/styling.
- [ ] Existing warning-list behavior remains unchanged for policy warnings.
- [ ] Existing global blocking/status behavior remains unchanged (`selectCanRunSimulation`, control-bar message).
- [ ] Unit/UI/reducer/integration tests updated and passing for permissive-invalid editing flow.
