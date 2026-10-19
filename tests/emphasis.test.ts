import { describe, expect, it } from 'vitest';
import { compactSummarySchema, compactLevels, SemanticRunSchema, highlightSummary, type SemanticRun, type AnnotatedSummary } from '../src/server/emphasis';
import { levelText } from '../src/shared/summary';
const plain = (text: string): SemanticRun => ({ text, role: 'plain' });
const cue = (text: string, role: SemanticRun['role'] = 'takeaway'): SemanticRun => ({ text, role });
const model = (runs: SemanticRun[]): AnnotatedSummary => ({ levels: [{ runs }] });
const selected = (runs: SemanticRun[]) => highlightSummary(model(runs)).levels[0]!.runs.filter(run => run.emphasis).map(run => run.text);

describe('semantic highlights attached to prose', () => {
  it('preserves the exact text while projecting inline roles into presentation flags', () => {
    const runs = [plain('The council '), cue('postponed'), plain(' the '), cue('bridge opening'), plain(' by '), cue('six months', 'supporting'), plain(' after inspectors found structural cracks.')];
    expect(selected(runs)).toEqual(['postponed', 'bridge opening', 'six months']);
    const result = highlightSummary(model(runs)).levels[0]!;
    expect(levelText(result)).toBe(runs.map(run => run.text).join(''));
    expect(result.runs.every(run => Object.keys(run).sort().join() === 'emphasis,text')).toBe(true);
  });
  it('carries core cues into every level while selecting new details where budget allows', () => {
    const core = [plain('The trial suggests it '), cue('may ease anxiety'), plain(', but '), cue('benefits remain unproven', 'qualifier'), plain('.')];
    const result = highlightSummary({ levels: [{ runs: core }, { runs: [...core, plain(' Researchers want a '), cue('larger trial', 'supporting'), plain(' with longer follow-up before recommending it as a replacement for established care.')] }] });
    expect(result.levels[0]!.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['may ease anxiety', 'benefits remain unproven']);
    expect(result.levels[1]!.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['may ease anxiety', 'benefits remain unproven', 'larger trial']);
  });
  it('protects the later main finding and its negation from earlier low-priority context', () => {
    const runs = [plain('The trial at '), cue('a regional clinic', 'supporting'), plain(' found the treatment '), cue('did not improve'), plain(' symptoms after '), cue('six weeks', 'qualifier'), plain('.')];
    expect(selected(runs)).toEqual(['did not improve', 'six weeks']);
  });
  it('never highlights an entire sentence, even if punctuation is in a plain run', () => {
    expect(() => selected([cue('Focus matters'), plain('. Other routines make deliberate choices easier every day.')])).toThrow();
    expect(() => selected([cue('An entire sentence should never be highlighted.')])).toThrow();
  });
  it('rejects word fragments, unmarked text, and clipped English relations', () => {
    expect(() => selected([cue('art'), plain('icle explains a useful daily practice.')])).toThrow();
    expect(() => selected([plain('Attention shapes focus.')])).toThrow();
    expect(selected([plain('The trial '), cue('may ease anxiety'), plain(', but it is '), cue('not evidence of a', 'qualifier'), plain(' cure and '), cue('did not compare the exercise with', 'supporting'), plain(' established care.')])).toEqual(['may ease anxiety']);
  });
  it('keeps a complete short core cue when the summary itself is very short', () => {
    expect(selected([plain('Small changes can '), cue('make focused work easier'), plain('.')])).toEqual(['make focused work easier']);
  });
  it('handles currency, percentage, decimal, and surrounding punctuation without changing text', () => {
    expect(selected([plain('Repairs need a proposed '), cue('$12 million', 'supporting'), plain(' budget, while officials expect '), cue('12.5% lower costs'), plain(' after an independent review of the project.')])).toEqual(['$12 million', '12.5% lower costs']);
    expect(selected([plain('Daily routines make it easier to sustain '), cue('attention.'), plain(' A useful adjustment follows.')])).toEqual(['attention']);
  });
  it('supports meaningful Chinese cues instead of requiring space-separated English words', () => {
    expect(selected([plain('图书馆'), cue('延长开放时间'), plain('，但须权衡'), cue('人员安排', 'qualifier'), plain('和'), cue('运营成本', 'qualifier'), plain('，同时考虑更多读者的需要。')])).toEqual(['延长开放时间', '人员安排', '运营成本']);
  });
  it('constrains compact output annotations and permits an already-concise result', () => {
    expect(compactSummarySchema().safeParse({ levels: [{ before: [], takeaway: 'no proven benefit', after: [] }] }).success).toBe(true);
    expect(compactSummarySchema().safeParse({ levels: [{ runs: [{ text: 'focus', emphasis: true }] }] }).success).toBe(false);
    expect(highlightSummary({ levels: [] })).toEqual({ levels: [] });
  });
});

it('enforces short cues in the provider schema while allowing long plain prose', () => {
  const long = 'This is a long passage with too many words to be a short cue.';
  expect(SemanticRunSchema.safeParse(cue(long)).success).toBe(false);
  expect(compactSummarySchema().safeParse({ levels: [{ before: [plain(long)], takeaway: 'may reduce anxiety', after: [] }] }).success).toBe(true);
  expect(SemanticRunSchema.safeParse(cue('这是一个过长并且不适合突出显示的中文段落')).success).toBe(false);
});
it('prioritizes the action over a preceding subject when both would exhaust the budget', () => {
  expect(selected([cue('Small changes to everyday environments', 'subject'), plain(' can '), cue('make focused work easier'), plain('.')])).toEqual(['make focused work easier']);
});
it('requires a usable takeaway instead of accepting topic-only emphasis', () => {
  expect(() => selected([cue('Mira', 'subject'), plain(' exposes the forged sale and clears her father.')])).toThrow();
});

it('keeps earlier highlights when later high-priority details compete for the budget', () => {
  const base = [plain('Her early films '), cue('drew attention'), plain(' from audiences and critics. Bullett Raja '), cue('flopped', 'supporting'), plain(', while R Rajkumar '), cue('succeeded commercially', 'supporting'), plain(' but drew mixed reviews.')];
  const extra = [plain(' She later '), cue('chose a saree for comfort'), plain(' during filming.')];
  const result = highlightSummary({ levels: [{ runs: base }, { runs: [...base, ...extra] }] });
  const phrases = result.levels.map(level => level.runs.filter(run => run.emphasis).map(run => run.text));
  expect(phrases[0]).toContain('flopped');
  expect(phrases[0]).toContain('succeeded commercially');
  for (const phrase of phrases[0]!) expect(phrases[1]).toContain(phrase);
});

it('does not promote previously muted cues when a longer level gains budget', () => {
  const core = [plain('The small trial '), cue('may ease anxiety'), plain(', although '), cue('benefits remain unproven', 'qualifier'), plain(' at a '), cue('regional clinic', 'supporting'), plain('.')];
  const extra = [plain(' Researchers plan to '), cue('recruit more participants', 'supporting'), plain(' and track outcomes over several months before making recommendations.')];
  const result = highlightSummary({ levels: [{ runs: core }, { runs: [...core, ...extra] }] });
  for (const level of result.levels) expect(level.runs.filter(run => run.emphasis).map(run => run.text)).not.toContain('regional clinic');
});
it('preserves the required core ahead of any other annotated wording', () => {
  const annotated = compactLevels({ levels: [{
    before: [cue('Small environmental changes', 'takeaway'), plain(' can ')],
    takeaway: 'make focused work easier', after: [plain('.')],
  }] });
  const result = highlightSummary(annotated).levels[0]!;
  expect(result.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['make focused work easier']);
});


it('rejects substantial expansions with only old highlights, including malformed new cues', () => {
  const core = [plain('Chulbul Pandey '), { text: 'marries Rajjo', role: 'core' as const }, plain(' and disrupts the wedding.')];
  const added = [plain(' The marriage leaves Masterji feeling disgraced and he cancels the other wedding. Earlier events explain why each family refuses to support the couple.')];
  expect(() => highlightSummary({ levels: [{ runs: core }, { runs: [...core, ...added] }] })).toThrow('New details need');
  expect(() => highlightSummary({ levels: [{ runs: core }, { runs: [...core, plain(' His brother '), cue('did not know of the', 'qualifier'), ...added] }] })).toThrow('New details need');
});
