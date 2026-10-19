import { settings } from './settings';
export class EdgeBlur {
  private frame = 0;
  private observer: ResizeObserver;
  constructor(private dialog: HTMLElement, private scroll: HTMLElement, private top: HTMLElement, private bottom: HTMLElement) {
    for (const [edge, band] of [['top', top], ['bottom', bottom]] as const) {
      const step = 100 / settings.progressiveLevels.length;
      for (const [index, blur] of settings.progressiveLevels.entries()) {
        const layer = document.createElement('span'); layer.className = 'summary-edge-layer';
        const start = index * step, peak = (index + 1) * step, end = (index + 2) * step;
        const stops = index === settings.progressiveLevels.length - 1 ? `transparent ${start}%,black 100%` : `transparent ${start}%,black ${peak}%,black ${end}%,transparent ${end + step}%`;
        layer.style.setProperty('--layer-blur', `${blur}px`); layer.style.setProperty('--layer-mask', `linear-gradient(to ${edge},${stops})`); band.append(layer);
      }
    }
    this.observer = new ResizeObserver(this.schedule); this.observer.observe(dialog); this.observer.observe(scroll.firstElementChild!);
    scroll.addEventListener('scroll', this.schedule, { passive: true }); this.schedule();
  }
  schedule = () => { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.update()); };
  private update() {
    const footer = this.dialog.querySelector<HTMLElement>('.summary-length')!;
    const header = this.dialog.querySelector<HTMLElement>('.dialog-header')!;
    const footerExtent = this.scroll.getBoundingClientRect().bottom - footer.getBoundingClientRect().top;
    const topHeight = header.getBoundingClientRect().height + 12;
    const bottomHeight = Math.max(footerExtent + 12, this.scroll.clientHeight * settings.progressiveHeight / 100);
    this.bottom.style.setProperty('--footer-tint-height', `${this.dialog.clientHeight * settings.footerTintHeight / 100}px`);
    this.scroll.style.setProperty('--scroll-end-padding', `${Math.ceil(Math.max(footerExtent + 16, bottomHeight + 8))}px`);
    const visibility = { top: this.scroll.scrollTop > 1 ? Math.min(1, this.scroll.scrollTop / 24) : 0, bottom: 1 };
    for (const [edge, band, height] of [['top', this.top, topHeight], ['bottom', this.bottom, bottomHeight]] as const) {
      band.style.setProperty('--edge-height', `${height}px`); band.hidden = !visibility[edge]; band.style.setProperty('--edge-visibility', String(visibility[edge]));
    }
    const alpha = (edge: 'top' | 'bottom', amount: number) => `rgb(0 0 0 / ${1 - visibility[edge] * amount})`;
    const stops = [`${alpha('top', 1)} 0px`, `${alpha('top', .95)} ${topHeight * .4}px`, `${alpha('top', .8)} ${topHeight * .7}px`, `${alpha('top', .45)} ${topHeight * .85}px`, `#000 ${topHeight}px`, `#000 calc(100% - ${bottomHeight}px)`, `${alpha('bottom', .6)} calc(100% - ${bottomHeight * .7}px)`, `${alpha('bottom', .9)} calc(100% - ${bottomHeight * .4}px)`, `${alpha('bottom', 1)} 100%`];
    this.scroll.style.setProperty('--scroll-edge-mask', `linear-gradient(to bottom,${stops.join(',')})`);
  }
  destroy() { cancelAnimationFrame(this.frame); this.observer.disconnect(); this.scroll.removeEventListener('scroll', this.schedule); }
}
