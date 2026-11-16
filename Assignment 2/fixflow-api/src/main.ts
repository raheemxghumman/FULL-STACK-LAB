import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // `node dist/main --export-openapi <file>` writes the OpenAPI document and exits (npm run openapi)
  const exportIndex = process.argv.indexOf('--export-openapi');
  const app = await NestFactory.create(AppModule, exportIndex > -1 ? { logger: ['error'] } : undefined);
  const document = configureApp(app);

  if (exportIndex > -1) {
    const file = resolve(process.argv[exportIndex + 1] ?? 'openapi.json');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(document, null, 2));
    console.log(`OpenAPI document written to ${file}`);
    await app.close();
    return;
  }

  const port = app.get(ConfigService).get<number>('PORT') ?? 3000;
  await app.listen(port);
  new Logger('FixFlow').log(`API running on http://localhost:${port}/api   (Swagger: http://localhost:${port}/api/docs)`);
}

void bootstrap();
