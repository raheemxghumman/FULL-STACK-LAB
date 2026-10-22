/* ==========================================================================
   lib/storage-browser.js - keeps the database in localStorage
   --------------------------------------------------------------------------
   Used only when the store is opened without the Node server, for example
   on GitHub Pages. The API code is the same; only where the database is
   saved changes. Data persists in this browser across reloads and restarts.
   ========================================================================== */

export class BrowserStorage {
  constructor(key = "kg_api_db") {
    this.key = key;
    this.kind = "browser localStorage";
  }

  read() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }

  write(db) {
    localStorage.setItem(this.key, JSON.stringify(db));
  }
}
