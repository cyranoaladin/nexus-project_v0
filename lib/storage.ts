import fs from "fs/promises";
import path from "path";

export interface StorageProvider {
  put(localPath: string, destKey: string): Promise<string>;
}

export class LocalStorage implements StorageProvider {
  constructor(private baseDir = "storage/reports") {}

  async put(localPath: string, destKey: string): Promise<string> {
    const outPath = path.join(this.baseDir, destKey);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.copyFile(localPath, outPath);
    // Retourne un chemin public relatif pour l'accès via le serveur web.
    // Nécessite une configuration pour servir statiquement le dossier 'storage'.
    return `/files/${destKey}`;
  }
}

// TODO: Implémenter S3Storage pour la production
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// export class S3Storage implements StorageProvider {
//   // ...
// }
