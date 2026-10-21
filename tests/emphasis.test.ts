import { describe, expect, it } from 'vitest';
import { compactSummarySchema, compactLevels, SemanticRunSchema, highlightSummary, type SemanticRun, type AnnotatedSummary } from '../src/server/emphasis';
import { levelText, wordCount, cueWordCount } from '../src/shared/summary';
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

describe('first mentions of proper names', () => {
  it('reserves names ahead of optional topic cues without changing the prose', () => {
    const annotated = compactLevels({ levels: [{
      before: [cue('Mira Patel', 'name'), plain(' returns to the '), cue('coastal village', 'subject'), plain(' and ')],
      takeaway: 'exposes a forgery',
      after: [plain(' to clear her father.')],
    }] });
    const result = highlightSummary(annotated).levels[0]!;
    expect(result.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['Mira Patel', 'exposes a forgery']);
    expect(levelText(result)).toBe(annotated.levels[0]!.runs.map(run => run.text).join(''));
  });

  it('highlights new names in expanded details and keeps shared mentions stable', () => {
    const base = [cue('Mira', 'name'), plain(' returns home and '), cue('exposes a forgery'), plain(' in the sale documents.')];
    const detail = [plain(' Her brother '), cue('Arun', 'name'), plain(' then '), cue('returns the money', 'supporting'), plain(' after confessing his role publicly. '), cue('Mira', 'name'), plain(' reopens the family business.')];
    const result = highlightSummary({ levels: [{ runs: base }, { runs: [...base, ...detail] }] });
    const cues = result.levels.map(level => level.runs.filter(run => run.emphasis).map(run => run.text));
    expect(cues[0]).toEqual(['Mira', 'exposes a forgery']);
    expect(cues[1]).toEqual(['Mira', 'exposes a forgery', 'Arun', 'returns the money']);
  });

  it('preserves an existing highlight when an earlier mention is inserted', () => {
    const subject = [plain('The village council')];
    const predicate = [plain(' '), cue('blocked the sale'), plain(' after '), cue('Mira', 'name'), plain(' exposed forged records.')];
    const insertion = [plain(', approached by '), cue('Mira', 'name'), plain(',')];
    const result = highlightSummary({ levels: [{ runs: [...subject, ...predicate] }, { runs: [...subject, ...insertion, ...predicate] }] });
    expect(result.levels[0]!.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['blocked the sale', 'Mira']);
    expect(result.levels[1]!.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['Mira', 'blocked the sale', 'Mira']);
  });

  it('supports non-English names and suppresses repeated matching names', () => {
    expect(selected([cue('李明', 'name'), plain('发现档案遭到修改，随后'), cue('阻止土地出售'), plain('。村民感谢'), cue('李明', 'name'), plain('提供证据并帮助恢复家庭声誉。')])).toEqual(['李明', '阻止土地出售']);
    expect(selected([cue('José Álvarez', 'name'), plain(' '), cue('uncovered forged records'), plain(' in the village archive. '), cue('JOSÉ ÁLVAREZ', 'name'), plain(' then contacted the council.')])).toEqual(['José Álvarez', 'uncovered forged records']);
  });

  it('requests corrective generation rather than silently dropping a first name', () => {
    const annotated = compactLevels({ levels: [{
      before: [cue('Mira Patel', 'name'), plain(' and '), cue('Arun Patel', 'name'), plain(' ')],
      takeaway: 'expose a forgery', after: [plain(' together.')],
    }] });
    expect(() => highlightSummary(annotated)).toThrow('First mentions of names');
  });
});

it('keeps compact hyphenated cues without changing Unicode summary counts or the emphasis budget', () => {
  const phrase = 'cancelled the county-wide service-renewal rollout';
  expect(wordCount(phrase)).toBe(7);
  expect(cueWordCount(phrase)).toBe(5);
  const result = highlightSummary(compactLevels({ levels: [{
    before: [plain('The council ')], takeaway: phrase, after: [plain(' after safety failures and unresolved costs identified during an independent review.')],
  }] })).levels[0]!;
  expect(result.runs.filter(run => run.emphasis).map(run => run.text)).toContain(phrase);
  expect(cueWordCount('costs—benefits')).toBe(2);
});
