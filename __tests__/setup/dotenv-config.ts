import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Override DB for Jest to use host-mapped Postgres instead of Docker service name
if (!process.env.DATABASE_URL || /@db:5432\//.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = process.env.JEST_DB_URL || 'postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public';
}
// Flag this run as unit-style env for tests to adapt when necessary
process.env.JEST_ENV = process.env.JEST_ENV || 'unit';
