import React from "react";
import CrudPage, { FieldDef } from "../crud";
import { DB, PORTFOLIO_CATEGORIES } from "../types";
import { Session } from "../lib/auth";

const fields: FieldDef[] = [
  { key: "title", label: "ชื่อผลงาน", required: true },
  { key: "status", label: "สถานะ", type: "select", options: ["ร่าง", "รอตรวจ", "เผยแพร่", "ปิดเผยแพร่"] },
  { key: "category", label: "ประเภท", type: "select", options: PORTFOLIO_CATEGORIES },
  { key: "orderedAt", label: "วันที่สั่งงาน", type: "datetime" },
  { key: "completedAt", label: "วันที่เสร็จชิ้นงาน", type: "datetime" },
  { key: "publishedAt", label: "วันที่เผยแพร่", type: "datetime" },
  { key: "requesterName", label: "ผู้สั่งงาน" },
  { key: "department", label: "หน่วยงาน" },
  { key: "tags", label: "แท็ก", placeholder: "คั่นด้วยจุลภาค" },
  { key: "externalLink", label: "ลิงก์เผยแพร่ (ถ้ามี)" },
  { key: "description", label: "รายละเอียด", type: "textarea" },
];

const columns = [
  { key: "orderedAt", label: "สั่งงาน" },
  { key: "title", label: "ผลงาน" },
  { key: "category", label: "ประเภท" },
  { key: "completedAt", label: "เสร็จ" },
  { key: "status", label: "สถานะ" },
];

export default function Portfolio({ db, update, session }: { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session }) {
  return (
    <CrudPage dbKey="portfolio" title="คลังผลงานวิดีโอ" fields={fields} columns={columns}
      searchKeys={["title", "requesterName", "tags"]} filenFolder="portfolio"
      db={db} update={update} session={session} />
  );
}