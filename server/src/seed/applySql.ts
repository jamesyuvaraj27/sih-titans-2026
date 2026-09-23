/**
 * Apply the raw SQL in `sql/` — the append-only trigger and the scoring engine.
 *
 * Prisma's $executeRawUnsafe sends one statement at a time (it uses the extended
 * query protocol), so the files have to be split. Splitting on ';' naively would
 * cut every plpgsql function in half, because their bodies are full of
 * semicolons — hence the dollar-quote tracker below.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/db.js';

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sql');

/** Split on top-level semicolons, ignoring anything inside $tag$ … $tag$. */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let dollarTag: string | null = null;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i]!;

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }

    // line comment
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // dollar-quoted string: $$ or $tag$
    if (ch === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.replace(/--.*$/gm, '').trim().length > 0);
}

const run = async () => {
  for (const file of readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort()) {
    const statements = splitStatements(readFileSync(join(sqlDir, file), 'utf8'));
    process.stdout.write(`› ${file} (${statements.length} statements) … `);
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (e: any) {
        console.log('failed');
        console.error(`\nStatement that failed in ${file}:\n${stmt.slice(0, 400)}\n`);
        throw e;
      }
    }
    console.log('ok');
  }
};

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
