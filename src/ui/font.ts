import fontData from './assets/InterVariable.woff2?url';
let loaded: Promise<void> | undefined;
export function loadFont(): Promise<void> {
  loaded ??= (async () => {
    // Bundle font bytes and register them directly. No font network request or page CSP dependency.
    const base64 = fontData.split(',')[1];
    const bytes = base64 ? Uint8Array.from(atob(base64), char => char.charCodeAt(0)) : await fetch(fontData).then(r => r.arrayBuffer());
    const font = new FontFace('TLDR Inter', bytes, { weight: '100 900', style: 'normal' });
    await font.load();
    document.fonts.add(font);
  })();
  return loaded;
}
