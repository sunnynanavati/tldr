# TLDR

A Chrome extension that summarizes selected text in the approved floating glass dialog. The slider switches locally between five progressively expanded levels, preserving shared text and the original animations.

## This workspace

The unpacked extension is loaded in Chrome with ID `nlaaihiaadichmkeccfhdebglmbhlnnf`. Its local connection token is already saved in Chrome and the ignored `.env` file. **Add your OpenAI API key to `OPENAI_API_KEY` in `.env` to enable real summaries.**

Use Node 24. A project-local runtime was installed for validation without replacing your system Node:

```sh
export PATH="$PWD/.runtime/node_modules/.bin:$PATH"
npm run dev:server
```

Only one backend can use port 4317 at a time. Stop an existing backend with Ctrl-C before changing between real and fixture mode. Open TLDR’s extension settings and choose **Save & test connection** to confirm that the backend and API configuration are ready. Then select text on an ordinary webpage, right-click, and choose **TLDR**.

## Fresh setup

1. Install/use Node 24 LTS (`.nvmrc` specifies 24), then run `npm ci` and `npm run build`.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/extension`.
3. Create `.env` from `.env.example`. Add `OPENAI_API_KEY`, generate a local token with `npm run token`, and set `TLDR_EXTENSION_ID` to the ID Chrome shows. Keep `.env` private and untracked.
4. Run `npm run dev:server` (or `npm start` after building).
5. Open the extension’s connection settings. Paste **TLDR_LOCAL_TOKEN**, save, and test. Never paste the OpenAI key into the extension.

After source changes, run `npm run build`, click **Reload** on TLDR’s card in `chrome://extensions`, and reload pages that previously used TLDR. The backend reads `.env` at startup; restart it after editing that file.

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

`POST /v1/summaries` accepts `{ requestId, text }` and returns `{ requestId, levels, wordCounts }`. Each level is a complete summary with `runs: [{ text, emphasis }]`. Counts are computed exactly in code; the UI shows “~ x words,” rounded up to the nearest ten. Model output is rendered as text, never HTML.

Passages with at least 40 Unicode words receive five progressively expanded levels; shorter passages receive one. Selections under four words get an instruction to select a complete sentence. Input is limited to 40,000 characters, two active requests, and ten attempts per minute. The backend aborts after 20 seconds and the UI times out after 25 seconds. A failed attempt offers Retry; dragging the slider makes no API calls.

For longer passages, the provider returns a composition plan with a shared lead sentence, a short insertion inside it, and ordered supporting parts. The backend compiles this into complete levels without rewriting retained words. Short selections use a single compact summary. The model selects 8–12 candidate keywords or short phrases, aiming for 15–25% emphasis distributed across each longer summary. The presentation guard permits up to ten phrases and a 28% word budget (rounded up to a whole word); whole-sentence emphasis is removed. The provider explicitly selects exact keywords, including one shared core keyword; the backend applies these and rejects multiword summaries with no usable highlight instead of silently rendering unhighlighted text. The renderer matches retained words, animates their new positions, and reveals inserted details in reading order using the approved 500ms/29ms/3px reveal, including mid-sentence additions. Shared words move into place over 240ms. Shortening reverses the reveal; rapid changes cancel superseded motion.

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
