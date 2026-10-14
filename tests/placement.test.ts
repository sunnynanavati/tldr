import { describe, expect, it } from 'vitest';
import { placePanel } from '../src/ui/placement';
describe('selection placement', () => {
  it('prefers the right side when it fits', () => {
    expect(placePanel({ width: 1200, height: 800 }, { left: 100, top: 150, right: 600, bottom: 300 })).toEqual({ left: 612, top: 150, width: 320, height: 420 });
  });
  it('uses the left side near the right edge', () => {
    const box = placePanel({ width: 1000, height: 800 }, { left: 700, top: 20, right: 980, bottom: 160 });
    expect(box.left).toBe(368);
  });
  it('centers lost selections and clamps both axes on short, narrow viewports', () => {
    expect(placePanel({ width: 319, height: 300 }, null)).toEqual({ left: 16, top: 16, width: 287, height: 268 });
    const box = placePanel({ width: 360, height: 640 }, { left: 20, top: 600, right: 340, bottom: 630 });
    expect(box.left).toBeGreaterThanOrEqual(16); expect(box.top + box.height).toBeLessThanOrEqual(624);
  });
  it('respects a zoomed visual viewport offset', () => {
    expect(placePanel({ width: 300, height: 400, left: 30, top: 50 }, null)).toEqual({ left: 46, top: 66, width: 268, height: 368 });
  });
});
