# Public code and demo launch

## Positioning

TLDR is a proprietary Chrome extension project with publicly viewable code and a design demo. All rights are reserved; this is not an open-source release. General permission for others to install/use the software remains a separate decision. Highlight a passage, right-click TLDR, and adjust summary detail in a movable glass tray. Authorized users bring their own OpenAI key and run the backend locally. Automatic background-service installation currently supports macOS; other platforms require a manually managed Node 24 backend.

Do not describe this release as one-click, completely offline, free AI, encrypted key storage, guaranteed factual accuracy, available in the Chrome Web Store, or already suitable for nontechnical onboarding. The studio is offline; real summarization uses OpenAI and incurs API charges.

## Demo image

`docs/screenshots/release-preview.png` is a fresh capture of the current component using an authored offline fixture. It contains no API key, account settings, or private article. It illustrates the UI, not a live AI quality result. A short interaction recording will communicate the slider better than this still.

## Suggested LinkedIn post

I built TLDR because I wanted more control over how much I read.

Select a passage in Chrome, right-click TLDR, and a small glass tray summarizes it. Drag the slider to adjust the detail: new words reveal inside existing sentences, useful phrases stay highlighted, and the text moves to make room.

Most of the work was in the details: readable contrast, motion that survives rapid scrubbing, and making summaries expand without losing their meaning.

I’m sharing the code and a design demo on GitHub. The project is all rights reserved, rather than open source. Its architecture keeps the user-provided OpenAI API key in a local backend, outside the extension; selected text goes to OpenAI for summarization.

I’d love feedback on the reading experience and the setup flow.

https://github.com/sunnynanavati/tldr

#BuildInPublic #ChromeExtension #ProductDesign

## Before posting

1. The all-rights-reserved choice is recorded in LICENSE. Review the audit, commit the verified changes, and push them. Confirm the default branch contains them and CI is green.
2. Decide explicitly to make the repository public. Check its public view in a signed-out browser; the link currently points to a private repository.
3. If offering a downloadable build for others to use, first define an explicit end-user usage permission compatible with the reserved source rights. The current ZIP includes LICENSE.txt and third-party notices, but does not grant a general usage license. Never attach `.env`, `.runtime`, or installed service files.
4. Include a short screen recording using an authored fixture or public article. Hide account pages, personal tabs, key settings, clipboard history, and notifications. Demonstrate selection → tray → slider → move/resize.
5. Link the README, data-handling notes, setup requirements, and cost caveat from the release. Verify a clean-machine installation before describing setup as easy.

The post above is a draft, not a posted announcement. Publish it only once the repository link is publicly accessible.
