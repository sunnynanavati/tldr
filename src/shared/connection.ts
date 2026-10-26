/** A provider key must never be saved as the browser's local pairing token. */
export function localTokenIssue(token: string): string | null {
  if (/^sk-/iu.test(token)) return 'That looks like an OpenAI API key. Keep it in the backend’s .env file; paste TLDR_LOCAL_TOKEN here instead.';
  if (token.length < 32 || token.length > 512 || /\s/u.test(token)) return 'Use a local token of 32–512 characters without spaces, generated with npm run token.';
  return null;
}
