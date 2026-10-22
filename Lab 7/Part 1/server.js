// Lab 7 · Part 1 - Student Management System (in-memory API)
// Abdul Raheem · 241854 · BSCS-V-A
//
// Modified from the uploaded file "Step 21: Inspect method and URL to choose a route".
// What stayed the same:  node:http server, new URL(req.url, ...), the reply() helper,
//                        GET /health, GET /hello?name=..., 404 { error: 'Route not found' }, port 3002.
// What was added:        Student, Teacher, Attendance and Marks modules with full CRUD
//                        (GET, POST, PUT, PATCH, DELETE), JSON body parsing, validation,
//                        CORS, and the test UI served at http://localhost:3002/.
// The routes themselves live in lib/router.js so the test UI can run the same code in the
// browser when this server is not running (for example on GitHub Pages).

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./lib/router.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3002;
const MAX_BODY = 1024 * 1024;   // 1 MB is far more than any record needs

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Location"
};

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

// Reads the request body as text. Rejects with 413 when it is too large.
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

// Serves the test UI (public/) and the shared modules it imports (lib/). Nothing else on disk is reachable.
async function serveStatic(url, res) {
  const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  const insideAllowed = ["public", "lib"].some((dir) => file.startsWith(path.join(ROOT, dir) + path.sep));
  if (!insideAllowed) return false;
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

export function createServer(api = createApi()) {
  return http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");
    const reply = (code, body, headers = {}) => {
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...CORS, ...headers });
      res.end(body === null || body === undefined ? undefined : JSON.stringify(body)); // why are we stringifying the JSON?
      if (!process.env.QUIET) console.log(`${req.method.padEnd(6)} ${(url.pathname + url.search).padEnd(42)} ${code}  ${Date.now() - started} ms`);
    };
    // Answer to the question above (from the original file):
    // res.end() does not accept ordinary JavaScript objects as the response body. It expects a string,
    // a Buffer or a Uint8Array, so the object is turned into JSON text first and parsed back by the client.

    // Browser preflight for cross-origin PUT/PATCH/DELETE and JSON bodies
    if (req.method === "OPTIONS") {
      return reply(204, null, { "Access-Control-Allow-Private-Network": "true", "Access-Control-Max-Age": "600" });
    }

    // The test UI
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/public")) return reply(302, null, { Location: "/public/" });
    if (req.method === "GET" && (url.pathname.startsWith("/public/") || url.pathname.startsWith("/lib/"))) {
      if (await serveStatic(url, res)) return;
    }

    // Everything else is the API
    let body;
    try {
      body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : undefined;
    } catch (err) {
      return reply(err.status || 400, { error: err.message });
    }
    const result = api.handle({ method: req.method, url: req.url, headers: req.headers, body });
    return reply(result.status, result.body, result.headers);
  });
}

// `npm start` (or `node server.js`) runs the server; the tests import createServer() instead.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => {
    console.log(`Student Management API running on http://localhost:${PORT}`);
    console.log(`Test UI:  http://localhost:${PORT}/      Endpoints:  http://localhost:${PORT}/api`);
    console.log(`Try http://localhost:${PORT}/hello?name=Ali\n`);
  });
}
