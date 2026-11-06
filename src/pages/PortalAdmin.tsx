import React, { useState } from "react";
import { DB, defaultPortal } from "../types";
import { Session } from "../lib/auth";

type Props = { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session };

export default function PortalAdmin({ db, update }: Props) {
  const [draft, setDraft] = useState(() => ({ ...defaultPortal(), ...(db.portal ?? {}) }));
  const [newMM, setNewMM] = useState("");
  const [newAV, setNewAV] = useState("");

  const save = () => {
    update(d => ({ ...d, portal: { ...draft } }), { action: "แก้ไขหน้าเว็บสาธารณะ", entity: "portal", summary: "บันทึกการตั้งค่า" });
    alert("บันทึกแล้ว — หน้าสาธารณะจะเปลี่ยนทันทีทุกเครื่อง");
  };

  const editor = (key: "mmServices" | "avServices", title: string, val: string, setVal: (v: string) => void) => (
    <div className="card">
      <h3>{title}</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {draft[key].map((s, i) => (
          <div className="row" key={i} style={{ gap: 8 }}>
            <input style={{ flex: 1 }} value={s} onChange={e => {
              const next = draft[key].slice(); next[i] = e.target.value; setDraft({ ...draft, [key]: next });
            }} />
            <button className="btn danger" onClick={() => setDraft({ ...draft, [key]: draft[key].filter((_, j) => j !== i) })}>ลบ</button>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <input style={{ flex: 1 }} placeholder="เพิ่มรายการใหม่..." value={val} onChange={e => setVal(e.target.value)} />
        <button className="btn" onClick={() => {
          if (!val.trim()) return;
          setDraft({ ...draft, [key]: [...draft[key], val.trim()] }); setVal("");
        }}>+ เพิ่ม</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <h3>🌐 ข้อความหน้าเว็บสาธารณะ</h3>
        <label className="muted">หัวข้อใหญ่ (Hero) — ขึ้นบรรทัดใหม่ได้
          <textarea rows={2} value={draft.heroTitle} onChange={e => setDraft({ ...draft, heroTitle: e.target.value })} />
        </label>
        <label className="muted" style={{ marginTop: 8 }}>ปรัชญา/คำขวัญ
          <input value={draft.motto} onChange={e => setDraft({ ...draft, motto: e.target.value })} />
        </label>
        <label className="muted" style={{ marginTop: 8 }}>หมายเหตุท้ายการ์ดบริการ
          <textarea rows={2} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} />
        </label>
      </div>
      {editor("mmServices", " รายการเลือก: งานสื่อมัลติมีเดีย", newMM, setNewMM)}
      {editor("avServices", "🎧 รายการเลือก: งานโสตทัศนูปกรณ์", newAV, setNewAV)}
      <div className="row">
        <button className="btn primary" onClick={save}>💾 บันทึกการตั้งค่าหน้าเว็บ</button>
      </div>
    </div>
  );
}