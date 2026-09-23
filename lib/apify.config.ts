/**
 * Everything about the enrichment actor lives here, so swapping actors is a
 * one-file edit.
 *
 * NOT YET SELECTED. Choosing an actor means reading its input schema, its
 * pricing and its actual output against real profile URLs. That needs the Apify
 * connector and a token, neither of which existed when this was built, and
 * guessing at a schema would produce a route that fails at the worst moment.
 *
 * To wire it up:
 *   1. Pick an actor that takes a list of profile URLs, needs no LinkedIn
 *      cookies, and returns at least photo, headline, location and current
 *      company. Company size, industry and last activity are the bonus that
 *      makes the post-enrichment questions worth asking.
 *   2. Put its id in ACTOR_ID and map its output in `mapItem` below.
 *   3. Set APIFY_TOKEN in Vercel.
 * Until then /api/enrich returns "not configured" and the Import JSON drop zone
 * is the working path.
 */

export const ACTOR_ID = '' as string;

/** A cheaper company-level actor, run only for distinct Tier 1 companies whose
 *  size the profile actor left blank. Also unselected. */
export const COMPANY_ACTOR_ID = '' as string;

export const URLS_PER_RUN = 100;

/** What the app needs back, whatever the actor calls its own fields. */
export type EnrichedProfile = {
  profileUrl: string;
  photo?: string;
  headline?: string;
  location?: string;
  country?: string;
  current_company?: string;
  company_size?: string;
  industry?: string;
  last_activity?: string;
  follower_count?: number;
};

/** Fill this in when an actor is chosen. Imported JSON goes through it too, so
 *  the import path and the live path produce identical shapes. */
export function mapItem(item: Record<string, unknown>): EnrichedProfile {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = item[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  };
  return {
    profileUrl: pick('profileUrl', 'url', 'linkedinUrl', 'publicProfileUrl') ?? '',
    photo: pick('photo', 'profilePic', 'profilePicture', 'pictureUrl'),
    headline: pick('headline', 'occupation', 'title'),
    location: pick('location', 'locationName', 'geoLocationName', 'addressWithCountry'),
    country: pick('country', 'countryCode', 'addressCountryOnly'),
    current_company: pick('companyName', 'company', 'currentCompany'),
    company_size: pick('companySize', 'employeeCount', 'companyEmployeeCount'),
    industry: pick('industry', 'companyIndustry'),
    last_activity: pick('lastActivity', 'lastPostDate', 'latestActivityDate'),
    follower_count:
      typeof item.followers === 'number'
        ? item.followers
        : typeof item.followerCount === 'number'
          ? item.followerCount
          : undefined,
  };
}

export function isConfigured(): boolean {
  return ACTOR_ID.trim() !== '' && (process.env.APIFY_TOKEN ?? '').trim() !== '';
}
