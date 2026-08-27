import type { RemoteType } from './constants.js';

const LOCATION_ALIASES: Record<string, string> = {
  remote: 'Remote',
  worldwide: 'Remote',
  'work from home': 'Remote',
  wfh: 'Remote',
  anywhere: 'Remote',
  dubai: 'Dubai',
  dxb: 'Dubai',
  'dubai uae': 'Dubai',
  'united arab emirates': 'UAE',
  uae: 'UAE',
  riyadh: 'Riyadh',
  'riyadh saudi arabia': 'Riyadh',
  'saudi arabia': 'Saudi Arabia',
  ksa: 'Saudi Arabia',
  doha: 'Doha',
  qatar: 'Qatar',
  'abu dhabi': 'Abu Dhabi',
  'abu-dhabi': 'Abu Dhabi',
  london: 'London',
  'united kingdom': 'United Kingdom',
  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  'new york': 'New York',
  nyc: 'New York',
  sf: 'San Francisco',
  'san francisco': 'San Francisco',
  'bay area': 'San Francisco',
  berlin: 'Berlin',
  germany: 'Germany',
  amsterdam: 'Amsterdam',
  netherlands: 'Netherlands',
  singapore: 'Singapore',
  toronto: 'Toronto',
  canada: 'Canada',
  austin: 'Austin',
  seattle: 'Seattle',
  'los angeles': 'Los Angeles',
  la: 'Los Angeles',
};

export function normalizeLocation(raw: string | null | undefined): string {
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!key) return '';
  if (LOCATION_ALIASES[key]) return LOCATION_ALIASES[key];

  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (key.includes(alias)) return canonical;
  }

  return key
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(', ');
}

export function inferRemoteType(
  location: string | null | undefined,
  extras: string[] = [],
): RemoteType {
  const haystack = [location, ...extras].filter(Boolean).join(' ').toLowerCase();
  const hasRemote = /\bremote\b|\bworldwide\b|\bwork from home\b|\bwfh\b/.test(haystack);
  const hasHybrid = /\bhybrid\b/.test(haystack);
  const hasOnsite = /\bon[- ]?site\b|\bin[- ]?office\b|\boffice[- ]based\b/.test(haystack);

  if (hasRemote && hasOnsite) return 'HYBRID';
  if (hasHybrid) return 'HYBRID';
  if (hasRemote) return 'REMOTE';
  if (hasOnsite) return 'ONSITE';
  if (location && !hasRemote) return 'ONSITE';
  return 'ANY';
}

export function locationMatchScore(input: {
  candidateLocations: string[];
  candidateRemote: RemoteType;
  jobLocation: string | null | undefined;
  jobRemote: RemoteType;
}): number {
  const { candidateLocations, candidateRemote, jobLocation, jobRemote } = input;
  const jobLoc = normalizeLocation(jobLocation);
  const candidateLocs = candidateLocations.map(normalizeLocation).filter(Boolean);

  if (candidateRemote === 'REMOTE' && (jobRemote === 'REMOTE' || jobRemote === 'HYBRID')) {
    return 100;
  }
  if (candidateRemote === 'ANY' && jobRemote === 'REMOTE') {
    return 95;
  }
  if (jobRemote === 'REMOTE' && candidateRemote !== 'ONSITE') {
    return 90;
  }

  const locationHit = candidateLocs.some((loc) => {
    if (!jobLoc || !loc) return false;
    return jobLoc.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobLoc.toLowerCase());
  });

  if (locationHit) {
    if (candidateRemote === 'ONSITE' && jobRemote === 'REMOTE') return 70;
    return 100;
  }

  if (candidateRemote === 'HYBRID' && jobRemote === 'HYBRID') return 80;
  if (candidateRemote === 'ONSITE' && jobRemote === 'ONSITE') return 40;
  if (candidateRemote === 'ANY') return 55;
  return 25;
}
