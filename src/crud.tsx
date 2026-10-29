import React, { useMemo, useState } from "react";
import { DB, Row, Attachment, uid, nowISO } from "./types";
import { idbSet, idbGet } from "./lib/idb";
import { filenConnected, uploadAttachment, downloadAttachment } from "./lib/filen";
import { Session, can } from "./lib/auth";
import { Modal, fmtDateTime, Badge } from "./ui";

export type FieldDef = {
  key: string; label: string;
  type?: "text" | "textarea" | "date" | "time" | "datetime" | "number" | "select";
  options?: string[]; required?: boolean; placeholder?: string;
};

const ENTITY_LABEL: Record<string, string> = {
  requests: "คำขอใช้บริการ", worklogs: "งานย้อนหลัง", portfolio: "คลังผลงาน"
};

type Props = {
  dbKey: "requests" | "worklogs" | "portfolio";
  title: string;
  fields: FieldDef[];
  columns: { key: string; label: string }[];
  searchKeys: string[];
  filenFolder: string;
  db: DB;
  update: (fn: (d: DB) => DB, audit?: any) => void;
  session: Session | null;
  above?: React.ReactNode;
};

export default function CrudPage({ dbKey, title, fields, columns, searchKeys, filenFolder, db, update, session, above }: Props) {
  const rows: Row[] = (db as any)[dbKey] ?? [];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const statusField = fields.find(f => f.key === "status");
  const role = session?.role;

  const filtered = useMemo(() => rows.filter(r => {
    if (status && r.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return searchKeys.some(k => String(r[k] ?? "").toLowerCase().includes(s));
  }), [rows, q, status]);

  return (
    <div>
      <div className="page-head">
        <h2>{title} <span className="muted">({filtered.length} รายการ)</span></h2>
        <button className="btn primary" onClick={() => setEditing("new")}>+ เพิ่มรายการ</button>
      </div>
      {above}
      <div className="filters">
        <input placeholder="ค้นหา..." value={q} onChange={e => setQ(e.target.value)} />
        {statusField && (
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ flex: "0 0 180px" }}>
            <option value="">ทุกสถานะ</option>
            {statusField.options!.map(o => <option key={o}>{o}</option>)}
          </select>
        )}
      </div>
      <table className="table">
        <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}<th>ไฟล์แนบ</th><th></th></tr></thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id}>
              {columns.map(c => (
                <td key={c.key}>
                  {c.key === "status" ? <Badge>{r.status || "-"}</Badge>
                    : /At$|Date$/.test(c.key) ? fmtDateTime(r[c.key])
                    : String(r[c.key] ?? "-")}
                </td>
              ))}
              <td>{(r.attachments ?? []).length ? <AttachmentList atts={r.attachments} /> : "-"}</td>
              <td className="actions">
                <button className="btn" onClick={() => setEditing(r)}>แก้ไข</button>
                {can.deleteRecord(role) && (
                  <button className="btn danger" onClick={() => {
                    if (confirm("ลบรายการนี้?"))
                      update(d => ({ ...d, [dbKey]: (d as any)[dbKey].filter((x: Row) => x.id !== r.id) }),
                        { action: "ลบ", entity: ENTITY_LABEL[dbKey], entityId: r.id, summary: String(r.title || r.name || r.id) });
                  }}>ลบ</button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={columns.length + 2} className="muted center">ยังไม่มีข้อมูล</td></tr>}
        </tbody>
      </table>

      {editing && (
        <Editor fields={fields} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={async (vals, newFiles, base) => {
            const id = base?.id ?? uid();
            const atts: Attachment[] = [...(base?.attachments ?? [])];
            for (const f of newFiles) {
              const att: Attachment = { id: uid(), name: f.name, size: f.size, mime: f.type, addedAt: nowISO(), localKey: uid() };
              await idbSet(att.localKey!, f);
              if (filenConnected()) {
                try { att.filenPath = await uploadAttachment(f, filenFolder, id); }
                catch (e) { console.warn("อัปโหลดเข้า Filen ไม่สำเร็จ", e); }
              }
              atts.push(att);
            }
            const row: Row = { ...vals, id, attachments: atts, createdAt: base?.createdAt ?? nowISO(), updatedAt: nowISO() };
            update(d => ({
              ...d,
              [dbKey]: base ? (d as any)[dbKey].map((x: Row) => x.id === id ? row : x) : [row, ...(d as any)[dbKey]],
            }), {
              action: base ? "แก้ไข" : "เพิ่ม",
              entity: ENTITY_LABEL[dbKey], entityId: id,
              summary: String(vals.title || vals.name || id),
            });
          }} />
      )}
    </div>
  );
}

function Editor({ fields, initial, onClose, onSave }: {
  fields: FieldDef[]; initial: Row | null; onClose: () => void;
  onSave: (vals: any, files: File[], base: Row | null) => Promise<void>;
}) {
  const [vals, setVals] = useState<any>(() => { const v: any = {}; fields.forEach(f => v[f.key] = initial?.[f.key] ?? ""); return v; });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setVals((s: any) => ({ ...s, [k]: v }));

  return (
    <Modal title={initial ? "แก้ไขรายการ" : "เพิ่มรายการ"} onClose={onClose} wide>
      <div className="form-grid">
        {fields.map(f => (
          <div key={f.key} className={"field" + (f.type === "textarea" ? " span2" : "")}>
            <label>{f.label}{f.required ? " *" : ""}</label>
            {f.type === "textarea" ? (
              <textarea rows={3} value={vals[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} />
            ) : f.type === "select" ? (
              <select value={vals[f.key] ?? ""} onChange={e => set(f.key, e.target.value)}>
                <option value="">— เลือก —</option>
                {f.options!.map(o => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type === "datetime" ? "datetime-local" : f.type === "number" ? "number" : f.type ?? "text"}
                value={vals[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            )}
          </div>
        ))}
        <div className="field span2">
          <label>ไฟล์แนบ (ภาพ / วิดีโอ / เอกสาร)</label>
          <input type="file" multiple onChange={e => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
          {files.length > 0 && <div className="muted">รออัปโหลด: {files.map(f => f.name).join(", ")}</div>}
          {initial && (initial.attachments ?? []).length > 0 && <AttachmentList atts={initial.attachments} />}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" disabled={busy} onClick={async () => {
          const missing = fields.filter(f => f.required && !vals[f.key]);
          if (missing.length) { alert("กรุณากรอก: " + missing.map(f => f.label).join(", ")); return; }
          setBusy(true);
          try { await onSave(vals, files, initial); onClose(); } finally { setBusy(false); }
        }}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
      </div>
    </Modal>
  );
}

export function AttachmentList({ atts }: { atts: Attachment[] }) {
  const [busyId, setBusyId] = useState("");
  return (
    <span className="atts">
      {atts.map(a => (
        <button key={a.id} className="btn link" disabled={!!busyId} onClick={async () => {
          setBusyId(a.id);
          try {
            let blob: Blob | undefined;
            if (a.filenPath && filenConnected()) blob = await downloadAttachment(a.filenPath);
            else if (a.localKey) blob = await idbGet(a.localKey);
            if (!blob) { alert("ไม่พบไฟล์ในเครื่อง และไม่ได้เชื่อม Filen อยู่"); return; }
            window.open(URL.createObjectURL(blob), "_blank");
          } finally { setBusyId(""); }
        }}>{busyId === a.id ? "..." : a.name}</button>
      ))}
    </span>
  );
}