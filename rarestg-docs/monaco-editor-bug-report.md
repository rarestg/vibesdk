# Bug Report: Monaco Editor TypeScript Worker Error

## Related documents

- Implementation handoff and fix steps: `MONACO-INMEMORY-MODEL-WARNING-FIX-GUIDE.md`

## Symptom

During code generation, the browser console shows repeated errors:

```
Uncaught (in promise) Error: Could not find source file: 'inmemory://model/2'.
    at getValidSourceFile (ts.worker.js)
    at Object.getSuggestionDiagnostics (ts.worker.js)
    at _TypeScriptWorker.getSuggestionDiagnostics (ts.worker.js)
```

## Root Cause

Known Monaco Editor race condition ([microsoft/monaco-editor#1840](https://github.com/microsoft/monaco-editor/issues/1840), [#1842](https://github.com/microsoft/monaco-editor/issues/1842)). During rapid file generation, the `activeFile` changes frequently. The TypeScript web worker asynchronously requests `getSuggestionDiagnostics` for a model URI, but by the time the request is processed, the model has already been replaced with a new one.

## How It Happens

1. Files are streamed in real-time via websocket (`file_generating`, `file_chunk_generated`, `file_generated` messages)
2. `activeFile` state changes frequently as new files are generated or the user switches files
3. Monaco editor model content and language are updated in place via `pushEditOperations`
4. TypeScript worker asynchronously requests diagnostics for the current model URI
5. Model changes before the worker completes, leaving the worker referencing a stale `inmemory://model/N` URI

## Impact

**Cosmetic only.** No functional impact:

- TypeScript diagnostics are already disabled during code generation (`readOnly: true` sets `noSemanticValidation: true, noSyntaxValidation: true`)
- `getSuggestionDiagnostics` is a separate async API that still fires despite the config
- The error is caught internally by Monaco and does not affect editor functionality
- Users can view and edit files normally during and after generation

## Files Involved

| File | Role |
|------|------|
| `src/components/monaco-editor/monaco-editor.tsx` | Editor component, model lifecycle (lines 203-275) |
| `src/routes/chat/chat.tsx` | `activeFile` state computed from rapidly changing file states (lines 375-387) |
| `src/routes/chat/utils/handle-websocket-message.ts` | File streaming handlers (lines 588-610) |

## Suggestion

No immediate action needed. If the console noise becomes a concern, potential mitigations:

- Debounce `activeFile` updates during generation
- Disable suggestion diagnostics globally during generation
- Upgrade Monaco (currently v0.52.2) when Microsoft ships a fix

## References

- [microsoft/monaco-editor#1840](https://github.com/microsoft/monaco-editor/issues/1840)
- [microsoft/monaco-editor#1842](https://github.com/microsoft/monaco-editor/issues/1842)
- [microsoft/monaco-editor#2172](https://github.com/microsoft/monaco-editor/issues/2172)
- [microsoft/monaco-editor#2249](https://github.com/microsoft/monaco-editor/issues/2249)
