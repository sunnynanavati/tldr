export interface TrayBox { left: number; top: number; width: number; height: number }
export interface Viewport { width: number; height: number; left?: number; top?: number }
export type Adjustment = 'move' | 'resize';
const MARGIN = 16;
export function viewport(): Viewport {
  const view = window.visualViewport;
  return { width: view?.width ?? innerWidth, height: view?.height ?? innerHeight, left: view?.offsetLeft, top: view?.offsetTop };
}
export function clampTray(box: TrayBox, view: Viewport): TrayBox {
  const left = (view.left ?? 0) + MARGIN, top = (view.top ?? 0) + MARGIN;
  const roomX = Math.max(0, view.width - MARGIN * 2), roomY = Math.max(0, view.height - MARGIN * 2);
  const width = Math.min(roomX, Math.max(260, box.width)), height = Math.min(roomY, Math.max(260, box.height));
  return { width, height, left: Math.max(left, Math.min(left + roomX - width, box.left)), top: Math.max(top, Math.min(top + roomY - height, box.top)) };
}
export function adjustTray(box: TrayBox, mode: Adjustment, dx: number, dy: number, view: Viewport): TrayBox {
  // DOMRect coordinates are prototype accessors, not enumerable own properties.
  box = { left: box.left, top: box.top, width: box.width, height: box.height };
  if (mode === 'move') return clampTray({ ...box, left: box.left + dx, top: box.top + dy }, view);
  const roomX = Math.max(0, (view.left ?? 0) + view.width - MARGIN - box.left);
  const roomY = Math.max(0, (view.top ?? 0) + view.height - MARGIN - box.top);
  return clampTray({ ...box, width: Math.min(roomX, Math.max(260, box.width + dx)), height: Math.min(roomY, Math.max(260, box.height + dy)) }, view);
}

/** Direct manipulation: coalesce pointer input to one layout write per frame.
 * No easing lag or momentum; capture keeps the gesture attached outside the tray. */
export class TrayGeometry {
  modified = false;
  private events = new AbortController();
  private frame = 0;
  private pending: TrayBox | null = null;
  private gesture: { id: number; x: number; y: number; box: TrayBox; mode: Adjustment; target: HTMLElement; moved: boolean } | null = null;
  private suppressClick = false;
  private tools: HTMLElement;
  private controls: Record<Adjustment, HTMLButtonElement>;
  constructor(private card: HTMLElement, private read: () => TrayBox, private write: (box: TrayBox) => void, private committed: (box: TrayBox) => void = () => {}) {
    this.tools = card.querySelector('#geometry-tools')!;
    this.controls = { move: card.querySelector('#move-tray')!, resize: card.querySelector('#resize-tray')! };
    const options = { signal: this.events.signal };
    const header = card.querySelector<HTMLElement>('.dialog-header')!;
    header.addEventListener('pointerdown', event => {
      const target = event.target as HTMLElement;
      if (target.closest('button') && !target.closest('#move-tray')) return;
      this.start(event, 'move', target.closest<HTMLButtonElement>('#move-tray') ?? header);
    }, options);
    this.controls.resize.addEventListener('pointerdown', event => this.start(event, 'resize', this.controls.resize), options);
    for (const mode of ['move', 'resize'] as const) {
      const button = this.controls[mode]; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'geometry-tools');
      button.addEventListener('click', () => {
        if (this.suppressClick) { this.suppressClick = false; return; }
        const open = !this.tools.hidden && this.tools.dataset.mode === mode;
        this.hideTools(); if (!open) this.showTools(mode);
      }, options);
      button.addEventListener('keydown', event => {
        const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const delta = directions[event.key]; if (!delta || event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? 1 : 10;
        this.apply(adjustTray(this.read(), mode, delta[0] * step, delta[1] * step, viewport())); this.committed(this.read());
      }, options);
    }
    window.addEventListener('pointermove', event => {
      const gesture = this.gesture; if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
      gesture.moved = true; this.card.dataset.manipulating = gesture.mode;
      this.pending = adjustTray(gesture.box, gesture.mode, dx, dy, viewport());
      if (!this.frame) this.frame = requestAnimationFrame(() => this.flush());
    }, options);
    window.addEventListener('pointerup', event => this.finish(event.pointerId), options);
    window.addEventListener('pointercancel', event => this.finish(event.pointerId), options);
    header.addEventListener('lostpointercapture', event => this.finish(event.pointerId), options);
    this.controls.resize.addEventListener('lostpointercapture', event => this.finish(event.pointerId), options);
    window.addEventListener('blur', () => { if (this.gesture) this.finish(this.gesture.id); }, options);
  }
  private start(event: PointerEvent, mode: Adjustment, target: HTMLElement) {
    if (event.button !== 0 || !event.isPrimary || this.gesture) return;
    this.suppressClick = false; this.hideTools();
    this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, box: this.read(), mode, target, moved: false };
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  private apply(box: TrayBox) { this.modified = true; this.write(box); }
  private flush() { cancelAnimationFrame(this.frame); this.frame = 0; if (this.pending) { this.apply(this.pending); this.pending = null; } }
  private finish(id: number) {
    const gesture = this.gesture; if (!gesture || gesture.id !== id) return;
    this.flush(); this.gesture = null; this.suppressClick = gesture.moved;
    if (gesture.target.hasPointerCapture(id)) gesture.target.releasePointerCapture(id);
    delete this.card.dataset.manipulating;
    if (gesture.moved) this.committed(this.read());
  }
  clamp() {
    if (this.gesture) this.finish(this.gesture.id);
    if (this.modified) this.write(clampTray(this.read(), viewport()));
  }
  private hideTools() {
    this.tools.hidden = true;
    for (const button of Object.values(this.controls)) button.setAttribute('aria-expanded', 'false');
  }
  private showTools(mode: Adjustment) {
    this.tools.replaceChildren(); this.tools.dataset.mode = mode; this.tools.setAttribute('aria-label', mode === 'move' ? 'Move summary' : 'Resize summary');
    const labels = mode === 'move' ? ['Move left', 'Move right', 'Move up', 'Move down'] : ['Narrower', 'Wider', 'Shorter tray', 'Taller tray'];
    const steps = [[-20, 0], [20, 0], [0, -20], [0, 20]] as const;
    steps.forEach(([dx, dy], i) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = ['←', '→', '↑', '↓'][i]!;
      button.setAttribute('aria-label', labels[i]!); button.title = labels[i]!;
      button.addEventListener('click', () => { this.apply(adjustTray(this.read(), mode, dx, dy, viewport())); this.committed(this.read()); });
      this.tools.append(button);
    });
    const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done';
    done.addEventListener('click', () => { this.hideTools(); this.controls[mode].focus({ preventScroll: true }); }); this.tools.append(done);
    this.tools.hidden = false; this.controls[mode].setAttribute('aria-expanded', 'true');
  }
  destroy() {
    this.events.abort(); cancelAnimationFrame(this.frame); this.pending = null;
    if (this.gesture) this.finish(this.gesture.id);
    this.tools.replaceChildren();
  }
}
