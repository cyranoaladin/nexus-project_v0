import { PrismaClient } from '@prisma/client';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Force an absolute SQLite path at runtime to avoid relative path issues in standalone mode
// If DATABASE_URL is a file: URL and relative, resolve it against process.cwd()
let datasourceUrl = process.env.DATABASE_URL;
if (datasourceUrl && datasourceUrl.startsWith('file:')) {
  // Extract path after 'file:' and resolve when needed
  const raw = datasourceUrl.replace(/^file:/, '');
  const isAbsolute = raw.startsWith('/');
  const resolved = isAbsolute ? raw : path.resolve(process.cwd(), raw);
  datasourceUrl = `file:${resolved}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    datasourceUrl
      ? {
        datasources: {
          db: { url: datasourceUrl },
        },
      }
      : undefined
  );

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
