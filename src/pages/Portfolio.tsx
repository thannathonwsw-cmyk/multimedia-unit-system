import React, { useMemo, useState } from "react";
import { DB, Row, uid, nowISO } from "../types";
import { Session, can } from "../lib/auth";
import { fmtDateTime, Badge, useFocusScroll } from "../ui";

const PF_TYPES = ["ประชาสัมพันธ์", "สอน/สาธิต", "สารคดี", "ไลฟ์/อีเวนต์", "มิวสิก/ศิลปิน", "อื่น ๆ"];
const PF_STATUS = ["เผยแพร่", "ภายใน", "ร่าง"];

// แกะรหัสวิดีโอจากลิงก์ YouTube ทุกรูปแบบที่พบบ่อย
function ytId(url?: string): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

// แปลง ISO เป็นค่าสำหรับ input datetime-local (เวลาท้องถิ่นจริง)
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ภาพปก: ลอง maxres → หดเป็น hq → ถ้าไม่มีจริงจึงใช้พื้นสำรอง
function Thumb({ row }: { row: Row }) {
  const id = ytId(row.link);
  const [stage, setStage] = useState(0);
  if (id && stage < 2) {
    const src = stage === 0 ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return (
      <div className="pf-thumb">
        <img src={src} alt="" onError={() => setStage(s => s + 1)} />
        <div className="pf-play">▶</div>
      </div>
    );
  }
  return (
    <div className="pf-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4rem" }}>
      {id ? "🎬" : ""}
    </div>
  );
}

type Props = { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session };

export default function Portfolio({ db, update, session }: Props) {
    useFocusScroll(db.portfolio.length);
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState("");
  const [fstatus, setFstatus] = useState("");
  const [draft, setDraft] = useState<Row | null>(null);
  const set = (k: string, v: any) => setDraft(d => (d ? { ...d, [k]: v } : d));

  const blank = (): Row => ({ id: uid(), createdAt: nowISO(), updatedAt: nowISO(), title: "", type: PF_TYPES[0], status: PF_STATUS[0], receivedAt: "", finishedAt: "", link: "", description: "" });

  const list = useMemo(() => db.portfolio
    .filter(p => (!ftype || p.type === ftype) && (!fstatus || p.status === fstatus))
    .filter(p => !q || [p.title, p.description, p.link].some(v => String(v ?? "").toLowerCase().includes(q.toLowerCase())))
    .slice().sort((a, b) => String(b.finishedAt ?? b.createdAt ?? "").localeCompare(String(a.finishedAt ?? a.createdAt ?? ""))),
    [db.portfolio, q, ftype, fstatus]);

  function saveDraft() {
    if (!draft) return;
    if (!String(draft.title ?? "").trim()) { alert("กรอกชื่อผลงาน"); return; }
    const exists = db.portfolio.some(p => p.id === draft.id);
    update(d => ({
      ...d,
      portfolio: exists ? d.portfolio.map(p => (p.id === draft.id ? { ...draft, updatedAt: nowISO() } : p)) : [{ ...draft, updatedAt: nowISO() }, ...d.portfolio],
    }), { action: exists ? "แก้ไขผลงาน" : "เพิ่มผลงาน", entity: "คลังผลงาน", summary: draft.title });
        setDraft(null);
    alert("บันทึกผลงานเรียบร้อยแล้ว");
  }

  function removeItem(id: string) {
    if (!confirm("ลบผลงานนี้หรือไม่? การลบไม่สามารถยกเลิกได้และเป็นเพียงการลบในฐานข้อมูล ไม่เกี่ยวข้องกับไฟล์ต้นฉบับ")) return;
    update(d => ({ ...d, portfolio: d.portfolio.filter(p => p.id !== id) }), { action: "ลบผลงาน", entity: "คลังผลงาน", summary: id });
  }

  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>🎬 คลังผลงานวิดีโอ ({list.length} รายการ)</h3>
          {can.edit(session.role) && <button className="btn primary" onClick={() => setDraft(blank())}>+ เพิ่มรายการ</button>}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input placeholder="ค้นหาชื่อผลงาน / คำอธิบาย..." value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
          <select value={ftype} onChange={e => setFtype(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {PF_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={fstatus} onChange={e => setFstatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            {PF_STATUS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {draft && (
        <div className="card">
          <h3>{db.portfolio.some(p => p.id === draft.id) ? "✏️ แก้ไขผลงาน" : "➕ เพิ่มผลงานใหม่"}</h3>
          <div style={grid2}>
            <input placeholder="ชื่อผลงาน *" value={draft.title ?? ""} onChange={e => set("title", e.target.value)} />
            <select value={draft.type ?? PF_TYPES[0]} onChange={e => set("type", e.target.value)}>
              {PF_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={draft.status ?? PF_STATUS[0]} onChange={e => set("status", e.target.value)}>
              {PF_STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="ลิงก์ YouTube / ไฟล์ผลงาน" value={draft.link ?? ""} onChange={e => set("link", e.target.value)} />
            <label className="muted">วันสั่งงาน
              <input type="datetime-local" value={toLocalInput(draft.receivedAt)} onChange={e => set("receivedAt", e.target.value ? new Date(e.target.value).toISOString() : "")} />
            </label>
            <label className="muted">วันเสร็จ/เผยแพร่
              <input type="datetime-local" value={toLocalInput(draft.finishedAt)} onChange={e => set("finishedAt", e.target.value ? new Date(e.target.value).toISOString() : "")} />
            </label>
          </div>
          <textarea rows={3} placeholder="รายละเอียด/เครดิตทีม" value={draft.description ?? ""} onChange={e => set("description", e.target.value)} style={{ marginTop: 10 }} />
          {ytId(draft.link) && <p className="muted" style={{ marginTop: 6 }}>✅ ตรวจพบลิงก์ YouTube — ระบบจะดึงภาพปกมาแสดงบนการ์ดอัตโนมัติ</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={saveDraft}>บันทึก</button>
            <button className="btn" onClick={() => setDraft(null)}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="pf-grid">
        {list.map(p => {
          const id = ytId(p.link);
          return (
            <div key={p.id} className="pf-card" data-rowid={p.id}>
              <Thumb row={p} />
              <div className="pf-body">
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <Badge>{p.type || "-"}</Badge>
                  <Badge>{p.status || "-"}</Badge>
                </div>
                <div className="muted" style={{ fontSize: ".85em" }}>
                  {p.finishedAt ? fmtDateTime(p.finishedAt) : "ยังไม่เผยแพร่"}
                </div>
                {p.description && <div className="muted" style={{ fontSize: ".85em" }}>{p.description}</div>}
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {p.link && <a className="btn" href={p.link} target="_blank" rel="noreferrer">{id ? "▶ เปิดวิดีโอ" : "🔗 เปิดลิงก์"}</a>}
                  {can.edit(session.role) && <button className="btn" onClick={() => setDraft({ ...p, type: p.type || PF_TYPES[0], status: p.status || PF_STATUS[0] })}>แก้ไข</button>}
                  {can.edit(session.role) && <button className="btn danger" onClick={() => removeItem(p.id)}>ลบ</button>}
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="card muted">ยังไม่มีผลงานตามตัวกรอง — กด "+ เพิ่มรายการ" แล้ววางลิงก์ YouTube ดูพลังภาพปกได้เลย</div>}
      </div>
    </div>
  );
}