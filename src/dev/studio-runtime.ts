// Bundled inline into the offline studio by scripts/sync-studio.ts.
// Production never imports this development entry point.
export { settings as defaults } from '../ui/settings';
export { SummaryReveal } from '../ui/reveal';
export { WordCounter } from '../ui/counter';
export { DetailSlider } from '../ui/slider';
export { summaryText, wordCount } from '../shared/summary';
import { fixtureLevels } from './fixtures';
import { restrainEmphasis } from '../shared/summary';
export const levels = fixtureLevels.map(restrainEmphasis);

export { TrayGeometry } from '../ui/geometry';
export { approximateCount, countLabel } from '../ui/count';
