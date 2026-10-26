# Open-source developer-preview launch

## Positioning

TLDR is a GPL-3.0-only Chrome extension developer preview. Users can use it, fork it, add features, and redistribute it under the GPL, including commercially. Distributed derivatives must remain under GPL with corresponding source available. Highlight a passage, right-click TLDR, and adjust summary detail in a movable glass tray. Users bring their own OpenAI key and run the backend locally. Automatic background-service installation currently supports macOS; other platforms require a manually managed Node 24 backend.

Do not describe this release as one-click, completely offline, free AI, encrypted key storage, guaranteed factual accuracy, available in the Chrome Web Store, or already suitable for nontechnical onboarding. The studio is offline; real summarization uses OpenAI and incurs API charges.

## Demo image

`docs/screenshots/release-preview.png` is a fresh capture of the current component using an authored offline fixture. It contains no API key, account settings, or private article. It illustrates the UI, not a live AI quality result. A short interaction recording will communicate the slider better than this still.

## Suggested LinkedIn post

I built TLDR because I wanted more control over how much I read.

Select a passage in Chrome, right-click TLDR, and a small glass tray summarizes it. Drag the slider to adjust the detail: new words reveal inside existing sentences, useful phrases stay highlighted, and the text moves to make room.

Most of the work was in the details: readable contrast, motion that survives rapid scrubbing, and making summaries expand without losing their meaning.

I’m open-sourcing TLDR under GPL-3.0. Bring your own API key, try it locally, fork it, or contribute a feature. Its architecture keeps the user-provided OpenAI API key in a local backend, outside the extension; selected text goes to OpenAI for summarization.

I’d love feedback on the reading experience and the setup flow.

https://github.com/sunnynanavati/tldr

#BuildInPublic #ChromeExtension #ProductDesign

## Before posting

1. The GPL-3.0-only choice is recorded in LICENSE. Review the audit, commit the verified changes, and push them. Confirm the default branch contains them and CI is green.
2. Decide explicitly to make the repository public. Check its public view in a signed-out browser; confirm the link is accessible without signing in.
3. For a downloadable build, provide corresponding source for that exact version alongside it (for example, the tagged source archive with build scripts). The ZIP includes LICENSE.txt and third-party notices. Never attach `.env`, `.runtime`, or installed service files.
4. Include a short screen recording using an authored fixture or public article. Hide account pages, personal tabs, key settings, clipboard history, and notifications. Demonstrate selection → tray → slider → move/resize.
5. Link the README, data-handling notes, setup requirements, and cost caveat from the release. Verify a clean-machine installation before describing setup as easy.

The post above is a draft, not a posted announcement. Publish it only once the repository link is publicly accessible.
