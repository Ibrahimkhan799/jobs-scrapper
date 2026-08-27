export type ParsedSalary = {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: 'year' | 'month' | 'hour' | 'day' | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  aed: 'AED',
  sar: 'SAR',
  qar: 'QAR',
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  cad: 'CAD',
  aud: 'AUD',
};

export function parseSalary(raw: string | null | undefined): ParsedSalary {
  if (!raw || !raw.trim()) {
    return { min: null, max: null, currency: null, period: null };
  }

  const text = raw.replace(/,/g, '').replace(/\u00a0/g, ' ').trim();
  const lower = text.toLowerCase();

  let currency: string | null = null;
  for (const [token, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (lower.includes(token) || text.includes(token)) {
      currency = code;
      break;
    }
  }

  let period: ParsedSalary['period'] = 'year';
  if (/\b(hour|hourly|\/hr|per hour)\b/i.test(text)) period = 'hour';
  else if (/\b(day|daily|\/day|per day)\b/i.test(text)) period = 'day';
  else if (/\b(month|monthly|\/mo|per month|pcm)\b/i.test(text)) period = 'month';
  else if (/\b(year|yearly|annual|annum|p\.?a\.?|\/yr)\b/i.test(text)) period = 'year';

  const numbers = [...text.matchAll(/(\d+(?:\.\d+)?)(\s*[kK])?/g)].map((match) => {
    const value = Number.parseFloat(match[1]);
    const hasK = Boolean(match[2]);
    return hasK ? Math.round(value * 1000) : Math.round(value);
  });

  const meaningful = numbers.filter((n) => n >= 8); // drop stray small numbers
  if (meaningful.length === 0) {
    return { min: null, max: null, currency, period };
  }

  let min: number | null = meaningful[0] ?? null;
  let max: number | null = meaningful.length > 1 ? (meaningful[1] ?? null) : null;

  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
  }

  if (/up to|upto|max(imum)?/i.test(text) && meaningful.length === 1) {
    max = meaningful[0];
    min = null;
  }
  if (/\bfrom\b|\bstarting\b|\bmin(imum)?\b/i.test(text) && meaningful.length === 1) {
    min = meaningful[0];
    max = null;
  }

  return {
    min: toAnnual(min, period),
    max: toAnnual(max, period),
    currency,
    period,
  };
}

function toAnnual(value: number | null, period: ParsedSalary['period']): number | null {
  if (value === null) return null;
  switch (period) {
    case 'hour':
      return Math.round(value * 40 * 52);
    case 'day':
      return Math.round(value * 5 * 52);
    case 'month':
      return Math.round(value * 12);
    default:
      return value;
  }
}

export function salaryOverlapScore(
  candidateMin: number | null | undefined,
  candidateMax: number | null | undefined,
  jobMin: number | null | undefined,
  jobMax: number | null | undefined,
): number {
  if (
    (candidateMin == null && candidateMax == null) ||
    (jobMin == null && jobMax == null)
  ) {
    return 70;
  }

  const cMin = candidateMin ?? 0;
  const cMax = candidateMax ?? candidateMin ?? Number.POSITIVE_INFINITY;
  const jMin = jobMin ?? 0;
  const jMax = jobMax ?? jobMin ?? Number.POSITIVE_INFINITY;

  const overlapStart = Math.max(cMin, jMin);
  const overlapEnd = Math.min(cMax, jMax);
  if (overlapEnd >= overlapStart) return 100;

  const gap = overlapStart - overlapEnd;
  const scale = Math.max(cMax, jMax, 1);
  const penalty = Math.min(80, (gap / scale) * 100);
  return Math.max(20, Math.round(100 - penalty));
}
