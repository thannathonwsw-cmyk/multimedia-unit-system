// ===== สะพาน Google Drive (ใส่ค่าจาก Apps Script ที่คุณ deploy) =====
export const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbyYjklbiW_MGGnLwwSvyroonxBGFvvM9bWI0A9C6TM55Fg-erZ3K2zIhq4CXidX71eUBA/exec";
export const BRIDGE_TOKEN = "@Moss19022547_47";

export const bridgeEnabled = () => !!BRIDGE_URL && !!BRIDGE_TOKEN;

async function call(op: string, extra: Record<string, string> = {}, postBody?: any): Promise<any> {
  const qs = Object.entries(extra).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");
  const url = `${BRIDGE_URL}?token=${encodeURIComponent(BRIDGE_TOKEN)}&op=${op}${qs}`;
  const res = await fetch(url, postBody !== undefined
    ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(postBody) }
    : { method: "GET" });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "bridge error");
  return j;
}

export const bridgePull = async (): Promise<any | null> => (await call("get")).db ?? null;
export const bridgePush = async (db: any) => { await call("put", {}, { db }); };

export async function bridgeUploadAtt(file: File, folder: string, entityId: string): Promise<string> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("ไฟล์เกิน 10MB เกินขีดสะพาน Drive — ใช้สำรอง Filen สำหรับไฟล์ใหญ่");
  const base64 = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  await call("putatt", {}, { folder, entityId, name: file.name, mime: file.type || "application/octet-stream", base64 });
  return `${folder}/${entityId}/${file.name}`;
}

export async function bridgeDownloadAtt(path: string): Promise<Blob> {
  const parts = path.split("/");
  const name = parts.pop()!;
  const entityId = parts.pop()!;
  const folder = parts.join("/");
  const j = await call("getatt", { folder, entityId, name });
  const bin = atob(j.base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr as any], { type: j.mime });
}