import { BACKEND_URL, ErrorSchema, JobReplySchema, WorkerMessageSchema, type JobReply } from '../shared/protocol';
import { lengthTargets, wordCount, SummaryRequestSchema, SummaryResponseSchema, type SummaryRequest } from '../shared/summary';

const active = new Map<number, { id: string; controller: AbortController }>();
const openings = new Map<number, string>();
const jobs = new Map<number, string>();
void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'tldr-selection', title: 'TLDR', contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  });
});
chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage(); });
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'tldr-selection' || !tab?.id || !info.selectionText) return;
  void open(tab.id, info.selectionText);
});
async function open(tabId: number, text: string) {
  const openingId = crypto.randomUUID(); openings.set(tabId, openingId);
  active.get(tabId)?.controller.abort(); active.delete(tabId);
  const oldJob = jobs.get(tabId); if (oldJob) void deleteJob(oldJob); jobs.delete(tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    if (openings.get(tabId) !== openingId) return;
    const request = SummaryRequestSchema.safeParse({ requestId: crypto.randomUUID(), text });
    await chrome.tabs.sendMessage(tabId, request.success ? { type: 'open', request: request.data } : {
      type: 'selection-error', error: { code: 'selection', message: 'Select a passage of up to 40,000 characters.', retryable: false },
    }, { frameId: 0 });
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'TLDR · Connection settings' });
  } catch {
    if (openings.get(tabId) !== openingId) return;
    await chrome.action.setBadgeText({ tabId, text: '!' }).catch(() => undefined);
    await chrome.action.setTitle({ tabId, title: 'TLDR cannot open on this page. Try an ordinary webpage.' }).catch(() => undefined);
  }
}
async function deleteJob(id: string) {
  const { localToken } = await chrome.storage.local.get('localToken');
  if (typeof localToken !== 'string') return;
  await fetch(`${BACKEND_URL}/v1/summary-jobs/${id}`, {
    method: 'DELETE', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${localToken}`, 'X-TLDR-Extension-Id': chrome.runtime.id },
  }).catch(() => undefined);
}
async function pollJob(tabId: number, id: string): Promise<JobReply> {
  try {
    const { localToken } = await chrome.storage.local.get('localToken');
    const response = await fetch(`${BACKEND_URL}/v1/summary-jobs/${id}`, {
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${String(localToken)}`, 'X-TLDR-Extension-Id': chrome.runtime.id },
    });
    const payload: unknown = await response.json();
    const result: JobReply = response.ok ? JobReplySchema.parse(payload) : { ok: false, error: ErrorSchema.parse((payload as { error?: unknown }).error) };
    if (!('pending' in result)) { void deleteJob(id); if (jobs.get(tabId) === id) jobs.delete(tabId); }
    return result;
  } catch {
    return { ok: false, error: { code: 'connection', message: 'The summary service disconnected. Try again.', retryable: true } };
  }
}
async function summarize(tabId: number, request: SummaryRequest): Promise<JobReply> {
  active.get(tabId)?.controller.abort();
  const controller = new AbortController(); active.set(tabId, { id: request.requestId, controller });
  const timer = setTimeout(() => controller.abort(), 24_000);
  try {
    const { localToken } = await chrome.storage.local.get('localToken');
    if (typeof localToken !== 'string' || localToken.length < 32) return {
      ok: false, error: { code: 'connection', message: 'Connect your local backend in TLDR settings.', retryable: false },
    };
    const article = lengthTargets(wordCount(request.text)).at(-1)! > 110;
    if (article) jobs.set(tabId, request.requestId);
    const response = await fetch(`${BACKEND_URL}/v1/${article ? 'summary-jobs' : 'summaries'}`, {
      method: 'POST', signal: controller.signal, credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localToken}`, 'X-TLDR-Extension-Id': chrome.runtime.id }, body: JSON.stringify(request),
    });
    if (!response.ok) {
      const payload: unknown = await response.json();
      const error = ErrorSchema.safeParse((payload as { error?: unknown })?.error);
      return { ok: false, error: error.success ? error.data : { code: 'backend', message: 'The local backend could not prepare the summary. Try again.', retryable: true } };
    }
    return article ? JobReplySchema.parse(await response.json()) : { ok: true, result: SummaryResponseSchema.parse(await response.json()) };
  } catch {
    return { ok: false, error: controller.signal.aborted ? {
      code: 'timeout', message: 'The summary was interrupted or took too long. Try again.', retryable: true,
    } : { code: 'backend', message: 'Start the local TLDR backend, then try again.', retryable: true } };
  } finally {
    clearTimeout(timer);
    if (controller.signal.aborted) void deleteJob(request.requestId);
    if (active.get(tabId)?.id === request.requestId) active.delete(tabId);
  }
}
chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const message = WorkerMessageSchema.safeParse(raw);
  if (!message.success) return;
  if (message.data.type === 'settings') { void chrome.runtime.openOptionsPage(); respond({ ok: true }); return; }
  if (!sender.tab?.id || sender.frameId !== 0) return;
  if (message.data.type === 'cancel') {
    const pending = active.get(sender.tab.id);
    if (pending?.id === message.data.requestId) pending.controller.abort();
    void deleteJob(message.data.requestId);
    if (jobs.get(sender.tab.id) === message.data.requestId) jobs.delete(sender.tab.id);
    respond({ ok: true }); return;
  }
  if (message.data.type === 'poll') { void pollJob(sender.tab.id, message.data.requestId).then(respond); return true; }
  void summarize(sender.tab.id, message.data.request).then(respond);
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  active.get(tabId)?.controller.abort(); active.delete(tabId); openings.delete(tabId);
  const job = jobs.get(tabId); if (job) void deleteJob(job); jobs.delete(tabId);
});
