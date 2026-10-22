/* ==========================================================================
   lib/db.js - the in-memory "database"
   --------------------------------------------------------------------------
   Each module is a Collection: a Map from id to record plus a counter for the
   next id. Nothing is written to disk, so all changes are lost when the
   server stops (or, in the browser, when the page reloads). That is what
   makes this an in-memory API. Part 2 of the lab replaces it with storage
   that persists.
   ========================================================================== */

export class Collection {
  constructor(name) {
    this.name = name;
    this.rows = new Map();
    this.nextId = 1;
  }

  all() {
    return [...this.rows.values()];
  }

  get(id) {
    return this.rows.get(id) ?? null;
  }

  insert(data) {
    const now = new Date().toISOString();
    const record = { id: this.nextId++, ...data, createdAt: now, updatedAt: now };
    this.rows.set(record.id, record);
    return record;
  }

  update(id, data) {
    const old = this.rows.get(id);
    const record = { ...old, ...data, id, createdAt: old.createdAt, updatedAt: new Date().toISOString() };
    this.rows.set(id, record);
    return record;
  }

  remove(id) {
    const record = this.rows.get(id);
    this.rows.delete(id);
    return record;
  }

  /** Deletes every record matching the test and returns how many were deleted. */
  removeWhere(test) {
    let count = 0;
    for (const [id, record] of this.rows) {
      if (test(record)) { this.rows.delete(id); count++; }
    }
    return count;
  }

  get size() {
    return this.rows.size;
  }
}

/** Creates the four collections and, optionally, fills them with seed data. */
export function createDatabase(seed) {
  const db = {
    students: new Collection("students"),
    teachers: new Collection("teachers"),
    attendance: new Collection("attendance"),
    marks: new Collection("marks")
  };
  if (seed) {
    for (const name of Object.keys(db)) seed[name].forEach((row) => db[name].insert(row));
  }
  return db;
}

export const counts = (db) => Object.fromEntries(Object.entries(db).map(([name, c]) => [name, c.size]));
