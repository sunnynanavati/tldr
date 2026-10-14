export class DetailSlider {
  private level = 2;
  private pointer: number | null = null;
  private frame = 0;
  private target: number | null = null;
  private events = new AbortController();
  constructor(private input: HTMLInputElement, private reduced: () => boolean, change: (level: number) => void) {
    const options = { signal: this.events.signal };
    input.addEventListener('pointerdown', event => {
      if (event.isPrimary && event.button === 0) { this.cancel(); this.pointer = event.pointerId; }
    }, options);
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.pointer) { this.pointer = null; this.snap(); }
    };
    window.addEventListener('pointerup', release, options);
    window.addEventListener('pointercancel', release, options);
    window.addEventListener('blur', () => { if (this.pointer !== null) { this.pointer = null; this.snap(); } }, options);
    input.addEventListener('input', () => {
      this.cancel(); const value = Number(input.value); this.position(value);
      const next = Math.round(value);
      if (next !== this.level) { this.level = next; change(next); }
    }, options);
    input.addEventListener('change', () => { if (this.pointer === null) this.snap(); }, options);
    input.addEventListener('blur', () => { if (this.pointer === null) this.snap(); }, options);
    input.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || input.disabled) return;
      const changes: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1, PageUp: 1, PageDown: -1 };
      if (!(event.key in changes) && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault(); event.stopPropagation(); this.cancel(); this.pointer = null;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : Math.max(0, Math.min(4, this.level + changes[event.key]!));
      this.position(next);
      if (next !== this.level) { this.level = next; change(next); }
    }, options);
  }
  position(value: number) { this.input.value = String(value); this.input.style.setProperty('--fill', `${value / 4 * 100}%`); }
  set(level: number, enabled: boolean) { this.cancel(); this.pointer = null; this.level = level; this.input.disabled = !enabled; this.position(level); }
  settle() { this.cancel(); this.pointer = null; this.position(this.level); }
  private cancel() { cancelAnimationFrame(this.frame); this.frame = 0; this.target = null; }
  private snap() {
    if (this.target === this.level && this.frame) return;
    this.cancel(); const from = Number(this.input.value), target = this.level;
    if (this.reduced() || Math.abs(target - from) < .001) { this.position(target); return; }
    this.target = target; const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 160), ease = 1 - (1 - progress) ** 3;
      this.position(from + (target - from) * ease);
      if (progress < 1) this.frame = requestAnimationFrame(tick);
      else { this.frame = 0; this.target = null; this.position(target); }
    };
    this.frame = requestAnimationFrame(tick);
  }
  destroy() { this.cancel(); this.events.abort(); }
}

