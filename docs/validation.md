# TLDR validation — 13 October 2026

## Build and automated checks

Validated with project-local Node **24.21.0** and the committed npm lockfile.

- `npm run check` — passed (strict TypeScript).
- `npm run lint` — passed.
- `npm test` — **27 tests passed**, across five files.
- `npm run build` — passed; unpacked extension in `dist/extension`, backend in `dist/server`.
- `npm run test:ai` — **skipped** because `OPENAI_API_KEY` is not configured. No paid provider calls were made.

Tests cover cumulative summaries, exact Unicode counts, malformed responses, source-length limits, placement/clamping, authentication and origin checks, short/already-concise selections, timeouts, cancellation, concurrency/rate limits, stale responses, retry IDs, and a disconnected service-worker message port.

Vite reports harmless upstream Zod comment-annotation warnings while bundling; these do not affect the generated code.

## Browser checks

The same production dialog component passed **16 browser-executed checks**. Full output is in [browser-checks.txt](browser-checks.txt).

Verified the fixed loading frame, packaged Inter, 500 ms word reveal, reverse removal, shared DOM-node preservation, rapid slider reversals, counter blur and crisp finish, stable footer, continuous slider travel, release snapping, last-line clearance, independent header blur, Escape dismissal, keyboard End, and reduced motion.

Additional component checks:

- Light/dark page rendering captured in `screenshots/component-light.png` and `screenshots/component-dark.png`.
- At a **319 × 560px** viewport, the panel clamps to **287 × 420px**, at x=16/y=70. Viewport override was reset afterward.
- Short fixture: 12-word compact summary with slider disabled.
- Connection error offers Retry; retry restores disabled loading controls.
- Copy reports success in the component preview. A clipboard fallback was added after Chrome blocked async clipboard access during background automation. An OS clipboard round-trip was not conclusively verified by the automation clipboard bridge.
- No error/warning console entries in the component test page.

## Installed Chrome extension

Loaded the unpacked build in Chrome as `nlaaihiaadichmkeccfhdebglmbhlnnf`. Configured its separate local token and verified the connection status against the authenticated fixture backend.

Verified native text selection → native TLDR context-menu item → selection-adjacent dialog on `public/tests/strict.html`. That fixture blocks external fonts and connections and applies deliberately conflicting page typography and element styles. The component retained its packaged font, dimensions, surface, and controls. Native slider increments/decrements changed the word count. See `screenshots/chrome-light.png`.

Chrome omitted the Origin header on its privileged backend fetch. The backend now accepts those requests only with the configured extension-ID header **and** bearer token, while rejecting every foreign web Origin. This behavior is covered by integration tests.

Further native Chrome interaction was interrupted by activity in the user's browser. The final clipboard fallback and transport refinements are built and covered by component/unit checks; reload TLDR in `chrome://extensions` and refresh the target page before using the final build. Browser zoom, mid-fetch termination of Chrome's actual service worker, and an OS clipboard paste remain manual checks; the corresponding placement/transport behavior has automated coverage where applicable.

## Production backend

Started the built server on `127.0.0.1:4317` and verified authenticated `/health` returns `200 { "ready": false }` without a provider key. A real summary request returns a concise `503 setup` response instructing the user to add the key. Both test backend processes were stopped afterward so port 4317 is free for `npm run dev:server` after adding the key. The independent component preview remains running on port 4174.

## Remaining credential-gated verification

Add `OPENAI_API_KEY` to the ignored `.env`, start/restart the backend, and run `npm run test:ai`. The smoke test checks the contract and shortening for authored English and Chinese inputs and prints summaries for manual factual/language review. Live model availability, latency, factual fidelity, and multilingual quality have **not** been verified in this workspace without that key.
