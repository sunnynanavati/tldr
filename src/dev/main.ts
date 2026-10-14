import './dev.css';
import { TldrDialog } from '../ui/dialog';
import { SummaryFailure, SummarySession, type Summarize } from '../shared/session';
import { fixtureSource, shortSource, chineseSource, fixtureResult } from './fixtures';
import { selectionAnchor } from '../ui/placement';
import { runBrowserChecks } from './checks';

const passages = { long: fixtureSource, short: shortSource, chinese: chineseSource };
for (const [id, text] of Object.entries(passages)) document.getElementById(id)!.textContent = text;
let selected = fixtureSource;
document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.select!)!;
    const range = document.createRange(); range.selectNodeContents(target);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range); selected = target.textContent!;
  });
});
document.querySelector('#theme')!.addEventListener('click', event => {
  const dark = document.body.classList.toggle('dark'); (event.currentTarget as HTMLElement).textContent = `Switch to ${dark ? 'light' : 'dark'} page`;
});
let dialog: TldrDialog | null = null;
const scenario = document.querySelector<HTMLSelectElement>('#scenario')!;
const summarize: Summarize = async (request, signal) => {
  const mode = scenario.value;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, mode === 'slow' ? 6000 : 700);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  if (mode === 'error') throw new SummaryFailure({ code: 'backend', message: 'Start the local TLDR backend, then try again.', retryable: true });
  try { return fixtureResult(request); }
  catch { throw new SummaryFailure({ code: 'fixture', message: 'Select one of the complete fixture passages.', retryable: false }); }
};
const session = new SummarySession(summarize, state => dialog?.state(state));
const close = () => { session.close(); dialog = null; };
function preview(text = selected) {
  const anchor = selectionAnchor(text); close();
  dialog = new TldrDialog(anchor, { close, retry: () => session.retry(), settings: () => {
    close();
    const output = document.querySelector<HTMLElement>('#check-results')!;
    output.textContent = 'Open TLDR’s extension icon in Chrome for connection settings. This page is the offline component preview.';
    output.scrollIntoView({ block: 'nearest' });
  } });
  void session.open({ requestId: crypto.randomUUID(), text });
}
document.querySelector('#preview')!.addEventListener('click', () => {
  preview(); if (scenario.value === 'race') setTimeout(() => preview(shortSource), 150);
});
document.querySelector('#rapid')!.addEventListener('click', () => {
  preview(fixtureSource);
  setTimeout(() => {
    const slider = dialog?.root.querySelector<HTMLInputElement>('#detail'); if (!slider || slider.disabled) return;
    for (const [i, value] of [4, 0, 3, 1, 4, 2].entries()) setTimeout(() => {
      slider.value = String(value); slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, i * 65);
  }, 800);
});
document.querySelector('#checks')!.addEventListener('click', event => {
  const button = event.currentTarget as HTMLButtonElement;
  close(); button.disabled = true;
  void runBrowserChecks(document.querySelector('#check-results')!).finally(() => { button.disabled = false; });
});
