/* ==========================================================================
   scripts/serve.js - serves the UI locally (npm run ui -> http://localhost:5173)
   Browsers do not load ES modules from file://, so the page needs a server.
   Built with node:http only.
   ========================================================================== */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

export function startUiServer(port = 0) {
  const server = http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
    if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep) && file !== join(ROOT, "index.html")) {
      res.writeHead(403); return res.end("Forbidden");
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startUiServer(Number(process.env.PORT) || 5173);
  console.log(`Lab 6 UI running at ${url}`);
}
