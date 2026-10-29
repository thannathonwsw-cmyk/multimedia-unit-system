import React, { useState } from "react";
import CrudPage, { FieldDef } from "../crud";
import { DB, Row, REQUEST_STATUS, WORK_TYPES, uid, nowISO } from "../types";
import { Session, can } from "../lib/auth";

const fields: FieldDef[] = [
  { key: "title", label: "หัวข้องาน", required: true },
  { key: "status", label: "สถานะ", type: "select", options: REQUEST_STATUS },
  { key: "receivedAt", label: "วันที่รับงาน", type: "datetime" },
  { key: "dueAt", label: "กำหนดเสร็จ", type: "datetime" },
  { key: "requesterName", label: "ผู้ขอใช้บริการ" },
  { key: "requesterDept", label: "หน่วยงาน" },
  { key: "workType", label: "ประเภทงาน", type: "select", options: WORK_TYPES },
  { key: "priority", label: "ความด่วน", type: "select", options: ["ปกติ", "ด่วน", "ด่วนมาก"] },
  { key: "externalCode", label: "รหัสจากชีทหลัก" },
  { key: "completedAt", label: "เสร็จสิ้นเมื่อ", type: "datetime" },
  { key: "description", label: "รายละเอียด", type: "textarea" },
  { key: "notes", label: "หมายเหตุ", type: "textarea" },
];

const columns = [
  { key: "receivedAt", label: "รับงาน" },
  { key: "title", label: "หัวข้อ" },
  { key: "requesterDept", label: "หน่วยงาน" },
  { key: "workType", label: "ประเภท" },
  { key: "dueAt", label: "กำหนด" },
  { key: "status", label: "สถานะ" },
];

export default function Requests({ db, update, session }: { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session }) {
  const [csv, setCsv] = useState("");
  const [open, setOpen] = useState(false);

  function importSheet() {
    const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { alert("ต้องมีหัวคอลัมน์และข้อมูลอย่างน้อย 1 แถว"); return; }
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const head = lines[0].split(delim).map(h => h.trim());
    const idx = (...keys: string[]) => head.findIndex(h => keys.some(k => h.includes(k)));
    const iDate = idx("วันที่รับ", "วันที่", "date");
    const iReq = idx("ผู้ขอ", "ชื่อผู้");
    const iDept = idx("หน่วยงาน");
    const iType = idx("ประเภท");
    const iTitle = idx("หัวข้อ", "เรื่อง", "title");
    const iDesc = idx("รายละเอียด");
    const iDue = idx("กำหนด");
    const iStatus = idx("สถานะ");
    const iNote = idx("หมายเหตุ");
    const got = (c: string[], i: number) => (i >= 0 ? (c[i] ?? "").trim() : "");

    const rows: Row[] = [];
    for (const line of lines.slice(1)) {
      const c = line.split(delim);
      const title = got(c, iTitle);
      if (!title) continue;
      rows.push({
        id: uid(), createdAt: nowISO(), updatedAt: nowISO(), source: "sheet-import",
        receivedAt: got(c, iDate), dueAt: got(c, iDue),
        requesterName: got(c, iReq), requesterDept: got(c, iDept),
        workType: got(c, iType), title, description: got(c, iDesc),
        status: got(c, iStatus) || "ใหม่", notes: got(c, iNote),
      });
    }
    if (rows.length === 0) { alert("ไม่พบข้อมูลที่นำเข้าได้ (ต้องมีคอลัมน์ หัวข้อ/เรื่อง)"); return; }
    update(d => ({ ...d, requests: [...rows, ...d.requests] }),
      { action: "นำเข้าจากชีท", entity: "คำขอใช้บริการ", summary: `${rows.length} รายการ` });
    setCsv(""); setOpen(false);
    alert(`นำเข้า ${rows.length} รายการเรียบร้อย`);
  }

  return (
    <CrudPage
      dbKey="requests" title="คำขอใช้บริการ" fields={fields} columns={columns}
      searchKeys={["title", "requesterName", "requesterDept", "externalCode"]}
      filenFolder="work-logs" db={db} update={update} session={session}
      above={can.importSheet(session.role) ? (
        <div className="card">
          <button className="btn" onClick={() => setOpen(!open)}>
            {open ? "ซ่อนตัวนำเข้าจากชีท" : "นำเข้าจากชีทหลัก (วางตาราง/CSV)"}
          </button>
          {open && (
            <>
              <p className="muted">
                คัดลอกแถวจาก Google Sheets / Excel มาวางด้านล่าง (รวมหัวคอลัมน์) — ระบบจับคอลัมน์จากชื่อหัว เช่น
                วันที่, ผู้ขอ, หน่วยงาน, ประเภท, หัวข้อ/เรื่อง, รายละเอียด, กำหนด, สถานะ, หมายเหตุ
              </p>
              <textarea rows={5} value={csv} onChange={e => setCsv(e.target.value)}
                placeholder={"วันที่\tผู้ขอ\tหน่วยงาน\tประเภท\tหัวข้อ\tสถานะ\n17/09/2026\tอ.สมชาย\tทันตแพทยศาสตร์\tถ่ายวิดีโอ\tถ่ายงานรับปริญญา\tใหม่"} />
              <button className="btn primary" onClick={importSheet}>นำเข้า</button>
            </>
          )}
        </div>
      ) : undefined}
    />
  );
}