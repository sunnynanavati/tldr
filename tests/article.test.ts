import { describe, expect, it, vi } from 'vitest';
import { articleSections, readArticle, validateSectionEvidence, SECTION_CHARS, SECTION_CONCURRENCY } from '../src/server/article';
import { MAX_INPUT_CHARS } from '../src/shared/summary';

describe('long article coverage and grounding', () => {
  it.each([
    'A finding has a limitation. Another follows.\n\n',
    '中文研究记录显示结果仍不确定。详细说明需要更多证据。',
    'UnbrokenText🙂',
  ])('covers the maximum input exactly with bounded sections: %s', sample => {
    const text = sample.repeat(Math.ceil(MAX_INPUT_CHARS / sample.length)).slice(0, MAX_INPUT_CHARS - 1) + '.';
    const sections = articleSections(text);
    expect(sections.map(section => section.text).join('')).toBe(text);
    expect(sections.length).toBeLessThanOrEqual(Math.ceil(MAX_INPUT_CHARS / (SECTION_CHARS / 2)));
    for (const [index, section] of sections.entries()) {
      expect(section.start).toBe(index ? sections[index - 1]!.end : 0);
      expect(section.text.length).toBeLessThanOrEqual(SECTION_CHARS);
      expect(section.context).toContain(section.text);
      if (index > 0) expect(section.context).toContain(text.slice(section.start - 100, section.start));
      expect(/^[\uDC00-\uDFFF]/u.test(section.text)).toBe(false);
      expect(/[\uD800-\uDBFF]$/u.test(section.text)).toBe(false);
    }
  });

  it('prefers paragraph boundaries and keeps nearby qualifications as context', () => {
    const first = 'Evidence was collected. '.repeat(500) + '\n\n';
    const text = first + 'But it did not establish a lasting benefit. '.repeat(500);
    const sections = articleSections(text);
    expect(sections[0]!.text).toBe(first);
    expect(sections[0]!.context).toContain('But it did not establish a lasting benefit.');
  });

  it('rejects invented sentence IDs, missing sections, and malformed evidence', () => {
    const section = articleSections('The trial did not establish a cure.')[0]!;
    expect(() => validateSectionEvidence(section, { excerpts: [{ start: 0, end: 10, kind: 'finding' }] })).toThrow('verify its evidence');
    expect(() => validateSectionEvidence(section, { excerpts: [] })).toThrow('incomplete');
    expect(() => articleSections('x'.repeat(MAX_INPUT_CHARS + 1))).toThrow();
    expect(validateSectionEvidence(section, { excerpts: [{ start: 0, end: 0, kind: 'qualification' }] }).excerpts)
      .toEqual([{ quote: 'The trial did not establish a cure.', kind: 'qualification' }]);
    expect(() => validateSectionEvidence(section, { excerpts: [{ start: 1, end: 0, kind: 'finding' }] })).toThrow('verify its evidence');
    expect(() => validateSectionEvidence(section, { excerpts: [{ start: -1, end: 0, kind: 'finding' }] })).toThrow('incomplete');
  });

  it('bounds parallel calls, preserves source order, and includes the last section', async () => {
    const text = Array.from({ length: 12 }, (_, i) => `Section ${i}: ` + 'Evidence remains provisional. '.repeat(500)).join('\n\n');
    let active = 0, peak = 0;
    const result = JSON.parse(await readArticle(text, new AbortController().signal, async section => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, section.index % 2 ? 1 : 3));
      active--;
      return { excerpts: [{ start: 0, end: 0, kind: 'finding' }] };
    })) as { section: number; start: number; end: number }[];
    expect(peak).toBe(SECTION_CONCURRENCY);
    expect(result.map(section => section.section)).toEqual(result.map((_, i) => i + 1));
    expect(result.at(-1)!.end).toBe(text.length);
  });

  it('retains longer qualifying context and merges overlapping references without duplicating evidence', () => {
    const text = 'The pilot was delivered. Its first test failed. Costs rose. No rollout was approved. A second test is pending.';
    const section = articleSections(text)[0]!;
    const result = validateSectionEvidence(section, { excerpts: [
      { start: 0, end: 3, kind: 'finding' }, { start: 2, end: 4, kind: 'qualification' },
    ] });
    expect(result.excerpts).toEqual([{ quote: text, kind: 'qualification' }]);
  });

  it('aborts siblings and schedules no more sections after a failure', async () => {
    const signals: AbortSignal[] = [];
    const reader = vi.fn(async (_section, signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length === 1) return { excerpts: [{ start: 9999, end: 9999, kind: 'finding' }] };
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    await expect(readArticle('Source evidence. '.repeat(8000), new AbortController().signal, reader)).rejects.toThrow('verify its evidence');
    expect(reader).toHaveBeenCalledTimes(SECTION_CONCURRENCY);
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });

  it('stops queued and active work when the user closes the tray', async () => {
    const controller = new AbortController();
    const reader = vi.fn(async (_section, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const result = readArticle('Source evidence. '.repeat(8000), controller.signal, reader);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(reader).toHaveBeenCalledTimes(SECTION_CONCURRENCY);
    await expect(readArticle('Source.', controller.signal, reader)).rejects.toMatchObject({ name: 'AbortError' });
    expect(reader).toHaveBeenCalledTimes(SECTION_CONCURRENCY);
  });
});
