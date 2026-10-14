import { describe, expect, it } from 'vitest';
import { clampTray, adjustTray } from '../src/ui/geometry';
import { approximateCount, countLabel } from '../src/ui/count';
const view = { width: 1000, height: 800 };
const box = { left: 100, top: 80, width: 320, height: 420 };
describe('movable, resizable tray geometry', () => {
  it('moves without resizing and stops at viewport margins', () => {
    expect(adjustTray(box, 'move', -1000, 1000, view)).toEqual({ ...box, left: 16, top: 364 });
  });
  it('accepts DOMRect-style inherited geometry accessors', () => {
    expect(adjustTray(Object.create(box), 'move', 10, 10, view)).toEqual({ ...box, left: 110, top: 90 });
  });
  it('resizes without moving the opposite corner', () => {
    expect(adjustTray(box, 'resize', 1000, 1000, view)).toEqual({ ...box, width: 884, height: 704 });
    expect(adjustTray(box, 'resize', -1000, -1000, view)).toEqual({ ...box, width: 260, height: 260 });
  });
  it('keeps controls reachable after narrowing or zooming the viewport', () => {
    expect(clampTray(box, { width: 240, height: 250, left: 30, top: 50 })).toEqual({ left: 46, top: 66, width: 208, height: 218 });
  });
  it('preserves manually set geometry when there is enough room', () => {
    expect(clampTray(box, view)).toEqual(box);
  });
});
describe('approximate word count presentation', () => {
  it('rounds up to tens without changing exact multiples', () => {
    expect([1, 20, 56, 101, 110, 999].map(approximateCount)).toEqual([10, 20, 60, 110, 110, 1000]);
    expect(countLabel(56)).toBe('Approximately 60 words');
  });
});
