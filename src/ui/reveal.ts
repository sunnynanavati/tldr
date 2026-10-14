import { type SummarySegment, wordTokens } from '../shared/summary';
import { EASE, settings } from './settings';

type VisualState = { opacity: string; transform: string; filter: string };
export class SummaryReveal {
  private animations: Animation[] = [];
  private removals: ReturnType<typeof setTimeout>[] = [];
  constructor(private summary: HTMLElement, private reduced: () => boolean, private changed: () => void) {}
  private cancel(preserve: boolean) {
    const interrupted = new Map<Element, VisualState>();
    if (preserve) for (const animation of this.animations) {
      const word = (animation.effect as KeyframeEffect | null)?.target;
      if (word?.isConnected && (animation.playState !== 'finished' || word.closest('.removing'))) {
        const style = getComputedStyle(word);
        interrupted.set(word, { opacity: style.opacity, transform: style.transform, filter: style.filter });
      }
    }
    this.animations.forEach(animation => animation.cancel()); this.animations = [];
    this.removals.forEach(clearTimeout); this.removals = [];
    return interrupted;
  }
  private segment(data: SummarySegment, index: number) {
    const segment = document.createElement('span'); segment.className = 'segment'; segment.dataset.index = String(index);
    for (const run of data.runs) {
      // Keep Latin words and their punctuation together, while segmenting scripts without spaces.
      const tokens = /[\u3040-\u30ff\u3400-\u9fff\u0e00-\u0e7f]/u.test(run.text) ? wordTokens(run.text) : run.text.split(/(\s+)/);
      for (const token of tokens) {
        if (!token) continue;
        if (/^\s+$/u.test(token)) segment.append(document.createTextNode(token));
        else {
          const word = document.createElement('span'); word.className = `word${run.emphasis ? ' emphasis' : ''}`;
          word.textContent = token; segment.append(word);
        }
      }
    }
    segment.append(document.createTextNode(' ')); return segment;
  }
  private animate(words: HTMLElement[], interrupted: Map<Element, VisualState>, initial: boolean, exiting: boolean) {
    if (!words.length) return 0;
    const duration = initial ? settings.duration : Math.min(settings.duration, 180);
    const stagger = initial ? settings.stagger : Math.min(settings.stagger, 60 / Math.max(1, words.length - 1));
    const hidden = { opacity: '0', transform: 'translateY(5px)', filter: `blur(${settings.textBlur}px)` };
    const visible = { opacity: '1', transform: 'translateY(0)', filter: 'blur(0px)' };
    (exiting ? [...words].reverse() : words).forEach((word, i) => {
      this.animations.push(word.animate([interrupted.get(word) ?? (exiting ? visible : hidden), exiting ? hidden : visible], {
        duration, delay: i * stagger, easing: EASE, fill: exiting ? 'both' : 'backwards',
      }));
    });
    return duration + (words.length - 1) * stagger;
  }
  render(segments: SummarySegment[], level: number, initial = false, instant = false): number {
    const animate = !instant && !this.reduced(), interrupted = this.cancel(animate);
    const additions: HTMLElement[] = [], removals: HTMLElement[] = [], retiring: HTMLElement[] = [];
    for (let i = 0; i <= level; i++) {
      let segment = this.summary.querySelector<HTMLElement>(`[data-index="${i}"]`);
      if (!segment) {
        segment = this.segment(segments[i]!, i); this.summary.append(segment); additions.push(...segment.querySelectorAll<HTMLElement>('.word'));
      } else {
        segment.classList.remove('removing'); segment.removeAttribute('aria-hidden');
        additions.push(...[...segment.querySelectorAll<HTMLElement>('.word')].filter(word => interrupted.has(word)));
      }
    }
    this.summary.querySelectorAll<HTMLElement>('.segment').forEach(segment => {
      if (Number(segment.dataset.index) > level) {
        if (!animate) segment.remove();
        else { segment.classList.add('removing'); segment.setAttribute('aria-hidden', 'true'); retiring.push(segment); removals.push(...segment.querySelectorAll<HTMLElement>('.word')); }
      }
    });
    let total = 0;
    if (animate) {
      const entry = this.animate(additions, interrupted, initial, false);
      const exit = this.animate(removals, interrupted, false, true); total = Math.max(entry, exit);
      if (retiring.length) this.removals.push(setTimeout(() => { retiring.forEach(segment => segment.remove()); this.changed(); }, exit));
    }
    this.changed(); return total;
  }
  reset() { this.cancel(false); this.summary.replaceChildren(); }
}
