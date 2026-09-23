/**
 * Synthetic fixtures matching both export schemas exactly. Nothing here is real
 * and nothing here is committed: /fixtures/ is gitignored.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'fixtures');
mkdirSync(DIR, { recursive: true });

const FIRST = ['Jane', 'Amir', 'Priya', 'Tomas', 'Wen', 'Fatima', 'Oscar', 'Lena', 'Kwame', 'Ingrid'];
const LAST = ['Doe', 'Haddad', 'Raman', 'Novak', 'Li', 'Zahra', 'Mbeki', 'Sorensen', 'Okafor', 'Lindqvist'];
const COMPANY = [
  'Brightwater Holdings', 'Novex Industrial Group', 'Sorensen & Sons Manufacturing',
  'Acme Corporation', 'Pinnacle Logistics Ltd', 'Northline Distribution',
  'Meridian Health Partners', 'Cascade Software', '', 'Halvorsen Construction Group',
];
const POSITION = [
  'Chief Operating Officer', 'President & Owner', 'Chief of Staff', 'VP Operations',
  'Student', 'Technical Recruiter', 'Founder (pre-seed, hiring!)', '',
  'Managing Director', 'Plant Manager',
];
const SUFFIXED = ['Doe, CPA', 'Raman, MBA', 'Novak PhD', 'Okafor, P.Eng'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pick = <T,>(a: T[], i: number) => a[i % a.length];

// --- Connections.csv -------------------------------------------------------
const N_CONN = 120;
const connLines: string[] = [];
const profileUrls: string[] = [];

for (let i = 0; i < N_CONN; i++) {
  const first = pick(FIRST, i);
  // Every fourth surname carries credentials, so name_suffixes is exercised.
  const last = i % 4 === 0 ? pick(SUFFIXED, i) : pick(LAST, i + 3);
  const slug = `${first}-${last.split(',')[0].split(' ')[0]}-${100 + i}`.toLowerCase();
  const url = `https://www.linkedin.com/in/${slug}/`;
  profileUrls.push(url);
  const email = i % 9 === 0 ? `${first.toLowerCase()}@example.com` : '';
  const company = pick(COMPANY, i + 2);
  const position = pick(POSITION, i);
  const day = (i % 28) + 1;
  const month = MONTHS[i % 12];
  const year = 2022 + (i % 5);
  const q = (s: string) => (s.includes(',') ? `"${s}"` : s);
  connLines.push(
    [first, q(last), url, email, q(company), q(position), `${day} ${month} ${year}`].join(','),
  );
}

const connections = [
  'Notes:',
  '"When exporting your connection data, you may notice that some of the fields are empty.',
  'This is because we only surface data that members have chosen to make visible."',
  '',
  'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
  ...connLines,
  '',
].join('\n');

// --- Invitations.csv -------------------------------------------------------
const MESSAGES = [
  "Hi, I lead ops at a family-owned distributor and would value connecting.",
  "I help companies cut cloud spend by 40%. Free audit this week?",
  "Loved your post on operations. I'm a student hoping to learn more.",
  "WIN A FREE IPHONE CLICK HERE NOW!!!",
  "We met at the conference last year, good to reconnect.",
];
const N_INV = 80;
const invLines: string[] = [];

for (let i = 0; i < N_INV; i++) {
  const first = pick(FIRST, i + 1);
  const last = pick(LAST, i + 5);
  const outgoing = i % 2 === 0;
  // Overlap: some outgoing invitees are already connections, so accepted/sent
  // matching has something real to find. Vary the URL form on purpose.
  let inviteeUrl = '';
  let inviterUrl = '';
  if (outgoing) {
    if (i % 3 === 0) {
      const base = profileUrls[i % profileUrls.length];
      inviteeUrl =
        i % 6 === 0
          ? base.replace('https://www.', 'http://').replace(/\/$/, '?originalSubdomain=ca')
          : base;
    } else {
      inviteeUrl = `https://www.linkedin.com/in/${first}-${last}-${900 + i}`.toLowerCase();
    }
    inviterUrl = 'https://www.linkedin.com/in/me-myself-1/';
  } else {
    inviterUrl =
      i % 5 === 0
        ? profileUrls[(i + 7) % profileUrls.length]
        : `https://www.linkedin.com/in/${first}-${last}-${500 + i}`.toLowerCase();
    inviteeUrl = 'https://www.linkedin.com/in/me-myself-1/';
  }
  // Messages on a minority of rows only.
  const message = i % 5 === 0 ? pick(MESSAGES, i) : '';
  const mo = (i % 12) + 1;
  const day = (i % 28) + 1;
  const hour = (i % 12) + 1;
  invLines.push(
    [
      `${first} ${last}`,
      'Me Myself',
      `"${mo}/${day}/26, ${hour}:20 ${i % 2 ? 'AM' : 'PM'}"`,
      message ? `"${message}"` : '',
      outgoing ? 'OUTGOING' : 'INCOMING',
      inviterUrl,
      inviteeUrl,
    ].join(','),
  );
}

const invitations = [
  'From,To,Sent At,Message,Direction,inviterProfileUrl,inviteeProfileUrl',
  ...invLines,
  '',
].join('\n');

// --- a file matching neither schema ---------------------------------------
const wrong = 'Alpha,Beta,Gamma\n1,2,3\n4,5,6\n';

writeFileSync(resolve(DIR, 'Connections.csv'), connections, 'utf8');
writeFileSync(resolve(DIR, 'Invitations.csv'), invitations, 'utf8');
writeFileSync(resolve(DIR, 'NotALinkedInExport.csv'), wrong, 'utf8');

console.log(`Wrote fixtures to ${DIR}`);
console.log(`  Connections.csv  ${N_CONN} rows, 4-line preamble`);
console.log(`  Invitations.csv  ${N_INV} rows`);
console.log(`  NotALinkedInExport.csv  (should be rejected)`);
