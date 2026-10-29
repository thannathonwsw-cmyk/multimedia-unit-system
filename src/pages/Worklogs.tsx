import React from "react";
import CrudPage, { FieldDef } from "../crud";
import { DB, WORK_CATEGORIES } from "../types";
import { Session } from "../lib/auth";

const fields: FieldDef[] = [
  { key: "title", label: "ชื่องานที่ทำ", required: true },
  { key: "workAt", label: "วันที่-เวลา", type: "datetime" },
  { key: "hours", label: "ชั่วโมงที่ใช้", type: "number" },
  { key: "category", label: "ประเภทงาน", type: "select", options: WORK_CATEGORIES },
  { key: "requestRef", label: "รหัสคำขอที่เกี่ยวข้อง", placeholder: "เช่น REQ-2026-0001" },
  { key: "status", label: "สถานะ", type: "select", options: ["ทำเสร็จ", "ระหว่างทำ", "รอส่งมอบ"] },
  { key: "detail", label: "รายละเอียดงาน", type: "textarea" },
  { key: "note", label: "หมายเหตุเพิ่มเติม", type: "textarea" },
];

const columns = [
  { key: "workAt", label: "วันที่" },
  { key: "title", label: "งาน" },
  { key: "category", label: "ประเภท" },
  { key: "hours", label: "ชม." },
  { key: "status", label: "สถานะ" },
];

export default function WorkLogs({ db, update, session }: { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session }) {
  return (
    <CrudPage dbKey="worklogs" title="งานย้อนหลัง" fields={fields} columns={columns}
      searchKeys={["title", "detail", "requestRef"]} filenFolder="work-logs"
      db={db} update={update} session={session} />
  );
}