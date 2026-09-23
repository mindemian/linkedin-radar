/**
 * Two files, two date formats, and both are reported at upload rather than
 * assumed. A date that fails to parse is returned as null and counted, never
 * silently defaulted to today.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Connections: "18 Sep 2026". */
export function parseConnectedOn(s: string): Date | null {
  const m = (s ?? '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const d = new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Invitations: "9/18/26, 1:20 AM" — month first, two-digit year. */
export function parseSentAt(s: string): Date | null {
  const m = (s ?? '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  const [, mo, day, yr, hh, mm, ampm] = m;
  let year = Number(yr);
  if (year < 100) year += 2000;
  let hour = Number(hh);
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === 'PM' && hour !== 12) hour += 12;
    if (upper === 'AM' && hour === 12) hour = 0;
  }
  const d = new Date(Date.UTC(year, Number(mo) - 1, Number(day), hour, Number(mm)));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function describeConnectionsDateFormat(sample: string): string {
  return parseConnectedOn(sample) ? 'D Mon YYYY (e.g. 18 Sep 2026)' : 'unrecognised';
}

export function describeInvitationsDateFormat(sample: string): string {
  return parseSentAt(sample) ? 'M/D/YY, h:mm AM (e.g. 9/18/26, 1:20 AM)' : 'unrecognised';
}

const DAY = 86_400_000;

/** Code-computed bucket. Jev is never asked to do date arithmetic. */
export function connectedForBucket(connectedOn: Date | null, now = new Date()): string {
  if (!connectedOn) return 'unknown';
  const years = (now.getTime() - connectedOn.getTime()) / (365.25 * DAY);
  if (years < 1) return 'under 1 year';
  if (years < 3) return '1–3 years';
  return '3+ years';
}

export function invitationAgeBucket(sentAt: Date | null, now = new Date()): string {
  if (!sentAt) return 'unknown';
  const days = (now.getTime() - sentAt.getTime()) / DAY;
  if (days <= 7) return 'this week';
  if (days <= 31) return 'this month';
  return 'older';
}
