# Monaco `inmemory://model/*` Warning Fix Guide

Date: 2026-02-16  
Scope: frontend console noise reduction (non-blocking runtime warning)

## Related documents

- Background investigation and upstream context: `monaco-editor-bug-report.md`

## 1. Problem Summary

During normal app usage (especially when generated files stream into the read-only editor), the browser console shows repeated Monaco worker errors:

```text
Uncaught (in promise) Error: Could not find source file: 'inmemory://model/2'
```

This does not currently block app generation/deployment, but it creates noisy logs and hides real issues.

## 2. Symptom Signature

You should see these stack traces in the browser console:

- `ts.worker.js ... getSyntacticDiagnostics` / `getSuggestionDiagnostics`
- `EditorSimpleWorker.$fmr`
- URI format: `inmemory://model/<n>`

## 3. Where the Behavior Comes From

Primary file:

- `src/components/monaco-editor/monaco-editor.tsx`

Relevant logic:

- TypeScript diagnostics are configured in `useEffect` at `src/components/monaco-editor/monaco-editor.tsx:148`.
- For read-only mode (`createOptions.readOnly === true`), semantic and syntax diagnostics are disabled:
  - `noSemanticValidation: true`
  - `noSyntaxValidation: true`
- Suggestion diagnostics are **not** disabled in read-only mode.

The Monaco TypeScript worker can still run suggestion diagnostics against a model URI that has already been disposed/replaced during rapid updates, producing the `inmemory://model/*` error.

## 4. Root Cause

The root cause is a diagnostics configuration mismatch:

1. Read-only editor mode intends to reduce heavy TS features.
2. Only semantic + syntax diagnostics are disabled.
3. Suggestion diagnostics remain enabled.
4. During model churn (streaming updates, re-renders, model disposal), suggestion diagnostics query stale in-memory URIs.
5. Monaco throws "Could not find source file" promises from the worker.

## 5. Suggested Fix (Safe / Minimal)

### File to edit

- `src/components/monaco-editor/monaco-editor.tsx`

### Change

In the read-only branch (`shouldEnableTypeScript === false`), set diagnostics options for both TS and JS defaults and include:

- `noSuggestionDiagnostics: true`

### Implementation details

Current code updates diagnostics options only for `typescriptDefaults`.  
Update both:

- `monaco.languages.typescript.typescriptDefaults`
- `monaco.languages.typescript.javascriptDefaults`

### Target behavior

- Editable mode (`shouldEnableTypeScript === true`): keep full diagnostics/intellisense.
- Read-only mode: disable semantic + syntax + suggestion diagnostics.

## 6. Example Patch Shape

This is the intended pattern (adjust exact formatting to project style):

```ts
if (shouldEnableTypeScript) {
  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });
} else {
  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });
}
```

## 7. Validation Checklist

Run local checks:

1. `npm run typecheck`
2. `npm run lint`

Manual browser verification:

1. Start app with `bun run dev`.
2. Open chat/editor view.
3. Trigger file streaming (generate an app).
4. Toggle files in the read-only Monaco editor while updates are incoming.
5. Confirm console no longer emits repeated:
   - `Could not find source file: 'inmemory://model/*'`

Regression checks:

1. Ensure Monaco still renders file contents correctly.
2. Ensure syntax highlighting remains intact.
3. If any editable Monaco mode exists in your flow, verify suggestions still work there.

## 8. Risks and Guardrails

### Risk

Diagnostics options are Monaco global defaults, not per-editor instance.

### Guardrail

Only change diagnostics behavior based on the existing `shouldEnableTypeScript` gate.  
Do **not** hard-disable diagnostics globally.

## 9. Non-Goals

- Do not suppress errors by monkey-patching `console.error`.
- Do not remove Monaco worker imports.
- Do not rewrite editor lifecycle or model management in this task.

## 10. Definition of Done

- Console no longer floods with `inmemory://model/*` diagnostics errors in read-only viewer workflows.
- Typecheck and lint pass.
- No regression in editor rendering or expected language features.
