import type { RemoteType } from './constants.js';

export type SearchProfileInput = {
  targetTitles: string[];
  targetLocations: string[];
  remotePreference: RemoteType;
};

export type GeneratedQuery = {
  query: string;
  location: string | null;
};

const MAX_QUERIES = 12;

export function generateSearchQueries(profile: SearchProfileInput): GeneratedQuery[] {
  const titles = uniqueKeepOrder(profile.targetTitles.map((t) => t.trim()).filter(Boolean)).slice(
    0,
    4,
  );
  const locations = uniqueKeepOrder(
    profile.targetLocations.map((l) => l.trim()).filter(Boolean),
  ).slice(0, 5);

  const queries: GeneratedQuery[] = [];
  const seen = new Set<string>();

  const push = (query: string, location: string | null) => {
    const key = `${query.toLowerCase()}::${(location ?? '').toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ query, location });
  };

  if (titles.length === 0) return [];

  const includeRemote =
    profile.remotePreference === 'REMOTE' ||
    profile.remotePreference === 'ANY' ||
    profile.remotePreference === 'HYBRID' ||
    locations.some((loc) => loc.toLowerCase() === 'remote');

  for (const title of titles) {
    if (includeRemote) push(`${title} remote`, 'Remote');
    for (const location of locations) {
      if (location.toLowerCase() === 'remote') continue;
      push(`${title} ${location}`, location);
    }
  }

  return queries.slice(0, MAX_QUERIES);
}

function uniqueKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}
