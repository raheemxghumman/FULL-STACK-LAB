/* ==========================================================================
   lib/storage-file.js - keeps the database in a JSON file (Node.js only)
   --------------------------------------------------------------------------
   This is what makes the API persistent: every change is written to
   data/db.json, so products, accounts, carts, orders and reviews are still
   there after the server is stopped and started again.

   Writes go to a temporary file first and are then renamed over db.json.
   A rename is atomic, so a crash in the middle of a write can never leave
   a half-written database behind.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

export class FileStorage {
  constructor(file) {
    this.file = file;
    this.kind = `file (${path.basename(path.dirname(file))}/${path.basename(file)})`;
  }

  read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return null;          // first start: the API creates it from the seed
      throw new Error(`${this.file} could not be read (${err.message}). Delete it to start again with the seed data.`);
    }
  }

  write(db) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(db, null, 2));
    fs.renameSync(temp, this.file);
  }
}
