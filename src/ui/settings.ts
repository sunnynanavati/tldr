import preset from '../../prototypes/tldr-defaults.json';
export const settings = Object.freeze(preset);
export const EASE = 'cubic-bezier(.23,1,.32,1)';
export function applySettings(dialog: HTMLElement): void {
  const s = settings;
  const top = 23 + (s.depth - 1) * 7;
  const bottom = Math.max(17, top - 25);
  const variables: Record<string, string | number> = {
    '--radius': `${s.radius}px`, '--dialog-width': `${s.width}px`, '--padding': `${s.padding}px`,
    '--body-height': `${s.height}px`, '--glass-top': `rgb(${top} ${top} ${top} / ${s.opacity / 100})`,
    '--glass-bottom': `rgb(${bottom} ${bottom} ${bottom} / ${Math.min(.98, s.opacity / 100 + .17)})`,
    '--footer-tint-opacity': s.footerTintOpacity / 100,
    '--blur': `${s.blur}px`, '--edge': s.edge / 100, '--drop': s.shadow / 200,
    '--text-size': `${s.fontSize}px`, '--leading': s.lineHeight,
    '--body-color': `rgb(${Array(3).fill(Math.round(s.muted * 2.55)).join(' ')})`,
  };
  for (const [name, value] of Object.entries(variables)) dialog.style.setProperty(name, String(value));
}
