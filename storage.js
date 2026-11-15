/* On-device storage for Rise. Everything stays on the user's phone or computer.
   Uses IndexedDB (large enough for proof photos); falls back to localStorage, then to memory. */
const DB = "rise-db", STORE = "kv";
let dbPromise = null;
const mem = new Map();

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      /* some browsers never answer in private mode: fall back instead of hanging */
      setTimeout(() => resolve(null), 2500);
    } catch (e) { resolve(null); }
  });
  return dbPromise;
};
const run = (db, mode, fn) => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode); const req = fn(tx.objectStore(STORE));
  tx.oncomplete = () => resolve(req && req.result);
  tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
});
const ls = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };

export const storage = {
  async get(key) {
    const db = await openDb();
    let value;
    if (db) value = await run(db, "readonly", (s) => s.get(key));
    else if (ls()) value = ls().getItem(key);
    else value = mem.get(key);
    return value == null ? null : { key, value };
  },
  async set(key, value) {
    const db = await openDb();
    if (db) await run(db, "readwrite", (s) => s.put(value, key));
    else if (ls()) ls().setItem(key, value);
    else mem.set(key, value);
    return { key, value };
  },
  async delete(key) {
    const db = await openDb();
    if (db) await run(db, "readwrite", (s) => s.delete(key));
    else if (ls()) ls().removeItem(key);
    else mem.delete(key);
    return { key, deleted: true };
  },
  async list(prefix = "") {
    const db = await openDb();
    let keys;
    if (db) keys = await run(db, "readonly", (s) => s.getAllKeys());
    else if (ls()) keys = Object.keys(ls());
    else keys = [...mem.keys()];
    return { keys: keys.filter((k) => String(k).startsWith(prefix)) };
  },
};

/* ask the browser not to clear Rise's data when the device runs low on space */
export const keepData = () => { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not supported */ } };
