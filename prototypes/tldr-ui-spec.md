# TLDR — approved UI baseline

Approved by the user on October 13, 2026, with interaction refinements requested October 14, 2026. This is the visual and interaction reference for the TLDR component implementation.

The current browser preset matches both the inline defaults in [tldr.html](tldr.html) and the persistent backup in [tldr-defaults.json](tldr-defaults.json). Reset all and individual resets restore this approved preset. Existing browser preferences continue to persist normally.

## Appearance and layout

- One dark dialog with a subtle illuminated edge and a gradient from surface level 2 at 95% tint to the darker lower surface at 98% tint. Backdrop blur is 1px.
- Configured width 320px and overall height 420px, with 36px corners and 20px content padding. Width clamps to the available viewport.
- Header: TLDR mark and name on the left; Copy and Close on the right.
- Footer: centered approximate word count (“~ x words,” rounded up to tens) above the horizontal length slider. Preserve the tight spacing, the 32px slider hit area, and the fixed footer position.
- Embedded Inter Variable typography: body 13px with 1.54 line height, white emphasized phrases, and secondary text at 75% brightness. The counter uses the same secondary color.
- The scroller spans the whole dialog and lets text pass behind the header and footer. At the end of scrolling, the last line clears the footer fade by about 8px.
- Top progressive blur ends 12px below the header (64px at the approved padding) and follows scrolling. Footer progressive blur covers 20% of the inner dialog height and stays visible. The top band has no dark tint; the bottom tint overlay extends to 120% of its blur band height, without changing the blur itself.
- The Inbox canvas is the approved prototype viewing context. The dialog's material and layout are the implementation reference.

## Interaction and motion

- Initial detail is Balanced: the middle of five authored lengths. The current hybrid offline fixture has 20, 35, 50, 80, and 110 words.
- The slider tracks the pointer continuously, selects the nearest summary preset while dragging, and settles onto that preset over 160ms on release. Keyboard arrows move one preset; Home/End select the endpoints.
- Initial summary reveal: a 5px upward word reveal, 500ms duration, 29ms word stagger, and 3px blur. Expansion preserves shared words and uses the same reveal timing for new words anywhere in the paragraph. On shortening, words reverse the full reveal timing and shared text closes its gaps over 240ms after departure. Punctuation replacements wait for the outgoing text to avoid overlaps. The full expansion stagger is intentionally longer so inserted details are perceptible.
- Changed counter digits roll vertically for 720ms. Their blur reaches 1.5px over 80ms, stays through 70% of the roll, and clears as the digits settle. The reels follow every intermediate integer, with synchronized carries/borrows; the ones reel moves even between multiples of ten. Units remain steady.
- Counter finish: settle directly to crisp digits in the default color. No scale pulse, opacity fade, blink, or spring.
- Rapid changes retarget the currently rendered digit position and blur and cancel superseded animation. Keep digit reels reusable through interruptions; the approximation mark and units remain readable. Four slots accommodate rounding 999 up to 1000. The footer and slider stay fixed during count changes.
- Drag the header to move the tray; use the lower-right resize handle to resize. Click either handle for adjustment buttons, or focus it and use arrows (Shift for 1px steps). Bounds retain 16px viewport margins; minimum dimensions are 260px unless the viewport is smaller. The slider has 32px horizontal inset to leave room for the corner handle.
- Only Close dismisses the active tray: outside clicks, Escape, and page scrolling leave it open. A new selection replaces it, and navigation ends the session. Copy, reopening, and keyboard navigation remain functional. Reduced motion immediately presents final text and digits, with an immediate slider snap on release.
- The inspector is the prototype's tuning interface. Word-count settings have individual resets, persistence, and a preview transition.

## Frozen settings snapshot

The approved values below preserve this decision independently of future browser tuning.

```json
{
  "version": 3,
  "component": "tldr-liquid-glass",
  "radius": 36,
  "width": 320,
  "padding": 20,
  "height": 300,
  "depth": 2,
  "opacity": 95,
  "blur": 1,
  "edge": 5,
  "shadow": 20,
  "fontSize": 13,
  "lineHeight": 1.54,
  "muted": 75,
  "emphasis": true,
  "duration": 500,
  "stagger": 29,
  "textBlur": 3,
  "reduced": false,
  "backdrop": "inbox",
  "progressiveEnabled": true,
  "progressivePosition": "both",
  "progressiveLevels": [
    0.5,
    1,
    2,
    3,
    4,
    6,
    8,
    12
  ],
  "progressiveScrollAware": true,
  "progressiveHeight": 20,
  "counterBlur": 1.5,
  "counterRoll": 720
}
```

## Visual references

- [Approved dialog](screenshots/approved-ui.png)
- [Word-count controls](screenshots/word-count-settings.png)
