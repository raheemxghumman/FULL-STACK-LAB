/* ==========================================================================
   Kashi Ghar — API client (new in Lab 7)
   Author: Abdulraheem · Full Stack Web Development Lab 7, Part 2
   --------------------------------------------------------------------------
   Every page loads this before app.js. It sends the store's requests to the
   Kashi Ghar API and returns { ok, status, data }.

     server   the page was opened from the Node server (npm start), so the
              requests are real HTTP requests and the data is saved in
              data/db.json on the server.
     browser  no API server answered (for example on GitHub Pages). The same
              API code (../../lib/router.js) is loaded into the page and saves
              its database in this browser's localStorage instead.

   Exposes one global: window.KGApi = { init, request, mode, storage }.
   ========================================================================== */
(function () {
  'use strict';

  let mode = null;
  let storage = '';
  let local = null;

  /* Finds out where the API is. Resolves with 'server' or 'browser'. */
  async function init() {
    if (location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/health', { cache: 'no-store' });
        const body = await res.json();
        if (body.service === 'kashi-ghar-api') {
          mode = 'server';
          storage = body.storage;
          return mode;
        }
      } catch (e) { /* not the Kashi Ghar server: use the in-page API */ }
    }
    const [{ createStoreApi }, { BrowserStorage }] = await Promise.all([
      import('../../lib/router.js'),
      import('../../lib/storage-browser.js')
    ]);
    local = createStoreApi({ storage: new BrowserStorage('kg_api_db') });
    mode = 'browser';
    storage = 'browser localStorage';
    return mode;
  }

  /* One request. body is an object (sent as JSON); token is the login token, if any. */
  async function request(method, path, body, token) {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const headers = {};
    if (raw !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;

    let status, data;
    if (mode === 'server') {
      try {
        const res = await fetch(path, { method, headers, body: raw });
        status = res.status;
        const text = await res.text();
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        status = 0;
        data = { error: 'The Kashi Ghar API could not be reached. Is the server still running?' };
      }
    } else {
      const out = await local.handle({
        method, url: path, body: raw,
        headers: { 'content-type': headers['Content-Type'] || '', authorization: headers.Authorization || '' }
      });
      status = out.status;
      data = out.body == null ? null : JSON.parse(JSON.stringify(out.body));
    }
    return { ok: status >= 200 && status < 300, status, data };
  }

  window.KGApi = {
    init, request,
    get mode() { return mode; },
    get storage() { return storage; }
  };
})();
