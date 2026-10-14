export interface CountStep { value: number; offset: number }
/** One shared numeric timeline, including carry/borrow boundaries. */
export function countJourney(from: number, to: number): CountStep[] {
  if (from === to) return [{ value: to, offset: 1 }];
  const direction = to > from ? 1 : -1, distance = Math.abs(to - from);
  const steps: CountStep[] = [];
  for (let value = direction > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
    direction > 0 ? value <= to : value >= to; value += direction) {
    steps.push({ value, offset: Math.abs(value - from) / distance });
  }
  return steps;
}
export function digitPath(current: string[], position: number, steps: CountStep[], place: number, direction: number) {
  // Keep the visible pair so interrupting a roll never snaps to its old target.
  const start = Math.max(0, Math.floor(position));
  const glyphs = current.slice(start, Math.min(current.length, Math.ceil(position) + 1));
  if (!glyphs.length) glyphs.push(' ');
  const frames = [{ offset: 0, position: position - start }];
  for (const step of steps) {
    const digit = String(step.value).padStart(4, ' ')[place]!;
    const previous = frames.at(-1)!.position;
    let target = direction > 0 ? Math.ceil(previous) : Math.floor(previous);
    if (glyphs[target] !== digit) {
      if (direction > 0) { glyphs.push(digit); target = glyphs.length - 1; }
      else { glyphs.unshift(digit); frames.forEach(frame => frame.position++); target = 0; }
    }
    frames.push({ offset: step.offset, position: target });
  }
  return { glyphs, frames };
}
