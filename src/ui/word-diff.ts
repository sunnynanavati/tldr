// Longest common subsequence preserves repeated words in reading order.
export function matchWords(before: readonly string[], after: readonly string[]): Map<number, number> {
  const columns = after.length + 1;
  const lengths = new Uint16Array((before.length + 1) * columns);
  for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--) {
    lengths[i * columns + j] = before[i] === after[j]
      ? lengths[(i + 1) * columns + j + 1]! + 1
      : Math.max(lengths[(i + 1) * columns + j]!, lengths[i * columns + j + 1]!);
  }
  const matches = new Map<number, number>();
  let i = 0, j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) { matches.set(j++, i++); }
    else if (lengths[(i + 1) * columns + j]! >= lengths[i * columns + j + 1]!) i++;
    else j++;
  }
  return matches;
}
