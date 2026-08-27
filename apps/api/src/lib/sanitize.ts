import sanitizeHtml from 'sanitize-html';

export function sanitizeJobHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'b',
      'i',
      'h2',
      'h3',
      'h4',
      'a',
      'blockquote',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
  });
}

export function safeFileName(original: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() ?? 'upload';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload';
}

export const ALLOWED_RESUME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function assertResumeType(mimeType: string, fileName: string): void {
  const lower = fileName.toLowerCase();
  const allowedExt = lower.endsWith('.pdf') || lower.endsWith('.docx');
  if (!ALLOWED_RESUME_TYPES.has(mimeType) && !allowedExt) {
    throw new Error('Only PDF and DOCX resumes are accepted');
  }
}
