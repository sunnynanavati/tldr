import { TldrDialog } from '../ui/dialog';
import { fixtureResult, fixtureSource } from './fixtures';
import { approximateCount, countLabel } from '../ui/count';
import { summaryText } from '../shared/summary';

// Browser-executed integration checks, deliberately excluded from the extension build.
export async function runBrowserChecks(output: HTMLElement): Promise<void> {
  const lines: string[] = [];
  const record = (name: string, pass: boolean) => { lines.push(`${pass ? 'PASS' : 'FAIL'} · ${name}`); output.textContent = lines.join('\n'); };
  output.style.whiteSpace = 'pre-wrap'; output.textContent = 'Running browser checks…';
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const result = fixtureResult({ requestId: crypto.randomUUID(), text: fixtureSource });
  let view!: TldrDialog;
  const make = (reduced?: () => boolean) => new TldrDialog(null, { close: () => view.destroy(), retry: () => {}, settings: () => {} }, reduced);
  view = make();
  try {
    view.state({ status: 'loading', requestId: result.requestId });
    const root = view.root;
    const card = root.querySelector<HTMLElement>('.glass')!;
    const input = root.querySelector<HTMLInputElement>('#detail')!;
    const paragraph = root.querySelector<HTMLElement>('#summary')!;
    const footerY = input.getBoundingClientRect().y;
    record('Loading controls are disabled in the fixed frame', input.disabled && root.querySelector<HTMLButtonElement>('#copy-summary')!.disabled && card.getBoundingClientRect().height === Math.min(420, innerHeight - 32));
    record('Opening focuses the dialog, not Close', root.activeElement === card && getComputedStyle(card).outlineStyle === 'none');
    view.state({ status: 'ready', result });
    for (let i = 0; i < 100 && !paragraph.querySelector('.word'); i++) await pause(30);
    record('Bundled font loaded', document.fonts.check('13px "TLDR Inter"'));
    record('Initial reveal uses the approved 500 ms duration', paragraph.querySelector('.word-ink')?.getAnimations()[0]?.effect?.getTiming().duration === 500);
    await pause(2900);
    const firstWord = paragraph.querySelector('.word');
    const choose = (value: number) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); };
    choose(4);
    record('Shared words animate into their new layout positions', [...paragraph.querySelectorAll('.word:not(.removing)')].some(word => word.getAnimations().some(a => a.effect?.getTiming().duration === 240)));
    const arrivals = [...paragraph.querySelectorAll('.word:not(.removing) .word-ink')].flatMap(word => word.getAnimations()).filter(a => a.effect?.getTiming().duration === 500);
    record('New details reveal in reading order', arrivals.length > 1 && arrivals.every((a, i) => i === 0 || Number(a.effect?.getTiming().delay) >= Number(arrivals[i - 1]!.effect?.getTiming().delay)));
    const middle = [...paragraph.querySelectorAll<HTMLElement>('.word:not(.removing) .word-ink')].find(word => word.textContent === 'desks');
    const middleAnimation = middle?.getAnimations()[0];
    record('Mid-sentence additions use the full blur-and-rise reveal', middleAnimation?.effect?.getTiming().duration === 500 && (middleAnimation.effect as KeyframeEffect).getKeyframes()[0]?.filter === 'blur(3px)');
    await pause(110);
    record('Changed digits soften during the 720 ms roll', [...root.querySelectorAll<HTMLElement>('.counter-reel')].some(reel => parseFloat(getComputedStyle(reel).filter.replace('blur(', '')) > .5 && reel.getAnimations().some(a => a.effect?.getTiming().duration === 720)));
    choose(0);
    record('Shortening animates words out', [...paragraph.querySelectorAll('.removing .word-ink')].some(word => word.getAnimations().length > 0));
    for (const value of [4, 0, 3, 1, 4, 2]) { choose(value); await pause(35); }
    await pause(300);
    record('Rapid reversals resolve to the latest summary', !paragraph.querySelector('.removing') && paragraph.textContent?.trim() === summaryText(result.levels, 2));
    record('Shared words retain their DOM nodes', firstWord === paragraph.querySelector('.word'));
    record('Footer remains fixed while text changes', Math.abs(input.getBoundingClientRect().y - footerY) < .5);
    await pause(1100);
    record('Counter settles crisp and in its default color', [...root.querySelectorAll<HTMLElement>('.counter-reel')].every(reel => getComputedStyle(reel).filter === 'blur(0px)' && !reel.getAnimations().length) && root.querySelector('.counter-digits')?.textContent?.trim() === String(approximateCount(result.wordCounts[2]!)));
    input.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, isPrimary: true, button: 0 })); choose(1.35);
    record('Pointer travel stays continuous', Number(input.value) === 1.35);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, isPrimary: true })); await pause(200);
    record('Release snaps to the nearest preset', Number(input.value) === 1);
    choose(4); await pause(300);
    const scroll = root.querySelector<HTMLElement>('#summary-scroll')!;
    scroll.scrollTop = scroll.scrollHeight; await pause(70);
    const last = paragraph.querySelector<HTMLElement>('.word:not(.removing):last-of-type')!;
    const bottom = parseFloat(root.querySelector<HTMLElement>('#summary-blur-bottom')!.style.getPropertyValue('--edge-height'));
    record('Last line clears the footer fade', last.getBoundingClientRect().bottom <= scroll.getBoundingClientRect().bottom - bottom - 7);
    record('Scrolling reveals the independent 64 px header blur', !root.querySelector<HTMLElement>('#summary-blur-top')!.hidden && root.querySelector<HTMLElement>('#summary-blur-top')!.style.getPropertyValue('--edge-height') === '64px');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.dispatchEvent(new Event('scroll'));
    record('Escape, outside click, and page scrolling leave the tray open', view.host.isConnected);
    const beforeMove = view.host.getBoundingClientRect();
    root.querySelector('#move-tray')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    record('Keyboard movement moves the tray without changing its size', view.host.getBoundingClientRect().left === Math.max(16, beforeMove.left - 10) && view.host.getBoundingClientRect().width === beforeMove.width);
    const resize = root.querySelector<HTMLButtonElement>('#resize-tray')!;
    resize.click();
    const beforeResize = view.host.getBoundingClientRect();
    root.querySelector<HTMLButtonElement>('[aria-label="Narrower"]')!.click();
    record('Resize buttons provide a click alternative to dragging', view.host.getBoundingClientRect().width === Math.max(260, beforeResize.width - 20));
    resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    record('Keyboard resizing supports one-pixel fine adjustment', view.host.getBoundingClientRect().height === beforeResize.height - 1);
    await pause(80); scroll.scrollTop = scroll.scrollHeight; await pause(80);
    const resizedBottom = parseFloat(root.querySelector<HTMLElement>('#summary-blur-bottom')!.style.getPropertyValue('--edge-height'));
    record('Resizing retains last-line clearance above the footer', last.getBoundingClientRect().bottom <= scroll.getBoundingClientRect().bottom - resizedBottom - 7);
    const geometry = view.host.getBoundingClientRect(); window.dispatchEvent(new Event('resize'));
    record('Viewport updates retain manually adjusted geometry', view.host.getBoundingClientRect().left === geometry.left && view.host.getBoundingClientRect().width === geometry.width);
    root.querySelector<HTMLButtonElement>('#close-dialog')!.click();
    record('Close removes the tray', !view.host.isConnected);
    view = make(() => true); view.state({ status: 'ready', result }); await pause(100);
    record('Reduced motion renders complete text with no word or counter animation', view.root.querySelector('#summary')!.textContent!.trim() === summaryText(result.levels, 2) && view.root.querySelector('.glass')!.getAnimations({ subtree: true }).length === 0);
    view.root.querySelector<HTMLInputElement>('#detail')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    record('Keyboard End selects the longest preset', view.root.querySelector('#word-count-readable')!.textContent === countLabel(result.wordCounts[4]!));
  } catch (error) { record(`Browser check exception: ${error instanceof Error ? error.message : String(error)}`, false); }
  finally { view.destroy(); }
}
