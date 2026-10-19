# TLDR

A Chrome extension that summarizes selected text in the approved floating glass dialog. The slider switches locally between five progressively expanded levels, preserving shared text and the original animations.

## This workspace

The unpacked extension is loaded in Chrome with ID `nlaaihiaadichmkeccfhdebglmbhlnnf`. Its local connection token is already saved in Chrome and the ignored `.env` file. **Add your OpenAI API key to `OPENAI_API_KEY` in `.env` to enable real summaries.**

Use Node 24. A project-local runtime was installed for validation without replacing your system Node:

```sh
export PATH="$PWD/.runtime/node_modules/.bin:$PATH"
npm run service:install
npm run service:status
```

The macOS login service runs in the background, starts at login, and restarts after crashes. It does not need Terminal or Codex to stay open. Only one backend can use port 4317 at a time; run `npm run service:uninstall` before switching to manual development or fixture mode. Open TLDR’s extension settings and choose **Save & test connection** to confirm that the backend and API configuration are ready. Then select text on an ordinary webpage, right-click, and choose **TLDR**.

## Fresh setup

1. Install/use Node 24 LTS (`.nvmrc` specifies 24), then run `npm ci` and `npm run build`.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/extension`.
3. Create `.env` from `.env.example`. Add `OPENAI_API_KEY`, generate a local token with `npm run token`, and set `TLDR_EXTENSION_ID` to the ID Chrome shows. Keep `.env` private and untracked.
4. On macOS, run `npm run service:install` for the persistent backend. For manual development, use `npm run dev:server` (or `npm start` after building).
5. Open the extension’s connection settings. Paste **TLDR_LOCAL_TOKEN**, save, and test. Never paste the OpenAI key into the extension.

After source changes, run `npm run build`, click **Reload** on TLDR’s card in `chrome://extensions`, and reload pages that previously used TLDR. After backend source or project `.env` changes, run `npm run service:restart`; it rebuilds the installed backend and refreshes its private environment copy. `npm run build` alone does not update the installed service.

## Development and verification

| Command | Purpose |
| --- | --- |
| `npm run dev` | Fixture page and component preview at `http://127.0.0.1:4174` |
| `npm run dev:fixtures` | Authenticated backend for the exact authored fixture passages; no OpenAI calls |
| `npm run dev:server` | Real OpenAI backend at `http://127.0.0.1:4317` |
| `npm run verify` | Type checking, lint, unit/integration tests, and production builds |
| `npm run test:ai` | Three live AI calls using authored English and Chinese fixtures; skipped without a key |

The fixture page provides selection shortcuts, loading/error scenarios, rapid replacement, and **Run browser checks**. Its strict-CSP test page exercises style isolation and font loading. Development fixtures are excluded from the extension build. Fixture mode never returns a canned summary for unrelated text.

The original studio remains at `prototypes/tldr.html`. Its saved preset and `prototypes/tldr-ui-spec.md` are the visual reference. The extension imports that frozen preset; it has no appearance inspector.

## Implementation

`src/ui` owns the dialog, scoped styles, packaged font, word reveal, counter, slider, and progressive blur. `src/shared` owns validated types, Unicode word counting, and the cancellable summary session. `src/extension` handles Chrome selection, injection, local-token settings, and requests. `src/server` owns authentication, limits, prompt construction, and the OpenAI call.

The extension uses `activeTab` only after a context-menu invocation. A manual top-layer popover avoids page stacking/clipping, and Shadow DOM isolates the approved CSS. The font is decoded from bundled bytes so the page does not need to permit font requests. The panel defaults to 320 × 420px and clamps to the viewport. Drag the header to move it; drag the lower-right handle to resize. Click either handle for adjustment buttons, or focus it and use arrow keys (Shift for 1px steps). Outside clicks, Escape, and source-page scrolling leave it open; Close dismisses it. New selections replace the tray, and page navigation ends the session. Geometry lasts for the current tray only.

`POST /v1/summaries` accepts `{ requestId, text }` and returns `{ requestId, levels, wordCounts }`. Each level is a complete summary with `runs: [{ text, emphasis }]`. Counts are computed exactly in code; the UI shows “~ x words,” rounded up to the nearest ten. Counter rolls travel through intermediate integers with blur, then settle directly without a finishing pulse or blink. Model output is rendered as text, never HTML.

Passages with at least 40 Unicode words receive five progressively expanded levels; shorter passages receive one. Selections under four words get an instruction to select a complete sentence. Input is limited to 40,000 characters, two active requests, and ten attempts per minute. Passage requests use 20-second backend and 25-second UI deadlines; article jobs use 90 and 95 seconds respectively (see Adaptive summary lengths below). Sparse highlights in substantial new details trigger at most one corrective generation within that same backend deadline; this can use a second provider call. A failed attempt offers Retry; dragging the slider makes no API calls.

For longer passages, the provider returns a composition plan with a shared lead sentence, a short insertion inside it, and ordered supporting parts. The backend compiles this into complete levels without rewriting retained words. Short selections use a single compact summary. The model annotates short prose runs with takeaway, qualifier, subject, supporting, or plain roles. Shared annotations retain the core as detail grows. The backend prioritizes the main takeaway, essential caveat, then context and supporting cues, and converts these into ordinary emphasis flags without separately quoted phrases. Subject-only output is rejected. Usually 1–3 words are emphasized per phrase; up to six are allowed to preserve meaning or negation. The guard permits `max(10, ceil(wordCount / 12))` phrases within `max(6, ceil(wordCount * .35))` highlighted words and excludes whole sentences. See [the highlight policy](docs/highlight-policy.md) and [live quality samples](docs/summary-quality-samples.md). The renderer matches retained words, animates their new positions, and reveals inserted details in reading order using the approved 500ms/29ms/3px reveal, including mid-sentence additions. Shared words move into place over 240ms. Shortening uses the previous fast exit (180ms with a bounded stagger), while gaps close immediately over 240ms; rapid changes cancel superseded motion.

The default model is `gpt-6-luna` with reasoning disabled, strict structured output, and `store: false`. Set `OPENAI_MODEL` to change the model only if it supports the same API features. No automatic model substitution occurs.

## Local security and data handling

The backend binds only to `127.0.0.1`. Every request requires the local bearer token. Requests with an Origin must match the configured extension; Chrome can omit Origin on privileged extension requests, so those also provide the configured extension ID. Foreign web Origins are rejected even if they supply that ID. The ID is routing validation, not a secret or a replacement for the token.

The local token is stored in extension storage restricted to trusted extension contexts. The OpenAI key stays on the server. TLDR sends only selected text, retains summaries only in memory while the panel is active, and does not log selected passages, generated text, or credentials. OpenAI’s account-level data policies still apply.

## Supported scope

Chrome 120+ on ordinary HTTP/HTTPS pages. Restricted browser pages, the Chrome Web Store, browser PDF viewers, and native applications are outside this release. Selections from frames can use a centered panel when their geometry is unavailable. Controls are English; summaries match the source language. RTL text and scripts absent from Inter use browser/system text rendering and fallback fonts.

## Validation

See `docs/validation.md`, `docs/browser-checks.txt`, and `docs/screenshots/` for the verification record. Live model quality remains a separate check from deterministic UI and contract tests.

After updating from the original append-only build, reload TLDR at `chrome://extensions` and refresh the source page. The backend and extension must both use the new `levels` response contract.

## Design studio

Run `npm run dev`, then open [Glass studio](http://127.0.0.1:4174/prototypes/tldr.html). The studio starts from the same locked preset as the extension, with current hybrid expansion, keyword fixtures, rolling counter, and slider behavior. **Reset to live** restores that baseline; individual resets and **Copy settings** remain available. Experiments autosave locally in `tldr.glass-studio.v4` and never modify the extension. Earlier v3 experiments remain stored separately.

`npm run sync:studio` embeds the shared preset, dialog CSS/markup, animation controllers, and fixtures into the standalone `prototypes/tldr.html`. Production builds run this sync automatically to keep the studio current. The HTML still works offline without runtime dependencies or AI calls. Its settings remain independent from the locked extension preset until explicitly promoted.

### Adaptive summary lengths

Selections under 40 words get one compact summary. Longer selections have five targets. Ordinary passages retain approximately 20/35/55/80/110 words (scaled down when needed). For articles, Detailed grows to 25% of the source, capped at 800 words; Essential/Concise/Balanced/Expanded cap at 60/140/300/550. Targets are approximate, not forced padding; actual counts are measured and displayed rounded up to ten.

| Source words | Essential | Concise | Balanced | Expanded | Detailed |
| --- | --- | --- | --- | --- | --- |
| 200 | 20 | 35 | 55 | 80 | 110 |
| 1,000 | 45 | 80 | 125 | 182 | 250 |
| 3,000 | 60 | 140 | 300 | 545 | 750 |
| 4,000 | 60 | 140 | 300 | 550 | 800 |

The 40,000-character input limit still applies. Provider output budget grows from 4,000 to 12,400 tokens, including annotations, rather than duplicating full levels. Highlight phrase limits grow with length. Word reveal retains its 500ms blur/rise, with the total stagger window capped at 3.2 seconds for long summaries. Passages retain the 20/25-second backend/extension deadlines. Articles use authenticated in-memory jobs with 90/95-second deadlines and one-second status polling, so each Chrome fetch is short. A 30-second polling lease cancels abandoned jobs; results are deleted after delivery or cancellation. Longer responses may cost more and take longer; timeout remains a retryable error. The design studio keeps its authored reference summaries.

To exercise long articles through the running backend with an original synthetic report: `TLDR_SMOKE_HTTP=1 node --env-file-if-exists=.env --import tsx scripts/adaptive-smoke.ts`. This makes a paid provider request and saves counts and sample output in `docs/adaptive-summary-smoke.json`.

## macOS background backend

`npm run service:install` installs the current backend and Node 24 runtime into `~/Library/Application Support/TLDR/backend`, with a per-user launch agent at `~/Library/LaunchAgents/com.tldr.backend.plist`. The service directory is private (0700); its environment file is 0600. Credentials are read from a private copy of the project's `.env`, never embedded in the launch-agent plist. The service listens only on `127.0.0.1:4317` and keeps the same authentication. No administrator privileges or system-wide daemon are needed.

- `npm run service:status`: checks launchd registration and authenticated backend readiness.
- `npm run service:restart`: rebuilds/reinstalls the current backend and refreshes `.env` from the project. Use after source or credential changes.
- `npm run service:uninstall`: stops the service, removes the login agent and its installed files/credential copy; preserves the project and original `.env`.

The agent uses KeepAlive with a 10-second restart throttle. It runs while this user is logged in; it does not run before login, during sleep, or after logout. Startup errors go to the private service directory's `service-error.log`; regular output is discarded. Selected text, summaries, and credentials are not deliberately logged. If port 4317 belongs to a manually started backend, installation asks you to stop that process instead of killing an unknown listener.

The extension cannot start a local OS process on its own. Previously, a backend launched from a temporary terminal session could disappear when that session ended, causing the recurring “Start the local TLDR backend” error. The login service removes that dependency.
