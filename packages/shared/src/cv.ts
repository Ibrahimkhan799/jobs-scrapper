export function cleanCvText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/;
const YEARS_RE = /(\d+)\s*\+?\s*(?:years?|yrs?)/i;

export function extractContactFromText(text: string): {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  fullName: string | null;
  yearsOfExperience: number | null;
} {
  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;
  const phone = text.match(PHONE_RE)?.[0] ?? null;
  const linkedinUrl = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] ?? null;
  const githubUrl = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i)?.[0] ?? null;
  const portfolioUrl =
    text.match(/https?:\/\/(?:www\.)?(?!linkedin|github)[a-z0-9.-]+\.[a-z]{2,}[^\s)]*/i)?.[0] ??
    null;
  const yearsMatch = text.match(YEARS_RE);
  const yearsOfExperience = yearsMatch ? Number.parseInt(yearsMatch[1], 10) : null;

  const firstLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  let fullName: string | null = null;
  for (const line of firstLines) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || /http/i.test(line)) continue;
    if (/^(resume|curriculum|cv|profile)\b/i.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z.'-]+$/.test(w))) {
      fullName = line;
      break;
    }
  }

  return {
    email,
    phone,
    linkedinUrl,
    githubUrl,
    portfolioUrl,
    fullName,
    yearsOfExperience,
  };
}
