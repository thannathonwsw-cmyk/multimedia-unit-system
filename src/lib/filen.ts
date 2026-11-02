import { bridgeEnabled, bridgePull, bridgePush, bridgeUploadAtt, bridgeDownloadAtt } from "./bridge";

const BASE = "/multimedia-system";
const DB_PATH = `${BASE}/db.json`;
let sdk: any = null;

export const filenConnected = () => bridgeEnabled() || !!sdk;

async function ensureBrowserEnv() {
  try {
    const g: any = globalThis as any;
    if (g.process) { g.process.browser = true; if (g.process.versions) g.process.versions.node = ""; }
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
        rp.native = rp; fs.realpath = rp;
      } else if (!fs.realpath.native) fs.realpath.native = fs.realpath;
      if (typeof fs.lstat !== "function" && typeof fs.stat === "function") fs.lstat = fs.stat;
    }
  } catch (e) { console.warn("shim ไม่สำเร็จ", e); }
}

export async function connect(email: string, password: string, twoFactorCode?: string) {
  if (bridgeEnabled()) return; // ใช้สะพาน Drive อยู่ ไม่ต้องเชื่อม Filen
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
  if (bridgeEnabled()) return bridgePull();
  if (!sdk) return null;
  try {
    const data = await sdk.downloadFile({ path: DB_PATH });
    return JSON.parse(await (await toBlob(data)).text());
  } catch { return null; }
}

export async function pushDB(db: any) {
  if (bridgeEnabled()) return bridgePush(db);
  if (!sdk) return;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  await sdk.upload({ source: blob, destination: DB_PATH, forceOverwrite: true });
}

export async function uploadAttachment(file: File, folder: string, entityId: string): Promise<string> {
  if (bridgeEnabled()) return bridgeUploadAtt(file, folder, entityId);
  const safe = file.name.replace(/[^\w.\-ก-๙]+/g, "_");
  const path = `${BASE}/${folder}/${entityId}/${safe}`;
  await sdk.upload({ source: file, destination: path, forceOverwrite: true });
  return path;
}

export async function downloadAttachment(path: string): Promise<Blob> {
  if (bridgeEnabled()) return bridgeDownloadAtt(path);
  return toBlob(await sdk.downloadFile({ path }));
}