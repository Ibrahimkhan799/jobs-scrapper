export function canonicalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
    const drop = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'gh_src',
      'lever-source',
    ]);
    [...url.searchParams.keys()].forEach((key) => {
      if (drop.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    });
    let pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    const search = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return raw.trim().replace(/\/+$/, '') || null;
  }
}

export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(demo\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function jobFingerprint(input: {
  company: string;
  title: string;
  location: string | null | undefined;
}): string {
  const company = companySlug(input.company);
  const title = input.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const location = (input.location ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${company}::${title}::${location}`;
}

export type DedupeInput = {
  sourceKey: string;
  sourceJobId: string;
  canonicalUrl: string | null;
  applicationUrl: string | null;
  fingerprint: string;
};

export type ExistingJobRef = {
  id: string;
  sourceKey: string;
  sourceJobId: string;
  canonicalUrl: string | null;
  applicationUrl: string | null;
  fingerprint: string;
};

export type DedupeResult =
  | { kind: 'new' }
  | { kind: 'existing'; jobId: string; strategy: DedupeStrategy };

export type DedupeStrategy =
  | 'sourceJobId'
  | 'applicationUrl'
  | 'canonicalUrl'
  | 'fingerprint';

export function findDuplicate(
  incoming: DedupeInput,
  existing: ExistingJobRef[],
): DedupeResult {
  const bySource = existing.find(
    (job) => job.sourceKey === incoming.sourceKey && job.sourceJobId === incoming.sourceJobId,
  );
  if (bySource) return { kind: 'existing', jobId: bySource.id, strategy: 'sourceJobId' };

  if (incoming.applicationUrl) {
    const byApply = existing.find(
      (job) => job.applicationUrl && job.applicationUrl === incoming.applicationUrl,
    );
    if (byApply) return { kind: 'existing', jobId: byApply.id, strategy: 'applicationUrl' };
  }

  if (incoming.canonicalUrl) {
    const byUrl = existing.find(
      (job) => job.canonicalUrl && job.canonicalUrl === incoming.canonicalUrl,
    );
    if (byUrl) return { kind: 'existing', jobId: byUrl.id, strategy: 'canonicalUrl' };
  }

  const byFingerprint = existing.find((job) => job.fingerprint === incoming.fingerprint);
  if (byFingerprint) {
    return { kind: 'existing', jobId: byFingerprint.id, strategy: 'fingerprint' };
  }

  return { kind: 'new' };
}
