import { INVITATIONS_HEADER, parseFrom, rawDataLineCount } from './detect';
import { describeInvitationsDateFormat, invitationAgeBucket, parseSentAt } from './dates';
import { normalizeProfileUrl } from './urls';

export type Direction = 'INCOMING' | 'OUTGOING' | 'UNKNOWN';

export type Invitation = {
  rowId: string;
  /** Contract field. */
  name: string;
  to: string;
  sentAt: Date | null;
  /** Contract field. Empty on most rows. */
  message: string;
  /** Computed in code, never asked of Jev. */
  direction: Direction;
  inviterUrl: string;
  inviteeUrl: string;
  inviterKey: string;
  inviteeKey: string;
  /** Contract field, computed in code. */
  invitation_age: string;
  /** Filled by the join, in code. */
  status?: 'accepted' | 'pending' | 'sent';
};

export type InvitationsParse = {
  rows: Invitation[];
  rawLines: number;
  dateFormat: string;
  unparsedDates: number;
  withoutMessage: number;
  incoming: number;
  outgoing: number;
};

export function parseInvitations(text: string, now = new Date()): InvitationsParse | null {
  const parsed = parseFrom(text, INVITATIONS_HEADER);
  if (!parsed) return null;

  let unparsedDates = 0;
  let withoutMessage = 0;
  let incoming = 0;
  let outgoing = 0;

  const rows: Invitation[] = parsed.data.map((r, i) => {
    const sentAt = parseSentAt(r['Sent At'] ?? '');
    if (!sentAt) unparsedDates += 1;
    const message = (r['Message'] ?? '').trim();
    if (!message) withoutMessage += 1;

    const raw = (r['Direction'] ?? '').trim().toUpperCase();
    const direction: Direction =
      raw === 'INCOMING' ? 'INCOMING' : raw === 'OUTGOING' ? 'OUTGOING' : 'UNKNOWN';
    if (direction === 'INCOMING') incoming += 1;
    if (direction === 'OUTGOING') outgoing += 1;

    const inviterUrl = (r['inviterProfileUrl'] ?? '').trim();
    const inviteeUrl = (r['inviteeProfileUrl'] ?? '').trim();

    return {
      rowId: `i${i}`,
      name: (r['From'] ?? '').trim(),
      to: (r['To'] ?? '').trim(),
      sentAt,
      message,
      direction,
      inviterUrl,
      inviteeUrl,
      inviterKey: normalizeProfileUrl(inviterUrl),
      inviteeKey: normalizeProfileUrl(inviteeUrl),
      invitation_age: invitationAgeBucket(sentAt, now),
    };
  });

  return {
    rows,
    rawLines: rawDataLineCount(text, INVITATIONS_HEADER),
    dateFormat: describeInvitationsDateFormat(parsed.data[0]?.['Sent At'] ?? ''),
    unparsedDates,
    withoutMessage,
    incoming,
    outgoing,
  };
}

/**
 * The join, entirely in code:
 *   an OUTGOING invitee URL found in Connections  -> accepted
 *   an INCOMING inviter URL absent from Connections -> still pending
 * Both sides are compared through normalizeProfileUrl, because the two exports
 * do not write the same profile the same way.
 */
export function joinWithConnections(
  invitations: Invitation[],
  connectionUrlKeys: Set<string>,
): { rows: Invitation[]; accepted: number; pending: number } {
  let accepted = 0;
  let pending = 0;

  const rows = invitations.map((inv) => {
    if (inv.direction === 'OUTGOING') {
      const isAccepted = inv.inviteeKey !== '' && connectionUrlKeys.has(inv.inviteeKey);
      if (isAccepted) accepted += 1;
      return { ...inv, status: (isAccepted ? 'accepted' : 'sent') as Invitation['status'] };
    }
    if (inv.direction === 'INCOMING') {
      const isPending = inv.inviterKey === '' || !connectionUrlKeys.has(inv.inviterKey);
      if (isPending) pending += 1;
      return { ...inv, status: (isPending ? 'pending' : 'accepted') as Invitation['status'] };
    }
    return inv;
  });

  return { rows, accepted, pending };
}

/**
 * Which invitations Jev is allowed to see. OUTGOING rows get no call at all.
 * INCOMING rows with no message carry no signal to judge, so they are not sent
 * either; they go to the "No signal" bucket for the user to triage by hand.
 */
export function scorableInvitations(rows: Invitation[]): Invitation[] {
  return rows.filter((r) => r.direction === 'INCOMING' && r.message.trim() !== '');
}

export function noSignalInvitations(rows: Invitation[]): Invitation[] {
  return rows
    .filter((r) => r.direction === 'INCOMING' && r.message.trim() === '')
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
}
