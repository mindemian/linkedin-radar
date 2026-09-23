/**
 * The join between the two files runs entirely on profile URLs, and LinkedIn
 * does not write them the same way in both exports. One file gives
 * "https://www.linkedin.com/in/jane-doe-123/", the other
 * "http://linkedin.com/in/Jane-Doe-123?originalSubdomain=ca". Comparing those
 * raw silently loses real matches, so every comparison goes through here.
 */
export function normalizeProfileUrl(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, '')   // scheme
    .replace(/^[a-z]{2,3}\./, '')  // www. and country subdomains (ca., uk.)
    .replace(/\?.*$/, '')          // tracking query
    .replace(/#.*$/, '')
    .replace(/\/+$/, '');          // trailing slash
}

export function sameProfile(a: string, b: string): boolean {
  const na = normalizeProfileUrl(a);
  return na !== '' && na === normalizeProfileUrl(b);
}
