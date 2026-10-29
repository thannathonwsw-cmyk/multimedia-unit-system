/**
 * FilenService v4 — alias node:* + shim fs + โหมดเบราว์เซอร์
 */
const BASE = "/multimedia-system";
const DB_PATH = `${BASE}/db.json`;
let sdk: any = null;

export const filenConnected = () => !!sdk;

async function ensureBrowserEnv() {
  try {
    const g: any = globalThis as any;
    if (g.process) {
      g.process.browser = true;
      if (g.process.versions) g.process.versions.node = "";
    }
    // @ts-ignore
    const mod: any = await import("fs");
    const fs = mod.default ?? mod;
    if (fs) {
      if (typeof fs.realpath !== "function") {
        const rp: any = (p: any, opts: any, cb?: any) => {
          const c = typeof opts === "function" ? opts : cb;
          if (typeof c === "function") c(null, p);
          return Promise.resolve(p);
        };
        rp.native = rp;
        fs.realpath = rp;
      } else if (!fs.realpath.native) fs.realpath.native = fs.realpath;
      if (typeof fs.realpathSync !== "function") {
        const rs: any = (p: any) => p;
        rs.native = rs;
        fs.realpathSync = rs;
      } else if (!fs.realpathSync.native) fs.realpathSync.native = fs.realpathSync;
      if (typeof fs.lstat !== "function" && typeof fs.stat === "function") fs.lstat = fs.stat;
      if (typeof fs.readlink !== "function") {
        fs.readlink = (p: any, cb: any) => { if (typeof cb === "function") cb(null, p); return Promise.resolve(p); };
      }
    }
  } catch (e) {
    console.warn("เตรียมสภาพแวดล้อมไม่สำเร็จ", e);
  }
}

export async function connect(email: string, password: string, twoFactorCode?: string) {
  await ensureBrowserEnv();
  const mod: any = await import("@filen/sdk");
  const Filen = mod.Filen ?? mod.default ?? mod;
  sdk = new Filen({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}) });
  if (typeof sdk.init === "function") await sdk.init();
  else if (typeof sdk.login === "function") await sdk.login({ email, password });
  try { await sdk.mkdir({ path: BASE }); } catch (e) { console.warn("ข้าม mkdir:", e); }
}

export function disconnect() { sdk = null; }

async function toBlob(data: any): Promise<Blob> {
  if (data instanceof Blob) return data;
  if (data && typeof data.blob === "function") return await data.blob();
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) return new Blob([data as any]);
  return new Blob([data as any]);
}

export async function pullDB(): Promise<any | null> {
  if (!sdk) return null;
  try {
    const data = await sdk.downloadFile({ path: DB_PATH });
    const text = await (await toBlob(data)).text();
    return JSON.parse(text);
  } catch { return null; }
}

export async function pushDB(db: any) {
  if (!sdk) return;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  await sdk.upload({ source: blob, destination: DB_PATH, forceOverwrite: true });
}

export async function uploadAttachment(file: File, folder: string, entityId: string): Promise<string> {
  const safe = file.name.replace(/[^\w.\-ก-๙]+/g, "_");
  const path = `${BASE}/${folder}/${entityId}/${safe}`;
  await sdk.upload({ source: file, destination: path, forceOverwrite: true });
  return path;
}

export async function downloadAttachment(path: string): Promise<Blob> {
  return toBlob(await sdk.downloadFile({ path }));
}