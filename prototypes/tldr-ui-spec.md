# TLDR — approved UI baseline

Approved by the user on October 13, 2026. This is the visual and interaction reference for the TLDR component implementation.

The current browser preset matches both the inline defaults in [tldr.html](tldr.html) and the persistent backup in [tldr-defaults.json](tldr-defaults.json). Reset all and individual resets restore this approved preset. Existing browser preferences continue to persist normally.

## Appearance and layout

- One dark dialog with a subtle illuminated edge and a gradient from surface level 2 at 95% tint to the darker lower surface at 98% tint. Backdrop blur is 1px.
- Configured width 320px and overall height 420px, with 36px corners and 20px content padding. Width clamps to the available viewport.
- Header: TLDR mark and name on the left; Copy and Close on the right.
- Footer: centered word count above the horizontal length slider. Preserve the tight spacing, the 32px slider hit area, and the fixed footer position.
- Embedded Inter Variable typography: body 13px with 1.54 line height, white emphasized phrases, and secondary text at 75% brightness. The counter uses the same secondary color.
- The scroller spans the whole dialog and lets text pass behind the header and footer. At the end of scrolling, the last line clears the footer fade by about 8px.
- Top progressive blur ends 12px below the header (64px at the approved padding) and follows scrolling. Footer progressive blur covers 20% of the inner dialog height and stays visible.
- The Inbox canvas is the approved prototype viewing context. The dialog's material and layout are the implementation reference.

## Interaction and motion

- Initial detail is Balanced: the middle of five authored lengths. The offline fixture has 20, 35, 56, 83, and 111 words.
- The slider tracks the pointer continuously, selects the nearest summary preset while dragging, and settles onto that preset over 160ms on release. Keyboard arrows move one preset; Home/End select the endpoints.
- Initial summary reveal: a 5px upward word reveal, 500ms duration, 29ms word stagger, and 3px blur. Expansion and shortening preserve shared words and settle within 240ms.
- Changed counter digits roll vertically for 720ms. Their blur reaches 1.5px over 80ms, stays through 70% of the roll, and clears as the digits settle. Unchanged digits and the units stay steady.
- Counter finish: pulse to 103.5% and back over 160ms; fade to 18% opacity and 98.5% scale over 80ms; spring through 102.5% to 100% over 320ms. Reappearance retains the default text color.
- Rapid changes retarget the currently rendered digit position and blur and cancel superseded animation. Keep three fixed digit slots so the units and slider do not shift.
- Copy, Close, Escape, reopening, and keyboard navigation remain functional. Reduced motion immediately presents final text and digits, with an immediate slider snap on release.
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
  "counterRoll": 720,
  "counterFade": 80,
  "counterFadeOpacity": 18,
  "counterFadeScale": 98.5,
  "counterSpring": 320,
  "counterOvershoot": 2.5
}
```

## Visual references

- [Approved dialog](screenshots/approved-ui.png)
- [Word-count controls](screenshots/word-count-settings.png)
