import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { cleanCvText } from '@job-hunter/shared';
import { badRequest } from '../lib/errors.js';

export async function extractResumeText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
    return cleanCvText(text);
  }
  if (
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('officedocument') ||
    lower.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return cleanCvText(result.value);
  }
  throw badRequest('Unsupported resume type. Upload a PDF or DOCX file.');
}
