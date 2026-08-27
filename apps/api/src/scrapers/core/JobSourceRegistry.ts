import type { JobSource } from './JobSource.js';

export class JobSourceRegistry {
  private readonly sources = new Map<string, JobSource>();

  register(source: JobSource): void {
    this.sources.set(source.id, source);
  }

  get(id: string): JobSource | undefined {
    return this.sources.get(id);
  }

  list(): JobSource[] {
    return [...this.sources.values()];
  }
}

export const sourceRegistry = new JobSourceRegistry();
