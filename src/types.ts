export type Attachment = {
  id: string; name: string; size: number; mime: string; addedAt: string;
  localKey?: string; filenPath?: string;
};

export type Row = {
  id: string; createdAt: string; updatedAt: string;
  attachments?: Attachment[]; [k: string]: any;
};

export type User = {
  id: string; username: string; displayName: string;
  role: "admin" | "user"; passHash: string; salt: string;
  status: "active" | "disabled"; createdAt: string; updatedAt: string;
};

export type AuditRow = {
  id: string; at: string; userId: string; username: string;
  action: string; entity: string; entityId?: string; summary?: string;
};

export type DB = {
  version: 1;
  requests: Row[]; worklogs: Row[]; assets: Row[]; portfolio: Row[];
  users: User[]; audit: AuditRow[];
  meta: { lastSavedAt?: string; lastSyncAt?: string };
};

export const emptyDB = (): DB => ({
  version: 1, requests: [], worklogs: [], assets: [], portfolio: [],
  users: [], audit: [], meta: {}
});

export const uid = (): string =>
  (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const nowISO = () => new Date().toISOString();

export const REQUEST_STATUS = ["ใหม่", "รับเรื่องแล้ว", "กำลังดำเนินการ", "รอข้อมูลเพิ่ม", "รอตรวจงาน", "เสร็จสิ้น", "ยกเลิก"];
export const ASSET_STATUS = ["ว่าง/พร้อมใช้งาน", "ถูกใช้งาน", "ถูกยืม", "ส่งซ่อม", "เสีย/รอตรวจสอบ", "สูญหาย", "ตัดจำหน่าย"];
export const ASSET_CATEGORIES = ["กล้อง", "เลนส์", "ไมโครโฟน", "ไฟ", "ขาตั้ง", "การ์ดความจำ", "ฮาร์ดดิสก์", "คอมพิวเตอร์", "อุปกรณ์เสียง", "อื่น ๆ"];
export const WORK_TYPES = ["ถ่ายภาพ", "ถ่ายวิดีโอ", "ตัดต่อวิดีโอ", "โมชันกราฟิก", "บันทึกเสียง", "ออกแบบกราฟิก", "ถ่ายทอดสด", "อื่น ๆ"];
export const WORK_CATEGORIES = ["ถ่ายทำ", "ตัดต่อ", "โมชันกราฟิก", "บันทึกเสียง", "ออกแบบกราฟิก", "ประชุม/ประสานงาน", "จัดเตรียมอุปกรณ์", "ส่งมอบงาน", "อื่น ๆ"];
export const PORTFOLIO_CATEGORIES = ["ประชาสัมพันธ์", "อบรม/สอน", "พิธีการ", "แนะนำหน่วยงาน", "สัมภาษณ์", "โมชันกราฟิก", "อื่น ๆ"];