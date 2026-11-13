// Lab 8 - NestJS backend for the Lab 3 "Kashi Ghar" e-commerce store
// Abdul Raheem · 241854 · BSCS-V-A
//
//   npm start   -> http://localhost:3000/store/   the store (a copy of Lab 3, in ../frontend)
//                  http://localhost:3000/docs     Swagger documentation of every endpoint
//                  http://localhost:3000/api      list of endpoints as JSON

import "reflect-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { validationPipe } from "./common/validation.js";
import { apiIndex } from "./health/health.controller.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "..", "..", "frontend");
const PORT = Number(process.env.PORT) || 3000;

export async function createApp() {
  const quiet = Boolean(process.env.QUIET);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: quiet ? ["error"] : ["log", "warn", "error"] });

  app.enableCors({ exposedHeaders: ["Location"] });
  app.useGlobalPipes(validationPipe);                 // every body and query is checked against its DTO
  app.useGlobalFilters(new ApiExceptionFilter());     // every error leaves as { statusCode, error, details }
  app.useStaticAssets(FRONTEND, { prefix: "/store" }); // the store pages

  if (!quiet) {
    // one line per request, like the Lab 7 servers
    app.use((req: Request, res: Response, next: NextFunction) => {
      const started = Date.now();
      res.on("finish", () => {
        if (req.originalUrl.startsWith("/api") || req.originalUrl === "/health") {
          console.log(`${req.method.padEnd(6)} ${req.originalUrl.slice(0, 60).padEnd(60)} ${res.statusCode}  ${Date.now() - started} ms`);
        }
      });
      next();
    });
  }

  const config = new DocumentBuilder()
    .setTitle("Kashi Ghar store API")
    .setDescription("NestJS backend for the Lab 3 e-commerce store (Lab 8, Abdul Raheem 241854). Log in with POST /api/auth/login " +
      "(demo@kashighar.pk / demo1234, or admin@kashighar.pk / admin1234), then press Authorize and paste the token.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  apiIndex.endpoints = Object.entries(document.paths).flatMap(([p, ops]) =>
    Object.entries(ops as Record<string, { summary?: string }>).map(([method, op]) => ({ method: method.toUpperCase(), path: p, summary: op.summary || "" })));

  return { app, document };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app } = await createApp();
  await app.listen(PORT);
  console.log(`\nKashi Ghar NestJS backend running on http://localhost:${PORT}`);
  console.log(`Store:  http://localhost:${PORT}/store/`);
  console.log(`Docs:   http://localhost:${PORT}/docs`);
  console.log(`API:    http://localhost:${PORT}/api\n`);
}
