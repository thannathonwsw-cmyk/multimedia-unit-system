import { DB } from "../types";

export type Role = "admin" | "user";
export type Session = { userId: string; username: string; displayName: string; role: Role; loginAt: string };

const SKEY = "mm-session-v1";

export function getSession(): Session | null {
  try { const raw = sessionStorage.getItem(SKEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function setSession(s: Session) { sessionStorage.setItem(SKEY, JSON.stringify(s)); }
export function clearSession() { sessionStorage.removeItem(SKEY); }

export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const s = salt ?? Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(s), iterations: 120000, hash: "SHA-256" }, key, 256);
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return { hash, salt: s };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const r = await hashPassword(password, salt);
  return r.hash === hash;
}

export const can = {
  deleteRecord: (r?: Role) => r === "admin",
  importSheet: (r?: Role) => r === "admin",
  exportData: (r?: Role) => r === "admin",
  viewAudit: (r?: Role) => r === "admin",
  manageUsers: (r?: Role) => r === "admin",
  viewSystemSettings: (r?: Role) => r === "admin",
};