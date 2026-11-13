/* ==========================================================================
   lib/security.js - password hashing and login tokens
   --------------------------------------------------------------------------
   Uses the Web Crypto API (globalThis.crypto), which exists both in Node.js
   20+ and in browsers, so the same code runs on the server and in the page.

   Passwords: PBKDF2 with SHA-256, 100,000 rounds and a random 16-byte salt.
   Stored as  "pbkdf2$<rounds>$<salt hex>$<hash hex>"; the password itself is
   never stored. In Lab 3 the hash was made in the browser; now only the API
   sees passwords.
   ========================================================================== */

const ROUNDS = 100000;
const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));

async function derive(password, salt, rounds) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, 256);
  return hex(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ROUNDS}$${hex(salt)}$${await derive(password, salt, ROUNDS)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, rounds, salt, hash] = String(stored).split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const check = await derive(password, unhex(salt), Number(rounds));
  // compare every character so the time taken does not reveal how much matched
  let diff = check.length ^ hash.length;
  for (let i = 0; i < check.length; i++) diff |= check.charCodeAt(i) ^ hash.charCodeAt(i % hash.length);
  return diff === 0;
}

/** A random, unguessable id for login tokens and carts. */
export const randomId = () => crypto.randomUUID();
