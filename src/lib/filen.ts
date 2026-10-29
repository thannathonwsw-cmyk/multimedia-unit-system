const BASE = "/multimedia-system";
const DB_PATH = `${BASE}/db.json`;
let sdk: any = null;

export const filenConnected = () => !!sdk;

export async function connect(email: string, password: string, twoFactorCode?: string) {
  const mod: any = await import("@filen/sdk");
  const Filen = mod.Filen ?? mod.default ?? mod;
  sdk = new Filen({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}) });
  if (typeof sdk.init === "function") await sdk.init();
  else if (typeof sdk.login === "function") await sdk.login({ email, password });
  try { await sdk.mkdir({ path: BASE }); } catch {}
}

export function disconnect() { sdk = null; }

async function toBlob(data: any): Promise<Blob> {
  if (data instanceof Blob) return data;
  if (data && typeof data.blob === "function") return await data.blob();
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) return new Blob([data]);
  return new Blob([data]);
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