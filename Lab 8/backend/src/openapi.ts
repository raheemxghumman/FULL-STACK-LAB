// npm run openapi: writes the OpenAPI (Swagger) document of every endpoint to ../docs/openapi.json.
// The preview page on GitHub Pages (Lab 8/docs/) shows it with Swagger UI.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.QUIET = "1";
process.env.DB_FILE = path.join(os.tmpdir(), `kashi-openapi-${process.pid}.json`);   // never touches data/db.json
const { createApp } = await import("./main.js");
const { app, document } = await createApp();
await app.init();
// "Try it out" on the preview page sends requests to a backend running on the visitor's computer
document.servers = [{ url: "http://localhost:3000", description: "The NestJS backend on your computer (npm start in Lab 8/backend)" }];
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "openapi.json");
fs.writeFileSync(out, JSON.stringify(document, null, 2));
await app.close();
fs.rmSync(process.env.DB_FILE, { force: true });
console.log(`Wrote ${Object.keys(document.paths).length} paths to ${out}`);
