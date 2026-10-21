# Security

TLDR is a developer preview using a local backend. It is not independently penetration-tested or certified. See [data handling](docs/privacy.md) and the dated [publication audit](docs/publication-audit.md) for the implementation and assessment limits.

## Reporting a problem

Never post API keys, local tokens, private selections, or a working sensitive exploit in a public issue. If GitHub displays **Report a vulnerability** under the repository’s Security tab, use that private channel. Otherwise open an issue asking the maintainer to establish private contact, without including sensitive details. A dedicated security contact and GitHub private vulnerability reporting should be configured before a wider release.

## Development safeguards

- Keep `.env`, runtime directories, and installed-service files out of Git and release assets.
- Run `npm run audit:secrets` before a commit/release. It scans source, build files, and local Git history using known key patterns and exact current `.env` secrets. It is a best-effort detector, not proof that every secret format or screenshot is safe.
- Run `npm run verify` and `npm audit`. CI uses Node 24, a read-only repository token, and pinned official Actions. Live API tests are not run in CI and need no repository secrets.
- `npm run package:extension` builds and scans before packaging only the extension files; never publish the installed backend directory or a ZIP of the whole checkout.
- Use your own randomly generated local token and OpenAI key. The extension should never receive the provider key. Do not expose the local backend on a public interface or tunnel.

If a key has been exposed, revoke it at the provider first; removing the file from the latest commit alone does not remove it from history, forks, caches, or downloads.
