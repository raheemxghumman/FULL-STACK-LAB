import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "./types.js";
import { PRODUCTS, RATING_BASE, SEED_REVIEWS, SEED_USERS } from "./seed.js";
import { hashPassword } from "../common/security.js";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Keeps the whole store in data/db.json, so nothing is lost when the server restarts.
 *
 * The file is read once when the app starts (onModuleInit). Every service that changes data
 * calls save(), which writes to a temporary file and renames it over db.json. A rename is
 * atomic, so a crash in the middle can never leave a half-written database.
 * Node runs one piece of JavaScript at a time and services change the data synchronously,
 * so two requests can never overwrite each other's changes.
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger("Database");
  readonly file = process.env.DB_FILE || path.join(BACKEND_ROOT, "data", "db.json");
  data: Database;

  async onModuleInit() {
    if (fs.existsSync(this.file)) {
      this.data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.logger.log(`Loaded ${this.data.products.length} products, ${this.data.users.length} users, ${this.data.orders.length} orders from ${this.label}`);
    } else {
      this.data = await this.seed();
      this.save();
      this.logger.log(`Created ${this.label} from the seed data`);
    }
  }

  get label() {
    return `${path.basename(path.dirname(this.file))}/${path.basename(this.file)}`;
  }

  save() {
    this.data.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2));
    fs.renameSync(temp, this.file);
  }

  private async seed(): Promise<Database> {
    const now = new Date().toISOString();
    const users = [];
    for (const [i, { password, ...user }] of SEED_USERS.entries()) {
      users.push({ id: `u${i + 1}`, ...user, role: user.role as "customer" | "admin", passHash: await hashPassword(password) });
    }
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      counters: { product: PRODUCTS.length, user: users.length, review: 0 },
      products: PRODUCTS.map((p) => ({ ...p, oldPrice: p.oldPrice ?? null, created: now, updated: now })),
      users,
      sessions: [],
      carts: [],
      orders: [],
      reviews: SEED_REVIEWS.map((r) => ({ ...r, created: Date.parse(r.date) })),
      ratingBase: { ...RATING_BASE }
    };
  }
}
