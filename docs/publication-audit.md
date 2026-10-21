# Publication audit — October 21, 2026

## Decision

Suitable for a **developer-preview GitHub release and an accurately described LinkedIn demo**, after the publication steps below. Not yet a one-click consumer product or a Chrome Web Store launch. This is a source/configuration review with automated checks, not an independent penetration test or a guarantee of security.

## Findings and fixes

| Severity | Finding | Disposition |
| --- | --- | --- |
| Release blocker | GitHub's default branch and working branch were both at `87f123d`; long-article, highlighting, and current local changes were not published. | Prepare a reviewed release branch; verify remote CI before merging/publishing. |
| High for development tooling | npm reported three vulnerable development packages: Vitest, @vitest/mocker, and tinypool, including critical-rated advisories. These were test dependencies, not shipped runtime dependencies. | Upgraded Vitest to 5.0.5 and updated the lockfile. npm reports zero known advisories; all 104 tests pass. No exploitation was observed. |
| Release blocker | `dist/tldr-chrome.zip` dated October 15 did not match the current extension. | Rebuilt it and added `npm run package:extension`, which builds/scans before allowlisted packaging. Verified every ZIP entry matches the current build; no backend or credential files included. |
| Medium | An OpenAI key could be mistakenly accepted as a local pairing token and saved in Chrome. | Added a shared credential guard in options, worker, backend startup, and service installation. API-key-shaped input is rejected before new browser storage/network writes. Unit tests cover malformed tokens and provider-key rejection. |
| Medium / product boundary | API keys are private plaintext files, not encrypted secret-store entries. | Confirmed owner-only permissions (0600) on both actual `.env` copies. Documented limits; OS Keychain storage remains a recommended improvement for consumer onboarding. |
| Release documentation gap | README assumed the author's already-configured extension and no public-facing data-handling document existed. | Rewrote onboarding for a fresh user; added privacy/security documentation and honest developer-preview launch copy. |
| Release safeguard gap | No CI/dependency-monitoring configuration or repeatable repository secret check. | Added read-only, SHA-pinned GitHub Actions, Dependabot, and `npm run audit:secrets`. Remote CI must pass after push. |

## Credential exposure review

- Scanned 122 initial tracked/unignored working files and 253 Git-history blobs across local refs, fetched remotes, and reflogs. No exact current OpenAI key/local token or recognized OpenAI/GitHub/private-key pattern was found.
- Scanned current build files and uncompressed entries of the old ZIP. No credential findings. The replacement ZIP contains only seven extension files and matches the built directory byte for byte.
- OCR-scanned 39 current tracked screenshots and 37 historical image blobs; no key-shaped text was detected. OCR can miss small, obscured, or unusual strings; these checks do not prove that all screenshots are free of personal information.
- `.env`, `.env.*` (except the empty example), `.runtime`, node_modules, and dist are Git-ignored. Neither actual `.env` is tracked. The installed backend environment is outside the repository and is not packaged.
- The API key is only used by the Node provider. The worker sends a separate local bearer token to the fixed loopback endpoint, and restricts storage to trusted extension contexts. No key is rendered in a content script or sent to the host webpage.
- These scans cannot establish whether a key was ever shared elsewhere (chat, clipboard history, backups, other repositories, or previously downloaded external artifacts). There is no exposure evidence in the audited repository/build scope.

## Request and content handling

- Backend binds to 127.0.0.1; authentication is required for health, summary, job, poll, and delete endpoints. Foreign web origins are rejected. Matching extension ID without a token does not authenticate; absent Origin requires both ID and token. Token comparison uses timingSafeEqual.
- Schema checks, input size, two-request concurrency, request-rate bounds, cancellation, deadlines, and job leases limit work. They are not a monetary spending cap; users still need their own provider usage controls.
- No arbitrary proxy URL or model-supplied executable markup: requests use fixed backend paths, and summary prose uses text nodes. Static bundled markup is the only dialog innerHTML assignment.
- Production request logging is disabled and provider errors are mapped to safe messages. OpenAI calls use store:false. This does not promise zero provider retention; see the linked provider documentation in privacy.md.
- Shadow DOM isolates styles but does not hide summary text from a hostile webpage. It contains no API credentials. Account compromise, same-user malware, local administrators, and stolen backups remain outside this design's protection.

## Validation

- `npm run verify`: type checking, ESLint, 104 unit/backend/transport tests, studio synchronization, and extension/backend builds pass.
- Repeated `npm ci && npm run verify` in a clean temporary source copy with no `.env`, node_modules, or project runtime: passes with 104 tests and zero npm advisories. This confirms source installation/build, not a complete novice user's Chrome/OS setup.
- All 35 development-page browser checks pass, including UI motion, loading states, rapid reversals, resizing, reduced motion, and 800-word scrolling. These are fixture-driven component checks, not a new Chrome Web Store installation test.
- Existing auth tests cover origin/token requirements, no-Origin extension fetches, job authentication, input limits, rate/concurrency bounds, cancellation, and error redaction.
- No paid live-model requests were made for this audit. Existing live synthetic summary evidence remains in the validation record; model accuracy is not guaranteed by security checks.

## Publication steps still requiring attention

1. Choose an application license. The Inter font's OFL is included, but it does not license the application code. Do not claim the project is open source until an application license is chosen.
2. Merge the reviewed changes into the default branch after CI passes. Make repository visibility public only as an explicit publication action; it was PRIVATE at audit start and had no releases.
3. Publish a tagged developer-preview release with the freshly generated extension ZIP and link to backend instructions. No secrets or backend installation directory should be uploaded.
4. For wider nontechnical adoption, build a guided installer/pairing flow and encrypted OS credential storage. Current users still install Node, edit a local environment file, load an unpacked extension, and pair two sides manually.
5. A Chrome Web Store release requires its own listing, icons, privacy/disclosure review, developer registration, and submission. Those steps were not performed. GitHub/LinkedIn copy must not imply Store availability.
6. Enable a private vulnerability-reporting channel when the public repository is launched. Review the drafted LinkedIn copy and use only an approved public/fixture demo.

## Reference policies

- [Chrome extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome Web Store user-data handling requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
