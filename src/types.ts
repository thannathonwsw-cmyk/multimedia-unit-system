import { Role } from "./lib/auth";

export type Attachment = {
  id: string; name: string; size: number; mime: string; addedAt: string;
  localKey?: string; filenPath?: string;
};

export type Row = {
  id: string; createdAt: string; updatedAt: string;
  attachments?: Attachment[]; [k: string]: any;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  salt: string;
  hash?: string;
  passHash?: string;
  status?: string;
  createdAt: string;
};

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  username?: string;   // เชื่อมโยงบัญชีล็อกอิน (ใช้กับโหมดงานของฉัน)
  createdAt: string;
  color?: string;
}

export const STAFF_COLORS = ["#6d8bff", "#ff6b81", "#22c55e", "#f59e0b", "#a06bff", "#06b6d4", "#f97316", "#ec4899"];

export type AuditRow = {
  id: string; at: string; userId: string; username: string;
  action: string; entity: string; entityId?: string; summary?: string;
};

export type DB = {
  version: 1;
  requests: Row[]; worklogs: Row[]; assets: Row[]; portfolio: Row[];
  users: User[]; staff: Staff[]; audit: AuditRow[]; inquiries: Inquiry[];
  portal: PortalCfg;
  meta: { lastSavedAt?: string; lastSyncAt?: string };
};

export const emptyDB = (): DB => ({
  version: 1, requests: [], worklogs: [], assets: [], portfolio: [],
  users: [], staff: [], audit: [], meta: {}, inquiries: [],
  portal: defaultPortal(),
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

export interface PortalCfg {
  heroTitle: string;
  motto: string;
  note: string;
  mmServices: string[];
  avServices: string[];
}
export const defaultPortal = (): PortalCfg => ({
  heroTitle: "สร้างสรรค์สื่ออย่างมืออาชีพ\nด้วยเทคโนโลยีทันสมัยและใจรักบริการ",
  motto: "ปรัชญาการดำเนินงาน: \"สื่อที่ดี คือสะพานเชื่อมความรู้สู่สังคม\"",
  note: "สำหรับบุคคลและหน่วยงานภายใน-ภายนอกคณะ • ส่งคำขอแล้วหน่วยจะติดต่อกลับตามช่องทางที่ระบุ (ขอล่วงหน้า 3 วันทำการ)",
  mmServices: [
    "ออกแบบโปสเตอร์ประชาสัมพันธ์",
    "ออกแบบใบปลิว / อินโฟกราฟิก",
    "ออกแบบโบรชัวร์ดิจิทัล / ปกหนังสือ / นามบัตร / แผ่นพับ / บัตรอวยพร",
    "E-book",
    "วิดีโอสั้น (ไม่เกิน 2 นาที)",
    "วิดีโอยาว (มากกว่า 2 นาที)",
    "ถ่ายภาพทั่วไป",
    "ถ่ายภาพในสตูดิโอ",
    "ทำข่าวประชาสัมพันธ์ ลงระบบทีวีวงจรปิดภายในคณะฯ",
    "ลงข่าวประชาสัมพันธ์ผ่านสื่อ Social Media / แท็บข่าวประชา",
    "พิมพ์ copy print / เข้าเล่ม",
    "งานสติกเกอร์",
    "ภาพถ่ายประกอบการสอน",
    "งานจัดเวที จัดสถานที่ กิจกรรมต่างๆ",
  ],
  avServices: [
    "ขอใช้บริการเครื่องเสียงเคลื่อนที่",
    "ขอใช้บริการรถรับ-ส่ง",
    "ขอใช้บริการโปรเจคเตอร์",
    "ขอใช้บริการเปิดปิดอุปกรณ์โสตฯ",
  ],
});

export interface Inquiry { id: string; createdAt: string; name?: string; phone: string; message: string; done?: boolean }