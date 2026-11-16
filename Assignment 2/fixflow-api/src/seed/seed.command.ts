/**
 * npm run seed
 * Writes the reproducible seed snapshot (demo accounts with bcrypt-hashed passwords, categories,
 * requests with their full history) to SEED_FILE (default data/seed.json). Every time the API
 * starts it loads this snapshot into the in-memory store, so restarting resets all data to it.
 */
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildSeedSnapshot, DEMO_ACCOUNTS } from './seed-data';

async function main() {
  const file = resolve(process.env.SEED_FILE || 'data/seed.json');
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  const snapshot = await buildSeedSnapshot((password) => hash(password, rounds));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(snapshot, null, 2));

  console.log(`Seed written to ${file}`);
  console.log(
    `  ${snapshot.users.length} users, ${snapshot.categories.length} categories, ${snapshot.requests.length} requests, ` +
      `${snapshot.history.length} history events, ${snapshot.assignments.length} assignments, ${snapshot.feedback.length} feedback\n`,
  );
  console.table(DEMO_ACCOUNTS.map((a) => ({ id: a.id, role: a.role, name: a.fullName, email: a.email, password: a.password })));
  console.log('Restart the API (npm start) to load it. Passwords are stored only as bcrypt hashes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
