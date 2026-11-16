/**
 * npm run test:postman      (start a FRESH API first: npm start)
 *
 * Runs the Postman collection with Newman against the running API. It first creates the
 * `expiredToken` variable (signed with your JWT_SECRET, already expired), so the expired-token
 * checks work without pasting anything. Results are printed and saved to newman/report.json.
 */
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { mkdirSync } from 'node:fs';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const newman = require('newman');

async function main() {
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const expiredToken = ctx.get(JwtService).sign({ sub: 2, role: 'REQUESTER', email: 'ali@fixflow.test' }, { expiresIn: -60 });
  await ctx.close();
  mkdirSync('newman', { recursive: true });

  newman.run(
    {
      collection: require('../postman/FixFlow.postman_collection.json'),
      environment: require('../postman/FixFlow.postman_environment.json'),
      envVar: [
        { key: 'expiredToken', value: expiredToken },
        ...(process.env.BASE_URL ? [{ key: 'baseUrl', value: process.env.BASE_URL }] : []),
      ],
      reporters: ['cli', 'json'],
      reporter: { json: { export: 'newman/report.json' } },
    },
    (err: Error | null, summary: { run: { failures: unknown[] } }) => {
      if (err) throw err;
      process.exitCode = summary.run.failures.length ? 1 : 0;
    },
  );
}

void main();
