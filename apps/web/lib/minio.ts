import { Client as MinioClient } from 'minio';

type MinioConfig = {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
};

function readConfig(): MinioConfig {
  const endPoint = process.env.MINIO_ENDPOINT || 'minio';
  const port = Number(process.env.MINIO_PORT || 9000);
  const useSSL = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
  const bucket = process.env.MINIO_BUCKET || 'nexus-docs';
  return { endPoint, port, useSSL, accessKey, secretKey, bucket };
}

let cachedClient: MinioClient | undefined;
let cachedBucket: string | undefined;

export function getMinioClient(): { client: MinioClient; bucket: string; } {
  if (cachedClient && cachedBucket) return { client: cachedClient, bucket: cachedBucket };
  const cfg = readConfig();
  const client = new MinioClient({
    endPoint: cfg.endPoint,
    port: cfg.port,
    useSSL: cfg.useSSL,
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
  });
  cachedClient = client;
  cachedBucket = cfg.bucket;
  return { client, bucket: cfg.bucket };
}

export async function ensureBucketExists(): Promise<void> {
  const { client, bucket } = getMinioClient();
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');
  }
}

export async function putObjectFromFile(localPath: string, destKey: string): Promise<string> {
  const { client, bucket } = getMinioClient();
  await ensureBucketExists();
  await client.fPutObject(bucket, destKey, localPath);
  // Return a simple canonical URL; adjust policy/signed URLs later if needed
  const endpoint = process.env.MINIO_PUBLIC_ENDPOINT || (process.env.MINIO_USE_SSL === 'true' ? `https://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}` : `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}`);
  return `${endpoint}/${bucket}/${destKey}`;
}
