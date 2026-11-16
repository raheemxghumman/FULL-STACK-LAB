/**
 * npm run token:expired
 * Prints an access token that is correctly signed with JWT_SECRET from your .env but expired a
 * minute ago, for the Postman "expired token" checks (environment variable `expiredToken`).
 * It is not a usable credential: the API always answers 401 "Access token has expired".
 */
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const token = app.get(JwtService).sign({ sub: 2, role: 'REQUESTER', email: 'ali@fixflow.test' }, { expiresIn: -60 });
  process.stdout.write(token + '\n');
  await app.close();
}

void main();
