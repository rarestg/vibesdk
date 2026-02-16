# Framer Motion `transformOrigin` Warning Fix Guide

Date: 2026-02-16  
Scope: frontend console noise reduction (non-blocking runtime warning)

## 1. Problem Summary

During timeline UI animations, the browser console repeatedly logs:

```text
You are trying to animate transformOrigin from "240px 62px" to "top center". "top center" is not an animatable value.
```

The app still works, but this warning floods logs and makes real issues harder to spot.

## 2. Symptom Signature

Typical signal in console:

- Framer Motion warning from `framer-motion.js`
- Stack includes timeline component render/unmount paths
- Warning text contains:
  - source value in pixels (for example `240px 62px`)
  - target value as keywords (`top center` or `top`)

## 3. Where the Behavior Comes From

Primary file:

- `src/routes/chat/components/phase-timeline.tsx`

Current hotspots:

- `src/routes/chat/components/phase-timeline.tsx:441`
- `src/routes/chat/components/phase-timeline.tsx:447`
- `src/routes/chat/components/phase-timeline.tsx:453`
- `src/routes/chat/components/phase-timeline.tsx:470`
- `src/routes/chat/components/phase-timeline.tsx:475`
- `src/routes/chat/components/phase-timeline.tsx:480`
- `src/routes/chat/components/phase-timeline.tsx:643`

In those motion blocks, `transformOrigin` is currently inside `initial` / `animate` / `exit` objects.

## 4. Root Cause

This is a value-type mismatch during animation:

1. Framer computes current transform origin as pixel coordinates during layout/projection work (for example `240px 62px`).
2. Component animation targets specify keyword values (`top center` / `top`).
3. Framer attempts to interpolate between pixel and keyword formats.
4. Keyword form is not animatable against computed pixel form, so warning is emitted.

Important: this is not a business logic failure. It is a motion-property modeling issue.

## 5. Suggested Fix (Safe / Minimal)

### File to edit

- `src/routes/chat/components/phase-timeline.tsx`

### Change strategy

Do not animate `transformOrigin`. Set it as a static style/class instead.

1. Remove `transformOrigin` from all `initial` / `animate` / `exit` objects in the affected motion elements.
2. Set a stable origin once on each affected element:
   - `style={{ transformOrigin: '50% 0%' }}`
   - or Tailwind class `origin-top` (equivalent center-top origin).
3. Keep existing animated properties (`opacity`, `y`, `scaleY`, etc.) unchanged.

### Why this works

Framer no longer needs to interpolate `transformOrigin` values across formats. The transform origin is constant, and only animatable numeric transforms are animated.

## 6. Example Patch Shape

Apply this pattern to all affected blocks:

```tsx
<motion.div
  style={{ transformOrigin: '50% 0%' }}
  initial={{ opacity: 0, y: -24, scaleY: 0.6 }}
  animate={{ opacity: 1, y: 0, scaleY: 1 }}
  exit={{ opacity: 0, y: -16, scaleY: 0.8 }}
/>
```

And:

```tsx
<motion.div
  style={{ transformOrigin: '50% 0%' }}
  animate={{ scale: showCollapsedBar ? 0.97 : 1, opacity: showCollapsedBar ? 0.85 : 1 }}
/>
```

## 7. Validation Checklist

Run local checks:

1. `npm run typecheck`
2. `npm run lint`

Manual UI verification:

1. Start app with `bun run dev`.
2. Open chat timeline UI.
3. Trigger states that show/hide the collapsed timeline bar.
4. Verify animations still look the same (especially compression/expand transitions).
5. Confirm the `transformOrigin` warning no longer appears in console.

Regression checks:

1. Timeline layout and hover interactions remain intact.
2. No jumpy scaling around top edge during expand/collapse.
3. No new animation warnings introduced.

## 8. Risks and Guardrails

### Risk

Changing transform origin may alter perceived pivot point of scale animations.

### Guardrail

Use `50% 0%` (center-top) for parity with current intent (`top center` / `top`) and keep all timing/easing untouched.

## 9. Non-Goals

- Do not disable Framer warnings globally.
- Do not remove timeline animations.
- Do not refactor unrelated animation components in the same task.

## 10. Definition of Done

- No repeated `transformOrigin` animatability warnings in timeline flows.
- Timeline collapse/expand UX remains visually unchanged.
- Typecheck and lint pass.

