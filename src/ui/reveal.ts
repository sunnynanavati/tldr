import { type SummaryLevel, wordTokens } from '../shared/summary';
import { EASE, settings } from './settings';
import { matchWords } from './word-diff';

type Entry = { node: HTMLSpanElement; ink: HTMLSpanElement; text: string };
type Snapshot = { rect: DOMRect; opacity: string; transform: string; filter: string };
export class SummaryReveal {
  private animations: Animation[] = [];
  private removal: ReturnType<typeof setTimeout> | undefined;
  private active: Entry[] = [];
  private ghosts: Entry[] = [];
  constructor(private summary: HTMLElement, private reduced: () => boolean, private changed: () => void) {}
  private cancel() {
    this.animations.forEach(animation => animation.cancel()); this.animations = [];
    clearTimeout(this.removal);
  }
  private create(text: string): Entry {
    const node = document.createElement('span'), ink = document.createElement('span');
    node.className = 'word'; ink.className = 'word-ink'; ink.textContent = text; node.append(ink);
    return { node, ink, text };
  }
  render(levels: SummaryLevel[], level: number, initial = false, instant = false): number {
    const animate = !instant && !this.reduced();
    const snapshots = new Map<Entry, Snapshot>();
    // Read current visual positions before cancelling interrupted animations.
    if (animate) for (const entry of [...this.active, ...this.ghosts]) {
      const style = getComputedStyle(entry.ink);
      snapshots.set(entry, { rect: entry.node.getBoundingClientRect(), opacity: style.opacity, transform: style.transform, filter: style.filter });
    }
    this.cancel();
    const tokens = levels[level]!.runs.flatMap(run => {
      const parts = /[\u3040-\u30ff\u3400-\u9fff\u0e00-\u0e7f]/u.test(run.text) ? wordTokens(run.text) : run.text.split(/(\s+)/u);
      return parts.filter(Boolean).map(text => ({ text, emphasis: run.emphasis, space: /^\s+$/u.test(text) }));
    });
    const words = tokens.filter(token => !token.space);
    const matches = matchWords(this.active.map(entry => entry.text), words.map(token => token.text));
    const used = new Set<Entry>(), additions: Entry[] = [];
    const next = words.map((word, index) => {
      const previousIndex = matches.get(index);
      let entry = previousIndex === undefined ? undefined : this.active[previousIndex];
      // A rapid reversal can resurrect a word that is still fading out.
      entry ??= this.ghosts.find(candidate => candidate.text === word.text && !used.has(candidate));
      if (!entry) { entry = this.create(word.text); additions.push(entry); }
      else if (Number(snapshots.get(entry)?.opacity ?? 1) < .999) additions.push(entry);
      used.add(entry); entry.node.className = 'word'; entry.node.removeAttribute('aria-hidden'); entry.node.removeAttribute('style');
      entry.ink.className = `word-ink${word.emphasis ? ' emphasis' : ''}`;
      return entry;
    });
    const retiring = [...this.active, ...this.ghosts].filter(entry => !used.has(entry));
    const fragment = document.createDocumentFragment(); let wordIndex = 0;
    for (const token of tokens) fragment.append(token.space ? document.createTextNode(token.text) : next[wordIndex++]!.node);
    this.summary.replaceChildren(fragment); this.active = next; this.ghosts = [];
    if (!animate) { this.changed(); return 0; }
    // Measure the destination once, then animate transforms without per-frame layout.
    const destinations = next.map(entry => entry.node.getBoundingClientRect());
    next.forEach((entry, index) => {
      const old = snapshots.get(entry), destination = destinations[index]!;
      if (!old) return;
      const dx = old.rect.left - destination.left, dy = old.rect.top - destination.top;
      if (Math.abs(dx) > .1 || Math.abs(dy) > .1) this.animations.push(entry.node.animate([
        { transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' },
      ], { duration: 240, easing: EASE }));
    });
    const origin = this.summary.getBoundingClientRect();
    for (const entry of retiring) {
      const old = snapshots.get(entry); if (!old) continue;
      entry.node.className = 'word removing'; entry.node.setAttribute('aria-hidden', 'true');
      Object.assign(entry.node.style, { position: 'absolute', left: `${old.rect.left - origin.left}px`, top: `${old.rect.top - origin.top}px`, width: `${old.rect.width}px`, pointerEvents: 'none' });
      this.summary.append(entry.node); this.ghosts.push(entry);
    }
    const reveal = (entries: Entry[], exiting: boolean) => {
      const duration = initial && !exiting ? settings.duration : Math.min(settings.duration, 180);
      const stagger = initial && !exiting ? settings.stagger : Math.min(settings.stagger, 60 / Math.max(1, entries.length - 1));
      const hidden = { opacity: '0', transform: 'translateY(5px)', filter: `blur(${settings.textBlur}px)` };
      const visible = { opacity: '1', transform: 'translateY(0)', filter: 'blur(0px)' };
      (exiting ? [...entries].reverse() : entries).forEach((entry, index) => {
        const snapshot = snapshots.get(entry);
        const start = snapshot ? { opacity: snapshot.opacity, transform: snapshot.transform, filter: snapshot.filter } : hidden;
        this.animations.push(entry.ink.animate([start, exiting ? hidden : visible], {
          duration, delay: index * stagger, easing: EASE, fill: exiting ? 'both' : 'backwards',
        }));
      });
      return entries.length ? duration + (entries.length - 1) * stagger : 0;
    };
    const entryTime = reveal(additions, false), exitTime = reveal(this.ghosts, true);
    if (this.ghosts.length) this.removal = setTimeout(() => {
      this.ghosts.forEach(entry => entry.node.remove()); this.ghosts = []; this.changed();
    }, exitTime);
    this.changed(); return Math.max(entryTime, exitTime, initial ? 0 : 240);
  }
  reset() { this.cancel(); this.active = []; this.ghosts = []; this.summary.replaceChildren(); }
}
