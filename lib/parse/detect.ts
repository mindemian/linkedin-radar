import Papa from 'papaparse';

export const CONNECTIONS_HEADER = [
  'First Name', 'Last Name', 'URL', 'Email Address', 'Company', 'Position', 'Connected On',
];
export const INVITATIONS_HEADER = [
  'From', 'To', 'Sent At', 'Message', 'Direction', 'inviterProfileUrl', 'inviteeProfileUrl',
];

export type FileKind = 'connections' | 'invitations' | 'unknown';

/**
 * Connections.csv opens with a "Notes:" preamble of several lines before the
 * real header. Find that header line rather than assuming a fixed offset — the
 * preamble's length is not guaranteed.
 */
export function findHeaderLine(text: string, header: string[]): number {
  const lines = text.split(/\r?\n/);
  const first = header[0];
  const second = header[1];
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i];
    if (line.includes(first) && line.includes(second)) return i;
  }
  return -1;
}

/**
 * Identify a file from its header row, never from its filename. A file dropped
 * in the wrong slot is still recognised, and the caller moves it.
 */
export function identify(text: string): FileKind {
  if (findHeaderLine(text, CONNECTIONS_HEADER) !== -1) return 'connections';
  if (findHeaderLine(text, INVITATIONS_HEADER) !== -1) return 'invitations';
  return 'unknown';
}

/** Strip the BOM and everything above the header, then parse. */
export function parseFrom(text: string, header: string[]) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const idx = findHeaderLine(clean, header);
  if (idx === -1) return null;
  const body = clean.split(/\r?\n/).slice(idx).join('\n');
  return Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
}

/** Non-empty data lines below the header, for the parsed-vs-raw count check. */
export function rawDataLineCount(text: string, header: string[]): number {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const idx = findHeaderLine(clean, header);
  if (idx === -1) return 0;
  return clean
    .split(/\r?\n/)
    .slice(idx + 1)
    .filter((l) => l.trim() !== '').length;
}

export function expectedColumnsMessage(): string {
  return (
    `That file does not match either export.\n` +
    `Connections.csv needs: ${CONNECTIONS_HEADER.join(', ')}.\n` +
    `Invitations.csv needs: ${INVITATIONS_HEADER.join(', ')}.`
  );
}
