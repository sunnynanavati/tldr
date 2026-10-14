/** Presentation only: the summary contract retains exact Unicode word counts. */
export const approximateCount = (words: number): number => Math.ceil(words / 10) * 10;
export const countLabel = (words: number): string => `Approximately ${approximateCount(words)} words`;
