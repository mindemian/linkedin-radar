import 'server-only';
import { NextResponse } from 'next/server';
import { ACTOR_ID, isConfigured } from '@/lib/apify.config';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Deliberately a stub. See lib/apify.config.ts for why and for the three steps
 * that turn it on. The Import JSON drop zone in the app does the same job by
 * hand in the meantime, and runs the imported data through the same mapper, so
 * nothing downstream changes when the live route is wired.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Enrichment is not configured on this deployment.',
      detail:
        ACTOR_ID.trim() === ''
          ? 'No Apify actor has been selected yet. Pick one, set ACTOR_ID in lib/apify.config.ts, and set APIFY_TOKEN in Vercel.'
          : 'APIFY_TOKEN is not set on this deployment.',
      workaround:
        'Use "Import enrichment JSON" on the Connections tab. Any JSON array of profile objects works; the app maps the usual field names itself.',
      configured: isConfigured(),
    },
    { status: 501 },
  );
}
