export interface StorageProvider { put(localPath: string, destKey: string): Promise<string>; }

export class LocalStorage implements StorageProvider {
  constructor(private baseDir = 'storage/reports') {}
  async put(localPath: string, destKey: string) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const outPath = path.join(this.baseDir, destKey);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.copyFile(localPath, outPath);
    return `/files/${destKey}`;
  }
}
