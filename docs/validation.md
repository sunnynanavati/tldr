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

## 2026-10-14 — missing highlight regression

The maximum-only prompt and emphasis filter could yield zero visible keywords. The provider now returns a required list of exact keyword candidates separately from text composition. The first candidate is a meaningful shared word; backend projection applies candidates on Unicode word boundaries, preserves the summary text, and checks that each multiword level retains a highlight. Punctuation around candidates is normalized. The approximate 20% budget rounds up, so short summaries and multi-unit Chinese keywords are not unnecessarily stripped. Whole sentences, partial-word matches, and oversized phrases remain excluded. Invalid keyword output follows the existing retryable provider-error path rather than returning an unhighlighted summary. No extra provider call or public response-contract change is introduced.

`npm run verify` passed: TypeScript, lint, 42 tests, and production builds. New regression tests cover an all-false composition resembling the reported movie summary, shared highlights across levels, punctuation, absent/invalid candidates, Chinese, and very short summaries. The live smoke test now asserts and prints surviving highlights: English long (14/30/51/69/101 words) retained environments, focused work, and automatic distractions as applicable; English short retained decisions and owners; Chinese retained 图书馆 and 开放时间. Backend restarted with the fix; existing extension builds using the levels contract need only request a new summary.

## 2026-10-14 — live design studio synchronization

The standalone studio now embeds the extension’s preset, dialog markup/CSS, SummaryReveal, WordCounter, and DetailSlider from shared source. Its sample levels use the current hybrid expansion fixtures and restrained keywords. The shared reveal and counter accept an optional tuning getter; the extension continues to use the frozen preset by default. `npm run sync:studio` regenerates the inline bundle; `npm run build` includes synchronization automatically. Inspector controls remain local, with v4 experiment storage and Reset to live; older v3 data is retained.

Validation: type checking, lint, all 42 unit/integration tests, and production builds passed. All 19 production browser checks passed after the shared-controller change. Studio browser checks confirmed all 23 numeric inputs match the locked preset; 320 × 420 px, 36 px corners, 13 px text / 20.02 px line height, matching tint/blur, 64 px top blur and 83.6 px bottom blur. Tested radius tuning, persistence across reload, Reset to live, counter timing controls/preview, replay, and rapid slider reversals with no stale words or console errors. The 319 px viewport clamped the card to 287 px without horizontal overflow. Studio uses authored fixtures and makes no AI calls. Current URL: http://127.0.0.1:4174/prototypes/tldr.html.

## 2026-10-14 — persistent, movable, resizable tray

- Count presentation now rounds up to tens (`56 → ~60 words`), including accessible count/slider labels. Exact backend counts remain unchanged. Four reusable reels support the rounded upper bound of 1000.
- Provider candidates increased from four to twelve, with instructions to distribute short highlights through longer summaries. The guard permits ten phrases within a 28% ceiling; whole sentences remain excluded. The live English test retained nine short highlights in its longest level; short English and Chinese also retained meaningful highlights. No extra API call was added.
- Mid-sentence additions now use the full approved 500ms reveal, 29ms reading-order stagger, 3px blur, and 5px rise. Shared words retain their nodes and move over 240ms; exits remain fast. This deliberately supersedes the earlier 180ms expansion cap. Rapid reversals still cancel/resume from current visual state.
- Header dragging and corner resizing use pointer capture and one layout write per animation frame, with immediate pointer tracking and viewport bounds. Arrow keys and click adjustment buttons provide alternatives. Resize reserves room beside the slider for its handle. Defaults remain 320×420, with a 260px minimum dimension when the viewport permits.
- Outside clicks, Escape, and source-page scrolling no longer dismiss the tray. Close remains available throughout loading/errors. New selections replace the active tray; navigation still ends the session. Geometry is local to the active tray, not persisted across selections.
- Studio uses the same geometry controller, counter formatting, reveal controller, markup, styles, and fixtures. Inspector dimensions reflect committed resize gestures; Reset to live clears experimental geometry.

Validation: `npm run verify` passed (type check, lint, 49 tests, production builds). All 26 browser integration checks passed at verified 1280×800 and 319×800 viewports, covering insertion blur/keyframes, keyboard movement and resizing, click alternatives, final-line clearance after resizing, retained geometry, close-only behavior, interrupted motion, reduced motion, and slider operation. Real pointer gestures moved the preview by 140×65px and resized it by 90×70px; subsequent gestures verified a 440×520 tray. Copy reported success and an outside page-theme click left the tray open. No browser console errors were observed. The live AI smoke test passed English long/short and Chinese fixtures; model prose/count targets remain approximate (long counts: 13/17/29/43/92). The local backend was restarted with the updated prompt.

The browser checks exercise the production Shadow DOM dialog in the development harness. The installed native Chrome extension must be reloaded, followed by refreshing the source webpage, to pick up the new build; native context-menu invocation was not repeated in this pass.

Screenshot: [Movable and resizable tray](screenshots/movable-resizable-tray.png).

## 2026-10-14 — bidirectional reveal and continuous counter

Shortening now uses the approved 500ms/29ms/3px word motion in reverse, rather than the previous 180ms exit cap. Exit easing is the time-reversed entrance curve. Removal follows reading order so a visible inline deletion starts before an offscreen tail. Shared words retain their prior positions until departing details fade, then close the gaps over 240ms. Replacement punctuation waits too, avoiding overlap. The paragraph temporarily retains its height to prevent early scroll clamping; interrupted changes sample the current visual state and cancel superseded timers/animations. Reduced motion remains immediate.

The counter follows one numeric timeline through every integer between rounded display targets. Digit paths synchronize carry and borrow boundaries, including 90↔110 and 990→1000. Interrupted rolls retain their visible glyph pair and fractional position. The 720ms roll and 1.5px blur remain; pulse, fade, blink, scale, and spring choreography were removed, along with their obsolete studio controls/defaults. Counts still settle to approximate tens.

Per the user's clarification, the **top** blur band has no dark tint. The **bottom** tint overlay is 120% of its previous height and remains anchored at the bottom. Blur layer strengths, top/bottom blur heights, and text-mask clearance are unchanged.

`npm run verify` passed: type checking, lint, 53 tests, and production builds. Four new pure counter-path tests cover intermediate values, zero-ending reels, carry/borrow synchronization, and interrupted reversal. Browser checks now include reverse mid-sentence keyframes, delayed gap closure, numeric ones-reel travel, absence of finishing accent animation, and independently measured tint/blur heights. All 31 checks passed on desktop and narrow viewports during validation; no console errors were observed. The design studio runs the shared controllers and now exposes only rolling blur and roll duration in its counter section. No provider/backend behavior changed and no AI calls were required.

## 2026-10-14 — restore shortening and soften footer tint

Restored `src/ui/reveal.ts` exactly to the previously approved implementation at `9cdfcc2`: quick 180ms exits with bounded stagger and immediate 240ms gap closure. This removes the delayed layout and paragraph-height hold introduced in the last revision. Expansion retains its original reveal. Continuous integer counter rolls and removal of the finishing pulse remain unchanged.

The bottom tint keeps its 120% height but now uses a smooth multi-stop opacity ramp across the full band, with gentle slopes near transparent and maximum tint. The top tint remains absent; blur layers, blur heights, and scrolling clearance remain unchanged. The studio embeds the same updated implementation.

Validation: type checking, lint, all 56 current unit/integration tests, and production builds passed. All 31 browser checks passed at 1280×800, including shortening, interrupted reversals, counter continuity, final-line clearance, and independent tint/blur heights. No browser console errors. The reveal source matches the earlier version exactly. No AI calls or backend restart were needed. These checks use the production dialog in the development harness; reload the installed extension and refresh the source page to use the rebuild.

## 2026-10-14 — fixed highlight decisions and 40% footer tint

Composition now preserves source-run identity. Highlight selection reserves all previously selected cues before considering newly appearing cues and locks earlier muted cues too. This prevents additions from displacing an existing highlight or promoting a previously muted phrase solely because the budget grew. The final presentation guards still apply. Regression tests cover the reported “flopped”/“succeeded commercially” pattern, newly competing high-priority cues, muted cues, and source identity across inserted details.

Footer tint now spans 40% of the inner dialog height, updated on resize, using the existing eased opacity ramp. Its blur remains independently sized (20% at defaults). Studio uses the same CSS and corresponding geometry. Top tint remains absent.

Validation: type check, lint, 65 tests, and production builds passed. All 31 browser checks passed, including the measured tint/blur ratio, scrolling clearance, and motion regressions; no console errors. Light and dark fixture pages were inspected. One live fixture request returned invalid generated output; a second provider request validated successfully with counts 11/23/44/63/98. These live checks do not guarantee that every model response will pass validation. Backend restarted with the new code. Native installed-extension context-menu flow was not repeated; reload the extension, refresh the page, and generate a new summary.

## 2026-10-14 — expanded-highlight coverage and actual footer seam fix

Reproduced a generated narrative where 32 added words carried only a malformed cue (“did not know of the”). The presentation guard discarded it but the result was still accepted with no new highlights. Added a coverage check for 12+ newly introduced words: new accepted cues must cover at least floor(12% of added words), minimum one, and at least one cue per 25 added words. Existing highlighted and muted source-run decisions remain fixed. A coverage failure triggers one corrective generation at most, within the original abort/deadline; it never publishes the sparse result. The second call can add latency and token cost. Tests cover sparse and malformed additions, successful correction, and the two-attempt cap.

The footer seam was reproduced with the approved 40% tint height. Temporarily disabling the stacked backdrop filters removed it, identifying repeated glass-surface sampling as the source. A neutral `filter: opacity(1)` on the text viewport now establishes a backdrop root, keeping edge filters in the text plane. Blur layers remain enabled with the same strengths/heights, and the 40% eased tint remains. This follows the [CSS Filter Effects backdrop-root definition](https://github.com/w3c/csswg-drafts/blob/main/filter-effects-2/Overview.bs). Short and long screenshots confirm a continuous glass surface while text still blurs at the edge. The standalone studio embeds the same correction.

Type checking, lint, all 69 unit/integration tests, and production builds passed. All 32 browser integration checks passed, including the isolated text plane, enabled filters, tint/blur dimensions, text scrolling clearance, and motion controls. No console errors. A live advice fixture produced counts 34/48/71/89/111 and grew from 3 to 4/6/7/8 visible cues while preserving earlier ones. A separate narrative fixture failed final summary-contract validation; arbitrary model outputs still may require Retry. This is not a blanket guarantee of semantic quality. The backend was restarted. Reload the installed extension, refresh the source page, and request a new summary to test the updates.


## Adaptive article lengths — 2026-10-15

- Five targets grow with the source: Detailed targets 25% of article words, capped at 800; the other caps are 60/140/300/550. Ordinary passages retain the existing baseline, short passages still get one summary. Tested monotonicity and strict increases over source lengths 40–40,000.
- Expanded output/run/highlight budgets and prompt/schema guidance support long articles without removing shared highlight decisions. Initial reveal keeps its per-word motion but caps the arrival stagger window at 3.2 seconds.
- Articles use authenticated POST/GET/DELETE `/v1/summary-jobs` exchanges. Work is memory-only, capped by concurrency/rate limits, a 90-second deadline, and a 30-second polling lease. The content controller polls through fresh worker messages and has a 95-second timeout. Cancellation works without relying on worker-global job state; abandoned work expires. Ordinary passage requests retain the existing synchronous endpoint and deadlines.
- `npm run verify`: type checking, lint, all 79 tests, studio synchronization, and production builds passed. Added transport/server tests cover polling, stale IDs, auth, duplicate starts, result recovery/cleanup, explicit cancellation, orphan expiry, deadlines, and concurrency release.
- Browser: all 35 checks passed; no console errors. The 800-word stress fixture verifies bounded arrival motion, rapid reversals, complete scrolling, and footer clearance. This is an in-app browser harness check, not a new native Chrome context-menu test.
- Live synthetic report: 2,322 source words, targets 60/140/291/423/581. Final authenticated job produced 49/90/223/328/480 words, 4/6/11/16/23 highlighted phrases, in 13.1 seconds. The result was deleted after retrieval. Full non-private sample is in `adaptive-summary-smoke.json`.
- The first prompt iteration still underfilled targets; explicit article budgets and multiple-parts-per-level guidance corrected that. Another direct-provider check produced 469 detailed words in 34.9 seconds, motivating the longer job path. One intermediate live backend attempt was rejected; model output remains variable and Retry may be necessary. No exact length or universal fidelity guarantee is claimed.
- Surface values were inspected, not retuned: 95% #1e1e1e to 98% #111111, 1px backdrop blur; 64px header blur with no tint; 20%-height footer blur; independent 40%-height footer tint easing from transparent to 12% black. Eight edge-blur layers range from .5px to 12px. Reference screenshot: `screenshots/adaptive-material-baseline.png`.
- Rebuilt `dist/extension` and `dist/tldr-chrome.zip`; restarted the configured loopback backend. Chrome must reload the extension and refresh existing source tabs to load the new contract and polling code.


## Footer tint studio controls — 2026-10-15

Added independent footer tint height and opacity controls (0–100%, defaults 40%/12%) with numeric inputs, keyboard sliders, individual reset, persistence, and settings export through the existing studio infrastructure. Existing experiments inherit the new defaults without losing their other adjustments. Shared CSS uses a normalized opacity curve, preserving the approved material at the defaults.

Verified 65% height/30% opacity in the browser, persistence after reload, keyboard Home producing fully transparent tint, and both resets returning to 40%/12%. Footer blur stayed at 83.6px during these adjustments. No console errors. Type check, lint, all 79 tests, studio synchronization, and production builds passed. Screenshot: `screenshots/footer-tint-controls.png`.


## Approved production footer tint — 2026-10-15

Promoted the screenshot values into the shared production preset: footer tint height 100%, opacity 50%. Updated the UI specification and studio reset baseline. Blur geometry and text clearance are unchanged. Also removed an unintended link between footer tint opacity and the card’s outer one-pixel shadow; that shadow retains its original 12% opacity. Type checking, lint, all 79 tests, and production builds passed. Rebuilt the unpacked extension and ZIP.


## Persistent local backend — 2026-10-17

The reported connection error was reproduced as no listener on 127.0.0.1:4317, with no TLDR launch agent installed. Replaced reliance on a temporary development process with the per-user `com.tldr.backend` launch agent. It starts at login and uses KeepAlive with a 10-second restart throttle. The installer bundles the server and dependencies and copies Node 24 into private Application Support storage, outside the Documents checkout. The installed environment is 0600; the service directory is 0700; the plist contains paths, not credentials. The endpoint remains loopback-only with existing authentication.

Validation: authenticated health ready; listener confirmed on 127.0.0.1 only; plist validated by plutil. Sent SIGTERM through launchctl to the named service: PID 63022 was automatically replaced by 63538, and authenticated health returned ready again. A real request using an original short fixture returned HTTP 200 with one 25-word summary. Type checking, lint, and all 79 existing tests passed. No extension update or Chrome reload is necessary for this startup fix. Actual logout/reboot was not performed.

Added `service:install`, `service:restart`, `service:status`, and `service:uninstall`; documented the private environment snapshot and requirement to reinstall/restart after backend code or project .env changes. No user article text or credentials were printed in validation output.
