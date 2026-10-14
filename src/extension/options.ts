import './options.css';
import { BACKEND_URL } from '../shared/protocol';
const input = document.querySelector<HTMLInputElement>('#token')!;
const status = document.querySelector<HTMLElement>('#status')!;
const form = document.querySelector<HTMLFormElement>('#connection-form')!;
const button = form.querySelector<HTMLButtonElement>('[type=submit]')!;
document.querySelector('#extension-id')!.textContent = chrome.runtime.id;
await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
const saved = await chrome.storage.local.get('localToken');
if (typeof saved.localToken === 'string') input.value = saved.localToken;
status.textContent = input.value ? 'Token saved on this device. Test the connection when the backend is running.' : 'Add your local token to connect.';
form.addEventListener('submit', event => {
  event.preventDefault(); void testConnection();
});
async function testConnection() {
  const token = input.value.trim(); if (token.length < 32) { status.textContent = 'Use a local token with at least 32 characters.'; return; }
  button.disabled = true; status.textContent = 'Connecting…';
  await chrome.storage.local.set({ localToken: token });
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      headers: { Authorization: `Bearer ${token}`, 'X-TLDR-Extension-Id': chrome.runtime.id }, signal: AbortSignal.timeout(5000), cache: 'no-store', credentials: 'omit',
    });
    if (!response.ok) { status.textContent = 'Check that the token and extension ID match your backend’s .env file.'; return; }
    const result = await response.json() as { ready: boolean };
    status.textContent = result.ready ? 'Connected. Select a passage on a webpage to try TLDR.' : 'Backend connected. Add OPENAI_API_KEY to .env and restart the backend.';
  } catch { status.textContent = 'Backend unavailable. Start it with npm run dev:server, then test again.'; }
  finally { button.disabled = false; }
}
document.querySelector('#forget')!.addEventListener('click', () => {
  void chrome.storage.local.remove('localToken').then(() => { input.value = ''; status.textContent = 'Local token removed.'; });
});
document.querySelector('#copy-id')!.addEventListener('click', () => {
  void navigator.clipboard.writeText(chrome.runtime.id).then(() => { status.textContent = 'Extension ID copied.'; }).catch(() => { status.textContent = 'Select and copy the extension ID above.'; });
});
