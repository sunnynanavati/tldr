import { EASE, settings } from './settings';
interface Slot {
  cell: HTMLSpanElement; reel: HTMLSpanElement; glyphs: string[]; target: string;
  animation: Animation | null; softening: Animation | null;
}
export class WordCounter {
  private slots: Slot[];
  private value: number | null = null;
  private accent: Animation | null = null;
  constructor(private digits: HTMLElement, private readable: HTMLElement, private reduced: () => boolean, private tuning = () => settings) {
    this.slots = Array.from({ length: 3 }, () => {
      const cell = document.createElement('span'); cell.className = 'counter-digit';
      const window = document.createElement('span'); window.className = 'counter-window';
      const reel = document.createElement('span'); reel.className = 'counter-reel';
      window.append(reel); cell.append(window); digits.append(cell);
      return { cell, reel, glyphs: [' '], target: ' ', animation: null, softening: null };
    });
  }
  private paint(slot: Slot, glyphs: string[]) {
    slot.glyphs = glyphs;
    slot.reel.replaceChildren(...glyphs.map(digit => {
      const glyph = document.createElement('span'); glyph.className = 'counter-glyph'; glyph.textContent = digit; return glyph;
    }));
  }
  private settleDigit(slot: Slot, digit: string) {
    slot.animation?.cancel(); slot.softening?.cancel(); slot.animation = null; slot.softening = null; slot.target = digit;
    this.paint(slot, [digit]); slot.reel.style.transform = 'translateY(0px)'; slot.reel.style.filter = 'blur(0px)';
  }
  private roll(slot: Slot, digit: string, direction: number) {
    if (slot.target === digit) return;
    const height = slot.cell.clientHeight || 16;
    const rendered = getComputedStyle(slot.reel), transform = rendered.transform, softness = rendered.filter;
    let offset = transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42 / height;
    slot.animation?.cancel(); slot.softening?.cancel(); slot.animation = null; slot.softening = null;
    const start = Math.max(0, Math.floor(offset) - 1), end = Math.min(slot.glyphs.length, Math.ceil(offset) + 2);
    const glyphs = slot.glyphs.slice(start, end); offset -= start;
    let target = direction > 0 ? glyphs.findIndex((char, i) => char === digit && i >= offset - .001) : -1;
    if (direction < 0) for (let i = glyphs.length - 1; i >= 0; i--) if (glyphs[i] === digit && i <= offset + .001) { target = i; break; }
    while (target < 0) {
      const edge = direction > 0 ? glyphs.at(-1) : glyphs[0];
      const next = edge === ' ' || digit === ' ' ? digit : String((Number(edge) + direction + 10) % 10);
      if (direction > 0) { glyphs.push(next); if (next === digit) target = glyphs.length - 1; }
      else { glyphs.unshift(next); offset++; if (next === digit) target = 0; }
    }
    this.paint(slot, glyphs); slot.target = digit;
    const from = `translateY(${-offset * height}px)`, to = `translateY(${-target * height}px)`;
    slot.reel.style.transform = to; slot.reel.style.filter = 'blur(0px)';
    const settings = this.tuning();
    const roll = settings.counterRoll, softBlur = `blur(${settings.counterBlur}px)`;
    const animation = slot.reel.animate([{ transform: from }, { transform: to }], { duration: roll, easing: EASE });
    slot.softening = slot.reel.animate([
      { offset: 0, filter: softness, easing: EASE },
      { offset: Math.min(80, roll * .2) / roll, filter: softBlur },
      { offset: .7, filter: softBlur, easing: EASE }, { offset: 1, filter: 'blur(0px)' },
    ], { duration: roll, easing: 'linear' });
    slot.animation = animation;
    animation.onfinish = () => { if (slot.animation === animation) this.settleDigit(slot, digit); };
  }
  set(words: number, instant = false) {
    this.readable.textContent = `${words} words`;
    if (words === this.value && !instant && !this.reduced()) return;
    const previous = this.value; this.value = words;
    const current = getComputedStyle(this.digits), from = { transform: current.transform, opacity: current.opacity };
    this.accent?.cancel(); this.accent = null;
    const digits = String(words).padStart(3, ' ');
    if (instant || this.reduced() || previous === null) { this.slots.forEach((slot, i) => this.settleDigit(slot, digits[i]!)); return; }
    this.slots.forEach((slot, i) => this.roll(slot, digits[i]!, words > previous ? 1 : -1));
    const settings = this.tuning();
    const roll = settings.counterRoll, pulse = 160, dip = settings.counterFade, rebound = settings.counterSpring;
    const total = roll + pulse + dip + rebound;
    const frame = (time: number, scale: number, opacity = 1) => ({ offset: time / total, transform: `scale(${scale})`, opacity, easing: EASE });
    this.accent = this.digits.animate([
      { ...from, offset: 0, easing: EASE }, frame(80, 1), frame(roll, 1), frame(roll + pulse / 2, 1.035), frame(roll + pulse, 1),
      frame(roll + pulse + dip, settings.counterFadeScale / 100, settings.counterFadeOpacity / 100),
      frame(roll + pulse + dip + rebound * .45, 1 + settings.counterOvershoot / 100), frame(total, 1),
    ], { duration: total, easing: 'linear' });
  }
  settle() { if (this.value !== null) this.set(this.value, true); }
  reset() { this.accent?.cancel(); this.slots.forEach(slot => this.settleDigit(slot, ' ')); this.value = null; }
}
