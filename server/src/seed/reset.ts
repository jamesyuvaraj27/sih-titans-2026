/**
 * Drop and recreate the schema, then install pgvector.
 *
 * This exists because `prisma db push --force-reset` drops the schema *including*
 * the `vector` extension, and then immediately tries to create `vector(64)`
 * columns — which fails with `type "vector" does not exist`. Order matters:
 * drop → create extension → push.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const run = async () => {
  process.stdout.write('› dropping schema … ');
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  console.log('ok');
  process.stdout.write('› installing pgvector … ');
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  console.log('ok');
};

run()
  .catch((e) => {
    console.error('\nReset failed. Is PostgreSQL running and DATABASE_URL correct?\n', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
