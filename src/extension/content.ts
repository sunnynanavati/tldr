import { ControllerMessageSchema } from '../shared/protocol';
import { SummarySession } from '../shared/session';
import { createSummarizer } from './transport';
import { TldrDialog } from '../ui/dialog';
import { selectionAnchor } from '../ui/placement';

// executeScript may run repeatedly; retain a single listener in the isolated world.
const world = globalThis as typeof globalThis & { __tldrInstalled?: boolean };
if (!world.__tldrInstalled) {
  world.__tldrInstalled = true;
  let dialog: TldrDialog | null = null;
  const summarize = createSummarizer(message => chrome.runtime.sendMessage(message));
  const session = new SummarySession(summarize, state => dialog?.state(state));
  const close = () => { session.close(); dialog = null; };
  const settings = () => { void chrome.runtime.sendMessage({ type: 'settings' }).catch(() => undefined); };
  chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    const message = ControllerMessageSchema.safeParse(raw);
    if (!message.success) return;
    const anchor = message.data.type === 'open' ? selectionAnchor(message.data.request.text) : null;
    close(); dialog = new TldrDialog(anchor, { close, retry: () => session.retry(), settings });
    if (message.data.type === 'open') void session.open(message.data.request);
    else dialog.state({ status: 'error', error: message.data.error });
    respond({ opened: true });
  });
  window.addEventListener('pagehide', close);
}
