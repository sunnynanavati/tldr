import glassCSS from './glass.css?inline';
import baseCSS from './base.css?inline';
import { template } from './template';
import { applySettings } from './settings';
import { loadFont } from './font';
import { WordCounter } from './counter';
import { DetailSlider } from './slider';
import { SummaryReveal } from './reveal';
import { EdgeBlur } from './blur';
import { placePanel, type Anchor } from './placement';
import { TrayGeometry, viewport, type TrayBox } from './geometry';
import { countLabel } from './count';
import { levelNames, summaryText, type SummaryResult } from '../shared/summary';
import type { SummaryState } from '../shared/session';

interface DialogActions { close(): void; retry(): void; settings(): void }
export class TldrDialog {
  readonly host = document.createElement('div');
  readonly root = this.host.attachShadow({ mode: 'open' });
  private card = document.createElement('section');
  private events = new AbortController();
  private preference = matchMedia('(prefers-reduced-motion: reduce)');
  private result: SummaryResult | null = null;
  private level = 2;
  private counter: WordCounter;
  private slider: DetailSlider;
  private reveal: SummaryReveal;
  private edges: EdgeBlur;
  private geometry: TrayGeometry;
  private summary: HTMLElement;
  private readable: HTMLElement;
  private scroll: HTMLElement;
  private input: HTMLInputElement;
  private copy: HTMLButtonElement;
  private announcement = document.createElement('span');
  private placeholder = document.createElement('span');
  private settledTimer = 0;
  private copyTimer = 0;
  private anchor: Anchor | null;
  private previousFocus: Element | null = document.activeElement;
  private alive = true;
  private revision = 0;
  constructor(anchor: Anchor | null, private actions: DialogActions, private motionOverride?: () => boolean) {
    this.anchor = anchor;
    this.host.id = 'tldr-extension-root'; this.host.setAttribute('popover', 'manual');
    const hostStyle: Record<string, string> = {
      all: 'initial', position: 'fixed', inset: 'auto', margin: '0', padding: '0', border: '0',
      background: 'transparent', overflow: 'visible', 'box-sizing': 'border-box', 'color-scheme': 'dark',
      opacity: '1', transform: 'none', filter: 'none', 'pointer-events': 'auto', visibility: 'visible',
      'min-width': '0', 'min-height': '0', 'max-width': 'none', 'max-height': 'none',
    };
    for (const [name, value] of Object.entries(hostStyle)) this.host.style.setProperty(name, value, 'important');
    const sheet = new CSSStyleSheet(); sheet.replaceSync(glassCSS + '\n' + baseCSS); this.root.adoptedStyleSheets = [sheet];
    this.card.className = 'glass'; this.card.tabIndex = -1; this.card.setAttribute('role', 'dialog'); this.card.setAttribute('aria-labelledby', 'dialog-title');
    this.card.innerHTML = template; // Static, bundled markup only. Model text is always rendered with textContent.
    applySettings(this.card); this.root.append(this.card);
    this.announcement.className = 'sr-only'; this.announcement.setAttribute('role', 'status'); this.announcement.setAttribute('aria-live', 'polite');
    this.announcement.setAttribute('aria-atomic', 'true'); this.root.append(this.announcement);
    const byId = <T extends HTMLElement>(id: string): T => this.root.getElementById(id) as T;
    this.summary = byId('summary'); this.readable = byId('summary-readable'); this.scroll = byId('summary-scroll');
    this.summary.dir = 'auto'; this.readable.dir = 'auto';
    this.input = byId('detail'); this.copy = byId('copy-summary');
    this.placeholder.className = 'placeholder'; this.placeholder.textContent = '—'; this.placeholder.setAttribute('aria-hidden', 'true');
    byId('counter-digits').after(this.placeholder);
    this.counter = new WordCounter(byId('counter-digits'), byId('word-count-readable'), this.reduced);
    this.slider = new DetailSlider(this.input, this.reduced, level => { this.level = level; this.render(); });
    this.reveal = new SummaryReveal(this.summary, this.reduced, () => this.edges?.schedule());
    document.documentElement.append(this.host); this.position(); this.host.showPopover();
    this.edges = new EdgeBlur(this.card, this.scroll, byId('summary-blur-top'), byId('summary-blur-bottom'));
    this.geometry = new TrayGeometry(this.card, () => this.host.getBoundingClientRect(), this.applyBox);
    const options = { signal: this.events.signal };
    byId('close-dialog').addEventListener('click', () => actions.close(), options);
    this.copy.addEventListener('click', () => { void this.copySummary(); }, options);
    this.card.addEventListener('wheel', event => {
      if (this.scroll.contains(event.target as Node) || event.ctrlKey || !event.deltaY) return;
      const unit = event.deltaMode === 1 ? 13 * 1.54 : event.deltaMode === 2 ? this.scroll.clientHeight : 1;
      this.scroll.scrollBy({ top: event.deltaY * unit, behavior: 'instant' }); event.preventDefault();
    }, { ...options, passive: false });
    window.addEventListener('resize', this.position, options);
    window.visualViewport?.addEventListener('resize', this.position, options);
    this.preference.addEventListener('change', () => {
      this.slider.settle(); this.counter.settle(); if (this.result) this.render(false, true);
    }, options);
    this.card.focus({ preventScroll: true });
    void loadFont().then(() => { if (this.alive) this.edges.schedule(); }).catch(() => { /* System fallback remains readable if font decoding fails. */ });
  }
  private reduced = () => this.motionOverride?.() ?? this.preference.matches;
  private position = () => {
    if (this.geometry?.modified) { this.geometry.clamp(); return; }
    this.applyBox(placePanel(viewport(), this.anchor));
  };
  private applyBox = (box: TrayBox) => {
    for (const name of ['left', 'top', 'width', 'height'] as const) this.host.style.setProperty(name, `${box[name]}px`, 'important');
    this.edges?.schedule();
  };
  state(state: SummaryState): void {
    const revision = ++this.revision;
    if (state.status === 'closed') { this.destroy(); return; }
    clearTimeout(this.settledTimer); clearTimeout(this.copyTimer); this.counter.reset(); this.reveal.reset(); this.result = null;
    this.readable.textContent = ''; this.announcement.textContent = ''; this.scroll.scrollTop = 0;
    this.summary.setAttribute('aria-hidden', 'true');
    this.copy.disabled = true; this.copy.setAttribute('aria-label', 'Copy summary'); this.slider.set(2, false);
    this.placeholder.hidden = false; this.root.getElementById('counter-digits')!.hidden = true;
    this.root.getElementById('word-count-readable')!.textContent = 'Summary length unavailable';
    this.card.dataset.state = state.status;
    this.card.setAttribute('aria-busy', String(state.status === 'loading'));
    this.input.setAttribute('aria-valuetext', state.status === 'loading' ? 'Preparing summary' : 'Summary length unavailable');
    this.root.getElementById('length-hint')!.textContent = 'Summary lengths become available when the summary is ready.';
    if (state.status === 'loading') {
      const skeleton = document.createElement('div'); skeleton.className = 'skeleton';
      for (const width of [94, 100, 83, 96, 88, 68]) {
        const line = document.createElement('span'); line.style.width = `${width}%`; skeleton.append(line);
      }
      this.summary.append(skeleton); this.announcement.textContent = 'Preparing summary.';
    } else if (state.status === 'error') {
      const message = document.createElement('p'); message.className = 'message'; message.textContent = state.error.message;
      const row = document.createElement('div'); row.className = 'message-actions';
      if (state.error.retryable) row.append(this.actionButton('Retry', () => this.actions.retry()));
      if (['setup', 'connection', 'api_key', 'origin', 'backend'].includes(state.error.code)) row.append(this.actionButton('Connection settings', () => this.actions.settings()));
      this.summary.append(message, row); this.readable.textContent = state.error.message; this.announcement.textContent = state.error.message;
      // Error actions must remain available to assistive technology.
      this.summary.removeAttribute('aria-hidden'); this.readable.textContent = '';
    } else {
      this.summary.setAttribute('aria-hidden', 'true');
      this.result = state.result; this.level = state.result.levels.length === 1 ? 0 : 2;
      this.placeholder.hidden = true; this.root.getElementById('counter-digits')!.hidden = false;
      this.copy.disabled = false; this.slider.set(this.level, state.result.levels.length === 5);
      this.root.getElementById('length-hint')!.textContent = state.result.levels.length === 1
        ? 'This short selection has one compact summary.'
        : 'Drag for shorter or more detailed text; release to snap to one of five lengths. Arrow keys move one preset at a time.';
      void loadFont().catch(() => undefined).then(() => {
        if (this.alive && revision === this.revision) this.render(true);
      });
    }
    this.edges.schedule();
  }
  private actionButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button'); button.className = 'text-button'; button.textContent = label;
    button.addEventListener('click', action, { signal: this.events.signal }); return button;
  }
  private render(initial = false, instant = false) {
    if (!this.result) return;
    clearTimeout(this.settledTimer); clearTimeout(this.copyTimer); this.copy.setAttribute('aria-label', 'Copy summary');
    const total = this.reveal.render(this.result.levels, this.level, initial, instant);
    const text = summaryText(this.result.levels, this.level), count = this.result.wordCounts[this.level]!;
    this.readable.textContent = text; this.counter.set(count, initial || instant);
    this.input.setAttribute('aria-valuetext', this.result.levels.length === 1 ? `${countLabel(count)}, compact summary` : `${levelNames[this.level]}, ${countLabel(count)}, level ${this.level + 1} of 5`);
    this.settledTimer = window.setTimeout(() => { this.announcement.textContent = text; this.edges.schedule(); }, Math.max(total, 120));
  }
  private async copySummary() {
    if (!this.result) return;
    const text = summaryText(this.result.levels, this.level);
    try {
      let copied = false;
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; } }
      catch { /* Permissions Policy, HTTP, or an unfocused page can block async clipboard access. */ }
      if (!copied && this.alive) {
        const area = document.createElement('textarea'); area.value = text; area.className = 'sr-only'; this.root.append(area);
        area.focus({ preventScroll: true }); area.select();
        try { copied = document.execCommand('copy'); }
        finally { area.remove(); this.copy.focus({ preventScroll: true }); }
      }
      if (!copied) throw new Error('Clipboard unavailable');
      if (!this.alive) return;
      this.copy.setAttribute('aria-label', 'Summary copied'); this.announcement.textContent = 'Summary copied.';
      this.copyTimer = window.setTimeout(() => this.copy.setAttribute('aria-label', 'Copy summary'), 1800);
    } catch { if (this.alive) this.announcement.textContent = 'Copy was unavailable. Select the summary text to copy it.'; }
  }
  destroy() {
    if (!this.alive) return; this.alive = false; ++this.revision;
    clearTimeout(this.settledTimer); clearTimeout(this.copyTimer); this.events.abort();
    this.geometry.destroy(); this.slider.destroy(); this.counter.reset(); this.reveal.reset(); this.edges.destroy();
    const restore = this.root.activeElement !== null; this.host.remove(); this.result = null;
    if (restore && this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
  }
}
