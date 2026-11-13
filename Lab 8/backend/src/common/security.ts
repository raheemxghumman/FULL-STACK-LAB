/* Password hashing and random ids.
   Passwords are stored as "pbkdf2$<rounds>$<salt>$<hash>" (PBKDF2-SHA256, 100,000 rounds, random salt),
   never as plain text. Uses the Web Crypto API that Node.js provides as globalThis.crypto. */

const ROUNDS = 100000;
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array((s.match(/../g) || []).map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array, rounds: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: rounds }, key, 256);
  return hex(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ROUNDS}$${hex(salt)}$${await derive(password, salt, ROUNDS)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, rounds, salt, hash] = String(stored).split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const check = await derive(password, unhex(salt), Number(rounds));
  // compare every character, so the time taken does not reveal how much matched
  let diff = check.length ^ hash.length;
  for (let i = 0; i < check.length; i++) diff |= check.charCodeAt(i) ^ hash.charCodeAt(i % hash.length);
  return diff === 0;
}

export const randomId = () => crypto.randomUUID();

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const round1 = (n: number) => Math.round(n * 10) / 10;
