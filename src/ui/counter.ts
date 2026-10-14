import { EASE, settings } from './settings';
import { approximateCount, countLabel } from './count';
import { countJourney, digitPath, type CountStep } from './counter-path';
interface Slot {
  cell: HTMLSpanElement; reel: HTMLSpanElement; glyphs: string[];
  animation: Animation | null; softening: Animation | null;
}
export class WordCounter {
  private slots: Slot[];
  private value: number | null = null;
  private origin = 0;
  private clock: Animation | null = null;
  constructor(private digits: HTMLElement, private readable: HTMLElement, private reduced: () => boolean, private tuning = () => settings) {
    this.slots = Array.from({ length: 4 }, () => {
      const cell = document.createElement('span'); cell.className = 'counter-digit';
      const window = document.createElement('span'); window.className = 'counter-window';
      const reel = document.createElement('span'); reel.className = 'counter-reel';
      window.append(reel); cell.append(window); digits.append(cell);
      return { cell, reel, glyphs: [' '], animation: null, softening: null };
    });
  }
  private paint(slot: Slot, glyphs: string[]) {
    slot.glyphs = glyphs;
    slot.reel.replaceChildren(...glyphs.map(digit => {
      const glyph = document.createElement('span'); glyph.className = 'counter-glyph'; glyph.textContent = digit; return glyph;
    }));
  }
  private settleDigit(slot: Slot, digit: string) {
    slot.animation?.cancel(); slot.softening?.cancel(); slot.animation = null; slot.softening = null;
    this.paint(slot, [digit]); slot.reel.style.transform = 'translateY(0px)'; slot.reel.style.filter = 'blur(0px)';
  }
  private roll(slot: Slot, digit: string, steps: CountStep[], place: number, direction: number): Animation | null {
    const height = slot.cell.clientHeight || 16;
    const rendered = getComputedStyle(slot.reel), softness = rendered.filter;
    const position = rendered.transform === 'none' ? 0 : -new DOMMatrixReadOnly(rendered.transform).m42 / height;
    const path = digitPath(slot.glyphs, position, steps, place, direction);
    slot.animation?.cancel(); slot.softening?.cancel(); slot.animation = null; slot.softening = null;
    if (path.frames.every(frame => frame.position === path.frames[0]!.position)) { this.settleDigit(slot, digit); return null; }
    this.paint(slot, path.glyphs);
    const frames = path.frames.map(frame => ({ offset: frame.offset, transform: `translateY(${-frame.position * height}px)` }));
    slot.reel.style.transform = frames.at(-1)!.transform; slot.reel.style.filter = 'blur(0px)';
    const settings = this.tuning(), roll = settings.counterRoll, softBlur = `blur(${settings.counterBlur}px)`;
    const animation = slot.reel.animate(frames, { duration: roll, easing: EASE });
    slot.softening = slot.reel.animate([
      { offset: 0, filter: softness, easing: EASE },
      { offset: Math.min(80, roll * .2) / roll, filter: softBlur },
      { offset: .7, filter: softBlur, easing: EASE }, { offset: 1, filter: 'blur(0px)' },
    ], { duration: roll, easing: 'linear' });
    slot.animation = animation;
    animation.onfinish = () => { if (slot.animation === animation) this.settleDigit(slot, digit); };
    return animation;
  }
  set(words: number, instant = false) {
    this.readable.textContent = countLabel(words);
    words = approximateCount(words);
    this.digits.parentElement?.style.setProperty('--counter-leading', `${4 - String(words).length}ch`);
    if (words === this.value && !instant && !this.reduced()) return;
    const progress = Number(this.clock?.effect?.getComputedTiming().progress ?? 1);
    const from = this.value === null ? words : this.origin + (this.value - this.origin) * progress;
    const previous = this.value; this.value = words; this.origin = from; this.clock = null;
    const digits = String(words).padStart(4, ' ');
    if (instant || this.reduced() || previous === null) { this.slots.forEach((slot, i) => this.settleDigit(slot, digits[i]!)); return; }
    const steps = countJourney(from, words);
    this.slots.forEach((slot, i) => {
      const animation = this.roll(slot, digits[i]!, steps, i, words >= from ? 1 : -1);
      if (animation) this.clock = animation;
    });
  }
  settle() { if (this.value !== null) this.set(this.value, true); }
  reset() { this.slots.forEach(slot => this.settleDigit(slot, ' ')); this.value = null; this.clock = null; }
}
