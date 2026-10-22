// Lab 7 · Part 2 - Kashi Ghar store API (persistent)
// Abdul Raheem · 241854 · BSCS-V-A
//
// The Lab 3 e-commerce store kept everything in the browser's localStorage. This server gives it a
// real back end: the endpoints in lib/router.js own the products, accounts, carts, orders and reviews,
// and every change is saved to data/db.json, so nothing is lost when the server restarts.
//
//   npm start      -> http://localhost:3000        (the store, using the API)
//                     http://localhost:3000/api    (list of endpoints)
//
// Built the same way as Part 1: node:http, new URL(req.url, ...), and a reply() helper that
// JSON.stringify()s the body, because res.end() only accepts a string, Buffer or Uint8Array.

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStoreApi } from "./lib/router.js";
import { FileStorage } from "./lib/storage-file.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "Location"
};

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request body is larger than 1 MB."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Only the store pages and the shared lib/ modules are served. data/db.json (with password hashes) never is.
async function serveStatic(url, res) {
  const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!["store", "lib"].some((dir) => file.startsWith(path.join(ROOT, dir) + path.sep))) return false;
  const target = file.endsWith(path.sep) ? path.join(file, "index.html") : file;
  try {
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export function createServer({ dbFile = process.env.DB_FILE || path.join(ROOT, "data", "db.json") } = {}) {
  const storage = new FileStorage(dbFile);
  const api = createStoreApi({ storage });

  return http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");
    const reply = (code, body, headers = {}) => {
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...CORS, ...headers });
      res.end(body === null || body === undefined ? undefined : JSON.stringify(body));
      if (!process.env.QUIET) console.log(`${req.method.padEnd(6)} ${(url.pathname + url.search).slice(0, 60).padEnd(60)} ${code}  ${Date.now() - started} ms`);
    };

    if (req.method === "OPTIONS") {
      return reply(204, null, { "Access-Control-Allow-Private-Network": "true", "Access-Control-Max-Age": "600" });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/store")) return reply(302, null, { Location: "/store/" });
    if (req.method === "GET" && (url.pathname.startsWith("/store/") || url.pathname.startsWith("/lib/"))) {
      if (await serveStatic(url, res)) return;
    }

    let body;
    try {
      body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : undefined;
    } catch (err) {
      return reply(err.status || 400, { error: err.message });
    }
    const result = await api.handle({ method: req.method, url: req.url, headers: req.headers, body });
    return reply(result.status, result.body, result.headers);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => {
    console.log(`Kashi Ghar API running on http://localhost:${PORT}`);
    console.log(`Store:      http://localhost:${PORT}/store/`);
    console.log(`Endpoints:  http://localhost:${PORT}/api`);
    console.log(`Data file:  data/db.json (created from the seed on the first request)\n`);
  });
}
