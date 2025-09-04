export interface StorageProvider { put(localPath: string, destKey: string): Promise<string>; }

export class LocalStorage implements StorageProvider {
  constructor(private baseDir = (process.env.RAG_STORAGE_DIR || 'storage/reports')) {}
  async put(localPath: string, destKey: string) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const outPath = path.join(this.baseDir, destKey);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.copyFile(localPath, outPath);
    // NOTE: Exposition web laissée au reverse proxy (Nginx/Traefik) ou à une route dédiée.
    // Ici, on retourne un chemin virtuel stable.
    return `/files/${destKey}`;
  }
}

export class MinioStorage implements StorageProvider {
  constructor(private bucketPrefix = 'uploads') {}
  async put(localPath: string, destKey: string) {
    // Use alias path so tests can mock this ESM module reliably
    const { putObjectFromFile } = await import('@/apps/web/lib/minio');
    const key = `${this.bucketPrefix}/${destKey}`.replace(/\/+/g, '/');
    return await putObjectFromFile(localPath, key);
  }
}

export function createStorageFromEnv(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider === 'minio') return new MinioStorage('reports');
  return new LocalStorage();
}
