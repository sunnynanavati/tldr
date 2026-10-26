# TLDR data handling

Last reviewed: October 21, 2026. Applies to the local-backend developer preview in this repository.

## What happens when you summarize

When you choose TLDR from Chrome’s selection menu, the extension sends the selected text and a random request ID to a backend on your own computer (`127.0.0.1:4317`). The backend sends that text to OpenAI over HTTPS, using the API key you configured. Very long selections use multiple reading, synthesis, and review requests. Corrections can send the previous generated draft alongside the original text.

The extension does not send your full browsing history, cookies, or the page URL to the summarization backend. Anything included in your selection is part of the submitted text, so select only content you intend to send to OpenAI. TLDR does not run a hosted summary service or include analytics or advertising trackers.

## Keys and local storage

Your OpenAI API key belongs in the local backend’s `.env` file, not in Chrome. On macOS, installing the login service creates another copy in `~/Library/Application Support/TLDR/backend/.env`; the installer restricts that directory to mode 0700 and the file to 0600. Keep the project `.env` private too. These files are plaintext, not encrypted Keychain records. Processes running as your OS user, administrators, malware, or backups may be able to access them.

The extension saves a separate local pairing token in `chrome.storage.local`, restricted to trusted extension contexts. It does not use Chrome sync storage. This storage is not an encrypted vault. The pairing token grants access to the local backend and should also be kept private. TLDR rejects OpenAI-key-shaped values in the pairing field, but do not paste unrelated secrets there.

No developer key is included in the repository or extension download. Each user supplies their own key and is responsible for their provider account and API charges. A ChatGPT subscription does not itself provide API billing credit.

## Summary retention

Selections and results are kept in memory during processing and the current tray session, with no summary-history database. Closing or replacing a tray requests cancellation; delivered background jobs are deleted. Abandoned background jobs expire after a 30-second polling lease, checked periodically. Network failures and browser shutdown can delay cleanup until that lease expires. Clicking Copy puts summary text on your system clipboard, which is managed separately by your OS and any clipboard-history tools.

Production request logging is disabled. The backend does not deliberately log selections, summaries, keys, or tokens; service startup errors can be written to its private service directory. Optional developer smoke-test commands use authored fixtures and write generated sample summaries to local documentation files.

Summaries are inserted into the webpage DOM for display. Shadow DOM isolates styling; it is not a confidentiality boundary against the host page. Treat a summary shown on a website as content that website may be able to inspect. Credentials never enter that DOM.

## OpenAI processing

Requests use `store: false`. This requests that responses not be retained as saved response objects; it does **not** promise zero retention or eliminate provider abuse-monitoring and other documented retention rules. Your OpenAI account settings and [OpenAI’s data controls](https://developers.openai.com/api/docs/guides/your-data) govern provider handling. Review those terms before submitting sensitive material.

## Removal and revocation

- Use **Forget token** in extension settings to remove Chrome’s saved connection token. This does not revoke the token at the backend; replace `TLDR_LOCAL_TOKEN` and restart/reinstall the backend to revoke it.
- Uninstall the Chrome extension to remove its local extension storage.
- On macOS, `npm run service:uninstall` removes the login helper and its installed credential copy. It intentionally preserves the project `.env`; delete that file yourself if no longer needed.
- Revoke the API key in your OpenAI account when it should no longer authorize requests. Deleting a local copy alone does not revoke the provider key.

For project questions, use the repository’s GitHub issues without posting credentials or private selected text. For security issues, follow [SECURITY.md](../SECURITY.md).
