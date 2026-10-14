# TLDR glass studio

**Approved implementation baseline:** the current browser UI and full preset were locked on October 13, 2026. Use [tldr-ui-spec.md](tldr-ui-spec.md) as the layout, interaction, and frozen-settings reference for the component implementation.

One liquid-glass summary dialog with live material, typography, motion, and background controls. Open `tldr.html` directly or serve this folder:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory prototypes
```

Preview: http://127.0.0.1:4173/tldr.html

## Controls

- **Canvas:** Article, Documentation, and Inbox are authored, static reading contexts. Glow, Ink, and Mist remain available for isolated inspection. The backgrounds are decorative; they do not restore a source-selection workflow.
- **Shape:** corner radius, width, padding, and summary text-area height.
- **Glass & depth:** surface level, tint opacity, backdrop blur, edge light, and shadow depth.
- **Progressive blur:** enable/disable, Header / Footer / Both, independent Footer blur height (0–50% of the dialog), Header follows scrolling, and eight editable blur levels (0–64px each, in 0.5px steps). Each control has its own reset.
- **Typography:** size, line height, secondary-text brightness, and phrase emphasis.
- **Word count:** rolling blur (0–6px), roll duration (120–3000ms), fade duration (0–1000ms), fade opacity (0–100%), fade scale (90–100%), spring duration (80–1500ms), and spring overshoot (0–12%). Each has a slider, numeric field, and reset. **Preview transition** switches between the shortest and longest summaries; on narrow screens it brings the dialog into view. Changes apply to the next count transition.
- **Motion:** reveal duration (120–2000ms), word stagger (0–250ms), reveal blur (0–40px), and reduced motion. Sliders and numeric fields share these ranges. Replay uses the full selected duration and stagger; the saved defaults are 500ms and 29ms.

All 37 editable controls have adjacent reset buttons, disabled when already at their defaults. **Reset all** restores all styling defaults. **Copy settings** exports JSON, including the progressive-blur levels. Sliders and valid number inputs update immediately; leaving a numeric field or pressing Enter clamps its value to the supported range.

The original styling defaults match the complete settings JSON supplied by the user on October 13, 2026, including shape, material, typography, motion, background, and progressive blur. New word-count defaults preserve the subsequently approved animation: 1.5px blur, 720ms roll, 80ms fade to 18% opacity and 98.5% scale, and a 320ms spring with 2.5% overshoot. Older saved settings gain these keys without changing their existing values. They are embedded in `tldr.html` and backed up in [`tldr-defaults.json`](tldr-defaults.json), independent of browser storage. Reset all and each individual reset restore this preset. The backup is a record; the standalone HTML does not fetch it at runtime.

Settings persist under `tldr.glass-studio.v3`, with an in-memory fallback when local storage is unavailable. V2 settings migrate with all non-motion values preserved and the current reveal defaults restored. V1 settings also migrate, updating untouched typography and contrast defaults. Summary length remains separate session state.

Use **R** to replay/open the dialog and **H** to hide/show controls. Shortcuts ignore editable fields. **Escape** closes the focused preview; Close, Show dialog, and Copy work. On narrow screens, **Adjust settings** jumps to the inspector below the specimen. The length slider sits in a fixed footer, with the live word count centered above it. Its native thumb moves continuously while dragging; the summary selects the nearest of five presets as each midpoint is crossed. Releasing the pointer settles the thumb onto that preset over 160ms. Starting another drag cancels the snap immediately. Arrow keys and Page Up/Down move one preset at a time; Home/End choose the endpoints. Reduced motion keeps continuous dragging and snaps immediately on release. Its visible track is 3px with a 13px thumb inside a 32px-high hit area; the extra count-to-slider row gap is zero. The native input retains its 32px hit area, leaving 16px from the caption line box to the track center (previously 20px). This applies the Fluid Functionalism skill’s compact grouping and generous hit-area guidance without changing the saved type size or slider position. Footer controls align with the paragraph margins. Copy and Close remain separate 32px header buttons. DOM and keyboard order follow header → summary → footer. There is no “Scroll for more” cue.

The scroll viewport still spans the entire inner glass, so text can pass behind the header and footer. Initial padding places the paragraph 16px below the header controls. End padding reserves the larger of the footer controls plus 16px or the footer blur plus 8px, so the last line is fully sharp at the end of scrolling. Wheel gestures over fixed chrome also scroll the summary. Overall dialog dimensions and saved styling values are preserved.

## Typography and motion

The word count uses three fixed-width, tabular digit slots so switching between two and three digits never moves the units or slider. At default settings, only changed digits roll vertically, in the direction of the length change, for 720ms with the existing ease-out curve. Moving places soften to 1.5px blur over 80ms, hold that blur through 70% of the roll, then resolve to sharp text as they settle; unchanged places stay crisp. Blur uses a separate linear clock so the roll’s strong ease-out does not clear it prematurely. Interrupted rolls preserve the current blur as well as the reel offset. The numeric group then pulses to 103.5% and back over 160ms, dips to 18% opacity and 98.5% scale over 80ms, and rebounds through 102.5% to 100% over 320ms. “words” stays still at full opacity. The digits inherit the default text color through rolling, fading, and reappearance; no color flash is added. Each reel has vertical glyph clearance; the outer group allows the pulse to extend without clipping. Rapid changes preserve each reel’s currently rendered offset, cancel superseded accents, and trim offscreen rows. Closing or replaying settles the count immediately. Reduced motion shows final digits immediately and skips the pulse, dip, and rebound. An unsplit accessible count updates with the selected preset; rolling glyphs are hidden from assistive technology. This requested counter timing is independent of the saved summary-reveal settings.

The [Magic UI Progressive Blur](https://magicui.design/docs/components/progressive-blur) reference supplies the layered backdrop-filter/mask approach and visual settings: height, position, and blur levels. Footer blur height defaults to 20% (about 84px at the saved 320 × 420 size). The top blur remains header height plus 12px: 64px at default padding. The eight levels are tuned to `[0.5, 1, 2, 3, 4, 6, 8, 12]` px for this compact text surface; every level supports up to 64px, including the reference's original `[0.5, 1, 2, 4, 8, 16, 32, 64]` curve. The offline adaptation anchors independent bands to the physical top and bottom of the dialog, across its full inner width. The rounded glass clips the entire scroll surface and blur together. Only scrolling text is masked before the sibling filters sample it, reducing bright glyph haze. Both bands attenuate scrolling text before it reaches the fixed controls. The top band ends exactly 12px below the header. The footer height is independently adjustable and covers at least its controls plus 12px, unless disabled or set to zero. The filters have no color fill; a transparent-to-black gradient adds at most 12% darkness at each outer edge. Header controls paint above the effect. Eight layers per edge are only rebuilt when their values change. No React package or network request is needed.

**Header follows scrolling** is on by default: the top band appears when content scrolls upward; turn the switch off to preview it continuously. The footer band stays at full visibility even when content fits or scrolling reaches the end. Enable, Position, and a zero Footer blur height remain explicit ways to disable the relevant effect. The restored `progressiveHeight` setting controls only the footer and defaults to 20 when absent from saved settings; `progressiveScrollAware` controls only the header. All other styling values are preserved. Overlays are decorative and ignore pointer events. Unsupported backdrop filters retain the text fade and faint dark edge gradient; forced colors disables both blur and text masking. Reduced motion keeps the static edge treatment while skipping word-reveal animation.

The [Fluid Functionalism typography system](https://www.fluidfunctionalism.com/docs/typography) supplies the five roles: display 28/34, title 16/22, subtitle 14/20, body 13/20, and caption 12/16. The prototype uses an embedded Inter Variable 4.1 font, weights 400/550/700, zero added tracking, optical sizing, and foreground/muted colors. Body leading is represented as 1.54 in the live editor (20.02px at 13px). The Inter SIL Open Font License is embedded in the HTML comment. No font request is needed at runtime.

The original [beUI Text Reveal](https://beui.dev/components/motion/text-animation) inspired animation uses cancellable native Web Animations. The user's saved tuning is 500ms per word, 29ms stagger, 3px blur, a 5px rise, and cubic-bezier(.23,1,.32,1). There is no initial delay or scaling. At these defaults, the middle summary settles in about 2.10 seconds. Replay has no overall stagger cap: its total time is reveal duration + (word count − 1) × stagger. Length changes preserve shared segments and settle within 240ms in both directions. Shortening reverses the word order: the last words fade, move down 5px, and blur out first. Exiting segments stay in flow until their words finish. Rapid direction changes retain the same word nodes and animate from their current rendered opacity, position, and blur; superseded animations and removal timers are cancelled.

Reduced motion shows complete unsplit text immediately. System preferences override the manual toggle. Assistive technology receives readable unsplit text and a single settled-summary announcement, rather than each animated word.

The [Fluid Functionalism surface system](https://www.fluidfunctionalism.com/docs/surfaces) informs the eight elevation tokens and glass tint. The user's saved material is surface level 2, 95% tint, and 1px backdrop blur, with 75% secondary-text brightness on the Inbox background. The dialog defaults to 320 × 420px, 36px corners, and 20px padding. This deliberately prioritizes consistent contrast over strong backdrop frosting; automatic backdrop compensation is not included. Extreme custom combinations can still reduce contrast. An opaque fallback is provided when backdrop filtering is unavailable.

## Penpot

[Open the editable design](https://design.penpot.app/#/workspace?team-id=fd558256-f8c8-8184-8008-c1d243607007&file-id=91396aad-60c8-808b-8008-c1d839d5c420&page-id=91396aad-60c8-808b-8008-c1d839d5c421).

Added to the existing page without replacing prior work:

- TLDR — Glass studio · Article
- TLDR — Glass studio · Documentation
- TLDR — Glass studio · Inbox
- TLDR — Inspector · All material controls
- Reusable **TLDR / Liquid glass dialog** component, ten color assets, and five text styles.

Text, icons, geometry, gradients, shadows, and controls are native editable layers. Penpot's available Inter uses 600 as the closest supported weight to 550. The boards include clipped, editable blurred background studies so exported glass previews retain frosting; native background blur is also set on the dialog. Export-compatible edge strokes and drop shadows replace zero-blur inner shadows. Motion and live sliders remain in the HTML prototype; the Penpot boards show the settled design.

## Verification

Word-count settings: all seven live controls, custom values across reload, individual resets, old-preset preservation, and preview reopening passed in the browser. Preview returns to the dialog on the narrow layout. Counter timing checks cover minimum and maximum roll/fade/spring values, including a zero-duration fade. The console is clean. Screenshot: `screenshots/word-count-settings.png`.

Counter softening: browser inspection confirmed nonzero blur during rolling, zero blur on settled digits, unchanged default text color, crisp immediate reduced-motion output, and clean rapid reversals. The console is clean. Screenshot: `screenshots/counter-softening.png`.

Slider and counter: checked native continuous dragging (including fractional positions between presets), snap on release, all five keyboard presets, rapid reversals, stationary units/footer, reduced-motion dragging, and closing/reopening mid-transition at the narrow 319px viewport. A focused counter simulation checked the requested timing/scale/opacity values and 500 interrupted reversals with bounded reels and correct final digits. All saved styling defaults still match the JSON backup. Screenshot: `screenshots/slider-counter.png`.

Saved-default preset: the inline defaults and JSON backup match the complete user-supplied export exactly. Verified fresh-default validation, Reset all, an individual backdrop-blur reset, reload persistence, and a clean browser console. Screenshot: `screenshots/saved-default-preset.png`.

The latest user-supplied preset uses an independent 20% footer blur. The tighter count-to-slider spacing and clear last-line padding remain.

Earlier layout checks below describe the preceding iterations.

Footer controls and independent header fade: checked at 1280px and 319px viewports, with 448px and 320px dialog widths. The top fade ends 12px below the header with footer height at 0%, 30%, and 50%. At maximum scroll, the final line clears the footer fade by approximately 8px; the footer stays visible at both scroll ends and for short summaries. All five word counts, rapid reversal cleanup, stationary controls, reduced motion, Tab order, arrow keys, Escape, reopening, and individual resets passed. Original saved values match the backup, and JavaScript syntax and browser console checks are clean. Screenshots: `screenshots/footer-controls.png` and `screenshots/footer-scroll.png`. OS-level 200% zoom, RTL, and a manual screen reader were not verified in this pass.


Edge-to-edge correction: verified the scroller bounds match the dialog’s inner bounds, scrolling text moves above the header toward the top edge, and both blur bands touch the outer edges. Checked the 320 × 372 specimen from the feedback at a 1280px viewport, then resized to 319px. Header wheel scrolling, first/last line readability, no cue, transparent treatment on dark Docs and light Article, 0/50% height, all positions, enable/disable, live blur level changes and individual resets passed. Rapid length reversals leave no stale words and keep the slider fixed. Reduced motion and Copy feedback passed; the console is clean. Screenshots: `screenshots/progressive-blur.png` and `screenshots/progressive-blur-header.png`. The saved style preset is unchanged.

Initial progressive-blur controls: checked at 1280px and 319px. Verified top/middle/bottom scrolling, hidden bands when content fits, always-on preview, all positions, 0–50% height, eight live blur levels, numeric clamping, all 30 individual reset states, and reload persistence. Header controls paint above the blur layers. Rapid summary changes and reduced motion still work; the console is clean. Screenshot: `screenshots/progressive-blur.png`. Backdrop-filter fallback and forced-colors behavior are implemented but not browser-emulated in this pass.

Reverse reveal: browser inspection confirmed last-to-first exit staggering with increasing blur, downward translation, and fading opacity. Checked mid-exit reversal, rapid endpoint scrubbing, removal cleanup, fixed slider placement, and immediate reduced-motion shortening. Counts and final text match, with no stale segments or console errors.

Header-slider refactor: checked at 1280px and 320px. All five lengths report the matching 20/35/56/83/111 word counts, with unchanged slider position. Rapid reversals leave no stale segments. Track clicks, arrow keys, visible keyboard focus, Copy (verified by native paste), Escape/reopening, long-summary scrolling, and reduced motion pass. All 18 saved defaults still match the preset backup; no console errors. Screenshot: `screenshots/header-slider.png`. Manual screen-reader testing, 200% zoom, and RTL rendering were not verified in this pass.

Checked in the browser: all three contexts, individual numeric/toggle/background resets, global reset, persistence, copying/export feedback, close/reopen, five summary lengths, rapid reversals, stable control placement, reduced motion, keyboard slider operation, and responsive layout at 360px. JavaScript syntax and whitespace checks pass; the console is clean. All runtime assets are inline, including the font. No API calls, runtime dependencies, or remote asset URLs.

Screenshots: `screenshots/glass-studio.jpg`, `glass-article.jpg`, `glass-docs.jpg`, `glass-inbox.jpg`, and `penpot-studio.png`. Direct file navigation is untested in the preview browser, which accepts HTTP(S) only.
