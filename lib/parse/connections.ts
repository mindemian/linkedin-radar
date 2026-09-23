import { CONNECTIONS_HEADER, parseFrom, rawDataLineCount } from './detect';
import { connectedForBucket, describeConnectionsDateFormat, parseConnectedOn } from './dates';
import { normalizeProfileUrl } from './urls';

export type Connection = {
  rowId: string;
  firstName: string;
  lastName: string;
  url: string;
  urlKey: string;
  hasEmail: boolean;
  company: string;
  position: string;
  connectedOn: Date | null;
  /** Contract field, computed in code. */
  connected_for: string;
  /** Contract field, passed only when present. */
  name_suffixes?: string;
};

export type ConnectionsParse = {
  rows: Connection[];
  rawLines: number;
  dateFormat: string;
  unparsedDates: number;
  emptyPosition: number;
  emptyCompany: number;
  withEmail: number;
};

/** Credentials trailing the surname: "Jane Doe, CPA, MBA" or "Doe PhD". */
const SUFFIX = /\b(ph\.?d|m\.?b\.?a|c\.?p\.?a|p\.?eng|m\.?d|j\.?d|c\.?f\.?a|r\.?n|d\.?d\.?s|ll\.?m|m\.?sc|b\.?sc|pmp|cfp|cma|cpha|icd\.d)\b/i;

function splitSuffixes(lastName: string): { last: string; suffixes?: string } {
  const parts = lastName.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const tail = parts.slice(1);
    if (tail.some((t) => SUFFIX.test(t))) return { last: parts[0], suffixes: tail.join(', ') };
  }
  const m = lastName.match(new RegExp(`^(.*?)\\s+(${SUFFIX.source})\\s*$`, 'i'));
  if (m) return { last: m[1].trim(), suffixes: m[2].trim() };
  return { last: lastName };
}

export function parseConnections(text: string, now = new Date()): ConnectionsParse | null {
  const parsed = parseFrom(text, CONNECTIONS_HEADER);
  if (!parsed) return null;

  let unparsedDates = 0;
  let emptyPosition = 0;
  let emptyCompany = 0;
  let withEmail = 0;

  const rows: Connection[] = parsed.data.map((r, i) => {
    const position = (r['Position'] ?? '').trim();
    const company = (r['Company'] ?? '').trim();
    const email = (r['Email Address'] ?? '').trim();
    const connectedOn = parseConnectedOn(r['Connected On'] ?? '');
    if (!connectedOn) unparsedDates += 1;
    if (!position) emptyPosition += 1;
    if (!company) emptyCompany += 1;
    if (email) withEmail += 1;

    const { last, suffixes } = splitSuffixes((r['Last Name'] ?? '').trim());
    const url = (r['URL'] ?? '').trim();

    return {
      rowId: `c${i}`,
      firstName: (r['First Name'] ?? '').trim(),
      lastName: last,
      url,
      urlKey: normalizeProfileUrl(url),
      hasEmail: email !== '',
      company,
      position,
      connectedOn,
      connected_for: connectedForBucket(connectedOn, now),
      ...(suffixes ? { name_suffixes: suffixes } : {}),
    };
  });

  return {
    rows,
    rawLines: rawDataLineCount(text, CONNECTIONS_HEADER),
    dateFormat: describeConnectionsDateFormat(parsed.data[0]?.['Connected On'] ?? ''),
    unparsedDates,
    emptyPosition,
    emptyCompany,
    withEmail,
  };
}
