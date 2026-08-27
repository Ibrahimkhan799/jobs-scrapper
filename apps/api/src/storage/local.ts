import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env.js';

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  pathFor(key: string): string;
}

export class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root = env.UPLOAD_DIR) {}

  pathFor(key: string): string {
    const normalized = key.replace(/^\/+/, '').replace(/\.\./g, '');
    return path.resolve(this.root, normalized);
  }

  async put(key: string, data: Buffer): Promise<{ key: string }> {
    const full = this.pathFor(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch(() => undefined);
  }
}

export const storage: StorageProvider = new LocalDiskStorage();
