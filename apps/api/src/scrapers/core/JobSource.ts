import type { RawJob } from '@job-hunter/shared';

export type SourceSearchQuery = {
  query: string;
  location?: string | null;
};

export interface JobSource {
  id: string;
  name: string;
  search(query: SourceSearchQuery): Promise<RawJob[]>;
  getJob?(url: string): Promise<RawJob | null>;
  test(): Promise<{ ok: boolean; message: string; sampleCount?: number }>;
}

export class SourceError extends Error {
  constructor(
    public sourceId: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}
