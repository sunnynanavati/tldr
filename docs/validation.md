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

## Live AI follow-up — 14 October 2026

The user saved the OpenAI key in the ignored `.env`. Restarted the backend; authenticated health now returns `200 { "ready": true }`.

The first live smoke test failed semantic validation. Tightened the provider schema to allow only the requested one or five segments, or an empty already-concise signal, and clarified that word targets are cumulative. Added a regression test for the provider schema. Type checking, linting, all **28 tests**, and production builds pass.

`npm run test:ai` then passed for all three authored fixtures:

- Long English passage: 191 source words → five cumulative lengths of 15, 26, 51, 74, 115 words.
- Short English passage: 26 source words → one 21-word summary.
- Chinese passage: 32 Unicode word units → one 27-unit summary in Chinese.

Reviewed those outputs against the authored sources: they preserved the main facts and source language. This small smoke test does not establish broad summarization quality across arbitrary websites or languages.

Also verified the authenticated production `POST /v1/summaries` route with the long fixture: `200`, matching request ID, and five cumulative counts of 20, 38, 52, 76, 108. The backend remains running on `127.0.0.1:4317`; the extension settings status refreshes when the user chooses **Save & test connection**. Native clipboard paste and browser zoom checks remain outstanding as described above.

## 2026-10-14 — focus, keyword emphasis, and hybrid expansion

- Initial focus now lands on the dialog container. The Close button has no opening focus ring; a real Tab navigation check still showed its visible keyboard outline.
- The response contract now returns complete `levels` rather than append-only `segments`. For longer inputs, a provider-only composition plan requires an insertion within the lead sentence and allows further supporting parts. The backend compiles all five versions from shared text. Short selections keep a separate, simpler single-summary prompt.
- Keyword emphasis is limited to four short phrases, at most four words per phrase and 20% of each summary. Full-sentence emphasis is removed even when punctuation is in a separate run. Text is never changed by this presentation guard.
- Word reconciliation preserves shared DOM nodes, moves them with a 240 ms transform animation, and reveals insertions in reading order. Exit ghosts reverse the reveal; cancellation samples current visual positions and opacity, including rapidly resurrected words.
- `npm run verify`: TypeScript, ESLint, 37 tests, and production builds passed. Vite reports pre-existing dependency comment annotation warnings, with successful output.
- All 19 browser checks passed at 319 px and 1280 px viewport widths. Checks cover initial focus, initial reveal, insertion movement/order, reverse removal, rapid reversals, fixed footer, counter, snapping, final-line clearance, Escape, reduced motion, and keyboard slider controls. No change to the approved material, dimensions, footer, or counter settings.
- Live AI smoke checks passed on the final implementation: English long source 191 words → 10/17/39/63/92; English short source 26 → 21; Chinese source 32 → 25. Manual review confirmed a middle insertion, stable core wording, and source-language output. Word targets remain approximate; semantic quality still requires broader evaluation. Earlier prompt trials exposed rewriting and awkward stacked clauses; the final plan uses one short insertion in the lead and supporting tail text, and keeps the short-input prompt separate.
- Backend restarted on `127.0.0.1:4317`; authenticated `/health` returned HTTP 200 with `ready: true`. Updated unpacked build: `dist/extension`; ZIP: `dist/tldr-chrome.zip`.
- Screenshots: `docs/screenshots/hybrid-expansion-light.png` and `docs/screenshots/hybrid-expansion-dark.png`. This turn verified the actual component in the browser preview; the installed Chrome extension must be reloaded and source pages refreshed to adopt the new bundle and contract.
