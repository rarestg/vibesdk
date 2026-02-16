# Next Engineer Handoff: Monaco + Framer Console Warnings

Date: 2026-02-16  
Audience: Engineer picking up warning cleanup work  
Goal: Prepare and execute fixes for Monaco `inmemory://model/*` errors and Framer `transformOrigin` warnings with low regression risk.

## 1. Repo Background Read Order

Read these in this exact order before coding:

1. `README.md`  
   Why: Product overview, local dev flow, deployment model.
2. `sdk/README.md`  
   Why: SDK/runtime interaction model and generated-session lifecycle context.
3. `AGENTS.md`  
   Why: Repo-specific build/lint/test/style constraints and engineering rules.
4. `VIBESDK-ARCHITECTURE-DEEP-DIVE.md`  
   Why: End-to-end architecture (frontend -> worker -> sandbox/deploy paths).
5. `changes-versus-base.md`  
   Why: Historical context of major local modifications.

Then read issue-specific docs:

1. `monaco-editor-bug-report.md` (background and upstream context)
2. `MONACO-INMEMORY-MODEL-WARNING-FIX-GUIDE.md` (implementation-oriented guide)
3. `FRAMER-TRANSFORMORIGIN-WARNING-FIX-GUIDE.md` (implementation-oriented guide)

## 2. Reproduce Current Problems

Use:

```bash
bun run dev
```

Reproduce Monaco warning:

1. Open chat/codegen workflow.
2. Start generation so files stream in and read-only Monaco updates repeatedly.
3. Watch browser console for:
   - `Could not find source file: 'inmemory://model/*'`

Reproduce Framer warning:

1. Use chat timeline UI and trigger collapsed/expanded bar transitions.
2. Watch console for:
   - `You are trying to animate transformOrigin...`

## 3. Code Entry Points

Monaco warning investigation:

1. `src/components/monaco-editor/monaco-editor.tsx:148`  
   `useEffect` that configures TS diagnostics.
2. `src/components/monaco-editor/monaco-editor.tsx:155`  
   Editable-mode diagnostics are set only on `tsDefaults`.
3. `src/components/monaco-editor/monaco-editor.tsx:183`  
   Read-only-mode diagnostics disable semantic/syntax, but suggestion diagnostics are not explicitly addressed.

Framer warning investigation:

1. `src/routes/chat/components/phase-timeline.tsx:441`
2. `src/routes/chat/components/phase-timeline.tsx:447`
3. `src/routes/chat/components/phase-timeline.tsx:453`
4. `src/routes/chat/components/phase-timeline.tsx:470`
5. `src/routes/chat/components/phase-timeline.tsx:475`
6. `src/routes/chat/components/phase-timeline.tsx:480`
7. `src/routes/chat/components/phase-timeline.tsx:643`

These locations currently include `transformOrigin` inside animated prop objects (`initial`/`animate`/`exit`).

## 4. Implementation Plan (Ready to Execute)

Step 1: Baseline evidence

1. Capture before-fix console snippets for both warnings.
2. Note exact UI interactions that trigger each warning.

Step 2: Monaco fix

1. Update diagnostics config in `src/components/monaco-editor/monaco-editor.tsx`.
2. Ensure diagnostics options are explicitly set for both:
   - `monaco.languages.typescript.typescriptDefaults`
   - `monaco.languages.typescript.javascriptDefaults`
3. In read-only mode, disable suggestion diagnostics as part of the low-cost viewer configuration.
4. Keep full diagnostics behavior in editable mode.

Step 3: Framer fix

1. Remove `transformOrigin` from animated objects in `src/routes/chat/components/phase-timeline.tsx`.
2. Set transform origin statically (style/class) on affected motion elements.
3. Preserve existing timing/easing/scale behavior.

Step 4: Validate

1. Run:
   - `npm run typecheck`
   - `npm run lint`
2. Manually re-run reproductions from Section 2.
3. Confirm:
   - Monaco warning no longer floods console.
   - Framer warning no longer appears.
   - Timeline animations still look correct.
   - Monaco read-only display remains stable.

Step 5: PR packaging

1. Keep changes minimal and isolated to warning fixes.
2. Include before/after evidence in PR description.
3. Reference:
   - `monaco-editor-bug-report.md`
   - `MONACO-INMEMORY-MODEL-WARNING-FIX-GUIDE.md`
   - `FRAMER-TRANSFORMORIGIN-WARNING-FIX-GUIDE.md`

## 5. Acceptance Criteria

1. No repeated Monaco `inmemory://model/*` console errors during normal generation flows.
2. No Framer `transformOrigin` animatability warnings during timeline transitions.
3. `npm run typecheck` and `npm run lint` pass.
4. No UX regression in timeline transitions or Monaco rendering.

## 6. Non-Goals

1. Do not refactor unrelated chat/timeline logic.
2. Do not globally suppress console warnings.
3. Do not redesign Monaco lifecycle in this task.

