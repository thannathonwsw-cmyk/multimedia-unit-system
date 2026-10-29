import { DB, emptyDB } from "../types";

const KEY = "mm-system-db-v1";

export function normalizeDB(d: any): DB {
  const base = emptyDB();
  const out: DB = { ...base, ...d };
  (["requests", "worklogs", "assets", "portfolio", "users", "audit"] as const).forEach(k => {
    if (!Array.isArray((out as any)[k])) (out as any)[k] = [];
  });
  out.meta = { ...base.meta, ...(d?.meta ?? {}) };
  return out;
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeDB(JSON.parse(raw));
  } catch {}
  return emptyDB();
}

export function saveDB(db: DB) { localStorage.setItem(KEY, JSON.stringify(db)); }
export function clearLocal() { localStorage.removeItem(KEY); }