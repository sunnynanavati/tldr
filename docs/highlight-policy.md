# Highlights that support skimming

The production prompt is in [src/server/prompt.ts](../src/server/prompt.ts). The model generates summary prose and a highlight plan in the same request. The model annotates prose runs directly with semantic roles:

- **Takeaway:** the central action, finding, outcome, or concrete instruction. Include the subject when a skimmer needs it.
- **Qualifier:** the important uncertainty, negation, condition, or cause. A negated benefit must not become a positive highlighted noun.
- **Subject:** the essential actor or topic, kept compact so it does not crowd out the finding.
- **Name:** a proper name already present in the summary (person, organization, place, or named work/product). Reserve its first mention alongside the core takeaway; mark the name itself, not the surrounding sentence.
- **Supporting:** useful new evidence, consequences, or actions added at this length.

The test is to read only the highlighted text, in order: does it communicate the takeaway and its essential qualification, or merely name the topic? Each longer summary should add useful cues while keeping the core recognizable. Phrase counts are guides, not a reason to select weak words.

Examples of useful cues include `postponed → Riverside bridge opening → six months`, `may reduce symptoms → benefits remain unproven`, and `Mira → exposes a forgery → Arun`. Names already included in the prose deserve a first-mention cue, but the model must not add names merely to increase highlighting. These examples are editorial guidance, not facts added to user summaries.

## Selection and safeguards

Annotations attach directly to the text runs that make each summary. There is no separate quote list that can drift away from the wording. The backend checks Unicode word boundaries and never rewrites model text when applying emphasis. It selects cues in semantic priority before arranging them in text order, so early, low-value nouns cannot displace a later finding. Each annotated source run gets a fixed highlighted or muted decision when it first appears. Longer levels reserve existing highlights before considering new cues; a larger budget never promotes an already-muted run. Composition preserves source-run identity, including repeated phrases in distinct positions. New parts add their own cues as detail grows. A multiword summary must retain a usable takeaway cue; subject-only or date-only output is rejected as invalid generated output rather than mislabeled as a connection failure.

Most highlights should be 1–3 words. Provider schema constraints bound subject cues to three space-separated words/eight CJK characters, and other cues to six space-separated words/twelve CJK characters; plain prose can be longer. Up to six words (counting hyphenated compounds as one for this phrase limit) are permitted when needed to retain a complete meaning, negation, or condition. Summary word counts and the overall highlighted-word budget still use Unicode segmentation. This prevents a compact cue such as “cancelled the county-wide service-renewal rollout” from being discarded just because its compounds are split by the word counter. Whole-sentence emphasis remains excluded. English spans ending in an orphaned article, conjunction, or preposition are rejected. Currency signs, percentages, and decimal points are handled without discarding numeric cues.

The provider explicitly annotates name spans; capitalization is not used as a name detector. Name cues take priority over optional topic/supporting cues, with the required core takeaway protected first. Repeated matching names are deduplicated using Unicode normalization, case folding, and whitespace normalization within each complete level. The model handles aliases and shortened references semantically. When an expansion inserts a name earlier than an already-highlighted mention, both remain highlighted so existing words never lose emphasis while sliding. Names introduced by later details get their own first-mention highlight. If a first annotated name cannot survive the presentation safeguards, the same bounded corrective generation asks for shorter/rebalanced cues rather than silently discarding it. Proper-name recognition still depends on model annotations.

The prompt aims for roughly 20–30% of words highlighted. The guard allows up to `max(6, ceil(wordCount * .35))` words and `max(10, ceil(wordCount / 12))` phrases. The six-word floor gives very short summaries room for one complete semantic cue. This is a ceiling, not a density target. The model must still choose useful phrases; passing structural guards does not establish semantic quality.

The summary contract, source-language behavior, composition/insertion approach, and model are preserved. Substantial additions (12+ words) must contribute usable new cues: at least one per 25 added words and at least floor(12% of added words), with a minimum of one. Missing coverage triggers at most one corrective generation within the same request deadline (20 seconds for passages, 90 seconds for article jobs). Successful output is still preloaded before display, so slider changes make no API calls. The provider-only annotation schema changed; the extension continues to receive plain text runs with emphasis flags. The production path does not log passages or generated text. The optional inspection callback is used only by the authored-fixture evaluation script. Composition assembly also repairs missing separators between Latin clause/sentence parts, preventing word joins such as "exercisemay" without adding spaces to CJK text.

## Evaluation

`npm run test:ai` evaluates six original, non-private passages: practical advice, a short instruction, Chinese, an announcement, preliminary research, and a narrative. It checks the response contract, increasing counts, shortening, highlight presence, and presentation budgets. It saves the prose, highlights-only reading, and requested semantic roles in [summary-quality-samples.md](summary-quality-samples.md) for manual review.

Manual review asks:

1. Does the highlighted reading communicate the main action or finding, rather than just the topic?
2. Is essential uncertainty or negation retained?
3. Do added cues contribute information instead of repeating the takeaway or emphasizing incidental names?
4. Do longer levels retain the main takeaway?
5. Are the complete summaries factual and grammatical?

Prompt development follows the official [OpenAI prompting guidance](https://developers.openai.com/api/docs/guides/prompt-engineering): version the prompt near its feature, supply explicit examples and output requirements, and evaluate representative inputs. Structural tests complement manual semantic review; future model outputs can vary.
