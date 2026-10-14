import { describe, expect, it } from 'vitest';
import { countJourney, digitPath } from '../src/ui/counter-path';
describe('whole-number counter motion', () => {
  it('visits every integer between rounded preset counts', () => {
    expect(countJourney(50, 70).map(step => step.value)).toEqual(Array.from({ length: 20 }, (_, i) => 51 + i));
    expect(countJourney(70, 50).map(step => step.value)).toEqual(Array.from({ length: 20 }, (_, i) => 69 - i));
  });
  it('rolls the ones reel even when both counts end in zero', () => {
    const path = digitPath(['0'], 0, countJourney(50, 70), 3, 1);
    expect(path.glyphs.join('')).toBe('012345678901234567890');
    expect(path.frames.at(-1)!.position).toBe(20);
  });
  it('synchronizes carries and borrows without rolling unchanged digits', () => {
    for (const [from, to] of [[90, 110], [110, 90], [990, 1000]] as const) {
      const steps = countJourney(from, to), initial = String(from).padStart(4, ' ');
      const paths = [...initial].map((digit, i) => digitPath([digit], 0, steps, i, Math.sign(to - from)));
      steps.forEach((step, index) => {
        expect(paths.map(path => path.glyphs[path.frames[index + 1]!.position]).join('').trim()).toBe(String(step.value));
      });
    }
  });
  it('preserves the visible pair when reversing a partially rolled digit', () => {
    const path = digitPath(['4', '5'], .6, countJourney(64.6, 50), 3, -1);
    const position = path.frames[0]!.position;
    expect(path.glyphs[Math.floor(position)]).toBe('4');
    expect(path.glyphs[Math.ceil(position)]).toBe('5');
    expect(position % 1).toBeCloseTo(.6);
    expect(path.glyphs[path.frames.at(-1)!.position]).toBe('0');
    expect(path.frames.at(-1)!.offset).toBe(1);
  });
});
