import React, { useState } from "react";
import { DB, Row, ASSET_STATUS, ASSET_CATEGORIES, uid, nowISO } from "../types";
import { Session, can } from "../lib/auth";
import { Modal, Badge, fmtDateTime, nowLocal } from "../ui";

type History = { at: string; from: string; to: string; reason: string };
type Loan = { id: string; borrower: string; contact: string; purpose: string; issuedAt: string; dueAt: string; returnedAt?: string; conditionOut: string; conditionIn?: string };
type Fn = (fn: (d: DB) => DB, audit?: any) => void;

const blank = (): Row => ({ id: uid(), createdAt: nowISO(), updatedAt: nowISO(), status: ASSET_STATUS[0], history: [], loans: [] });

export default function Assets({ db, update, session }: { db: DB; update: Fn; session: Session }) {
  const assets: Row[] = db.assets;
  const [editing, setEditing] = useState<Row | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const detail = assets.find(a => a.id === detailId) ?? null;

  const patch = (id: string, fn: (a: Row) => Row, audit?: any) =>
    update(d => ({ ...d, assets: d.assets.map(a => a.id === id ? { ...fn(a), updatedAt: nowISO() } : a) }), audit);

  const filtered = assets.filter(a =>
    !q || [a.assetCode, a.assetNumber, a.name, a.category, a.location, a.custodian]
      .some(v => String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <div className="page-head">
        <h2>ครุภัณฑ์ / อุปกรณ์ <span className="muted">({assets.length} รายการ)</span></h2>
        <button className="btn primary" onClick={() => setEditing(blank())}>+ เพิ่มครุภัณฑ์</button>
      </div>
      <div className="filters">
        <input placeholder="ค้นหาเลขครุภัณฑ์ / ชื่อ / ผู้ถือครอง..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <table className="table">
        <thead><tr><th>รหัส</th><th>เลขครุภัณฑ์</th><th>ชื่อ</th><th>ประเภท</th><th>สถานะ</th><th>ที่เก็บ</th><th>ยืมค้าง</th><th></th></tr></thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a.id}>
              <td>{a.assetCode}</td><td>{a.assetNumber || "-"}</td><td>{a.name}</td><td>{a.category}</td>
              <td><Badge>{a.status}</Badge></td><td>{a.location || "-"}</td>
              <td>{(a.loans ?? []).filter((l: Loan) => !l.returnedAt).length || "-"}</td>
              <td className="actions">
                <button className="btn" onClick={() => setDetailId(a.id)}>ประวัติ/ยืม-คืน</button>
                <button className="btn" onClick={() => setEditing(a)}>แก้ไข</button>
                {can.deleteRecord(session.role) && (
                  <button className="btn danger" onClick={() => {
                    if (confirm("ลบครุภัณฑ์นี้?"))
                      update(d => ({ ...d, assets: d.assets.filter(x => x.id !== a.id) }),
                        { action: "ลบ", entity: "ครุภัณฑ์", entityId: a.id, summary: `${a.assetCode} ${a.name}` });
                  }}>ลบ</button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={8} className="muted center">ยังไม่มีครุภัณฑ์</td></tr>}
        </tbody>
      </table>

      {editing && (
        <AssetForm initial={editing} onClose={() => setEditing(null)} onSave={(vals, base) => {
          const id = base.id ?? uid();
          const old = assets.find(a => a.id === id);
          const row: Row = { ...(old ?? base), ...vals, id, createdAt: old?.createdAt ?? nowISO(), updatedAt: nowISO() };
          if (old && old.status !== vals.status) {
            row.history = [...(old.history ?? []), { at: nowISO(), from: old.status, to: vals.status, reason: "แก้ไขจากฟอร์ม" }];
          }
          update(d => ({ ...d, assets: old ? d.assets.map(a => a.id === id ? row : a) : [row, ...d.assets] }),
            { action: old ? "แก้ไข" : "เพิ่ม", entity: "ครุภัณฑ์", entityId: id, summary: `${vals.assetCode} ${vals.name}` });
        }} />
      )}

      {detail && <AssetDetail asset={detail} patch={patch} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function AssetForm({ initial, onClose, onSave }: { initial: Row; onClose: () => void; onSave: (vals: any, base: Row) => void }) {
  const [v, setV] = useState<any>({ ...initial });
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }));
  const F = (key: string, label: string, type = "text", options?: string[]) => (
    <div className="field">
      <label>{label}</label>
      {options ? (
        <select value={v[key] ?? ""} onChange={e => set(key, e.target.value)}>
          <option value="">— เลือก —</option>{options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea rows={3} value={v[key] ?? ""} onChange={e => set(key, e.target.value)} />
      ) : (
        <input type={type} value={v[key] ?? ""} onChange={e => set(key, e.target.value)} />
      )}
    </div>
  );
  return (
    <Modal title={initial.name ? "แก้ไขครุภัณฑ์" : "เพิ่มครุภัณฑ์"} onClose={onClose} wide>
      <div className="form-grid">
        {F("assetCode", "รหัสภายใน *")}{F("assetNumber", "เลขครุภัณฑ์")}
        {F("name", "ชื่ออุปกรณ์ *")}{F("category", "ประเภท", "text", ASSET_CATEGORIES)}
        {F("brand", "ยี่ห้อ")}{F("model", "รุ่น")}{F("serial", "Serial")}
        {F("purchaseDate", "วันที่ซื้อ", "date")}{F("price", "ราคา", "number")}{F("vendor", "ผู้ขาย")}
        {F("warrantyUntil", "ประกันถึง", "date")}{F("status", "สถานะ", "text", ASSET_STATUS)}
        {F("location", "ที่เก็บ")}{F("custodian", "ผู้รับผิดชอบ")}
        <div className="span2">{F("notes", "หมายเหตุ", "textarea")}</div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" onClick={() => {
          if (!v.assetCode || !v.name) { alert("กรุณากรอกรหัสภายในและชื่ออุปกรณ์"); return; }
          onSave(v, initial); onClose();
        }}>บันทึก</button>
      </div>
    </Modal>
  );
}

function AssetDetail({ asset, patch, onClose }: { asset: Row; patch: (id: string, fn: (a: Row) => Row, audit?: any) => void; onClose: () => void }) {
  const [to, setTo] = useState(asset.status);
  const [reason, setReason] = useState("");
  const [loan, setLoan] = useState<any>({ borrower: "", contact: "", purpose: "", issuedAt: nowLocal(), dueAt: "", conditionOut: "ปกติ" });
  const history: History[] = [...(asset.history ?? [])].reverse();
  const loans: Loan[] = asset.loans ?? [];

  return (
    <Modal title={`ประวัติ: ${asset.assetCode} ${asset.name}`} onClose={onClose} wide>
      <div className="card">
        <h3>เปลี่ยนสถานะ</h3>
        <div className="row">
          <select value={to} onChange={e => setTo(e.target.value)}>{ASSET_STATUS.map(s => <option key={s}>{s}</option>)}</select>
          <input placeholder="เหตุผล / หมายเหตุ" value={reason} onChange={e => setReason(e.target.value)} />
          <button className="btn primary" onClick={() => {
            if (to === asset.status) return;
            patch(asset.id, a => ({ ...a, status: to, history: [...(a.history ?? []), { at: nowISO(), from: a.status, to, reason }] }),
              { action: "เปลี่ยนสถานะครุภัณฑ์", entity: "ครุภัณฑ์", entityId: asset.id, summary: `${asset.assetCode}: ${asset.status} → ${to}` });
            setReason("");
          }}>บันทึกสถานะ</button>
        </div>
      </div>

      <div className="card">
        <h3>การยืม-คืน</h3>
        <table className="table">
          <thead><tr><th>ผู้ยืม</th><th>วัตถุประสงค์</th><th>ยืมเมื่อ</th><th>กำหนดคืน</th><th>คืนแล้ว</th><th></th></tr></thead>
          <tbody>
            {loans.map(l => (
              <tr key={l.id}>
                <td>{l.borrower}</td><td>{l.purpose}</td><td>{fmtDateTime(l.issuedAt)}</td>
                <td>{fmtDateTime(l.dueAt)} {!l.returnedAt && l.dueAt && new Date(l.dueAt) < new Date() && <Badge>เกินกำหนด</Badge>}</td>
                <td>{l.returnedAt ? fmtDateTime(l.returnedAt) : "-"}</td>
                <td>{!l.returnedAt && (
                  <button className="btn" onClick={() => {
                    const cond = prompt("สภาพตอนคืน", "ปกติ") ?? "ปกติ";
                    patch(asset.id, a => ({
                      ...a, status: "ว่าง/พร้อมใช้งาน",
                      loans: a.loans.map((x: Loan) => x.id === l.id ? { ...x, returnedAt: nowISO(), conditionIn: cond } : x),
                      history: [...(a.history ?? []), { at: nowISO(), from: a.status, to: "ว่าง/พร้อมใช้งาน", reason: `รับคืนจาก ${l.borrower}` }],
                    }), { action: "รับคืนครุภัณฑ์", entity: "ครุภัณฑ์", entityId: asset.id, summary: `${asset.assetCode} จาก ${l.borrower}` });
                  }}>รับคืน</button>
                )}</td>
              </tr>
            ))}
            {loans.length === 0 && <tr><td colSpan={6} className="muted center">ยังไม่มีการยืม</td></tr>}
          </tbody>
        </table>
        <div className="form-grid">
          <div className="field"><label>ผู้ยืม *</label><input value={loan.borrower} onChange={e => setLoan({ ...loan, borrower: e.target.value })} /></div>
          <div className="field"><label>ช่องทางติดต่อ</label><input value={loan.contact} onChange={e => setLoan({ ...loan, contact: e.target.value })} /></div>
          <div className="field"><label>วัตถุประสงค์</label><input value={loan.purpose} onChange={e => setLoan({ ...loan, purpose: e.target.value })} /></div>
          <div className="field"><label>วันที่ยืม</label><input type="datetime-local" value={loan.issuedAt} onChange={e => setLoan({ ...loan, issuedAt: e.target.value })} /></div>
          <div className="field"><label>กำหนดคืน</label><input type="datetime-local" value={loan.dueAt} onChange={e => setLoan({ ...loan, dueAt: e.target.value })} /></div>
          <div className="field"><label>สภาพตอนยืม</label><input value={loan.conditionOut} onChange={e => setLoan({ ...loan, conditionOut: e.target.value })} /></div>
        </div>
        <button className="btn primary" onClick={() => {
          if (!loan.borrower) { alert("ระบุผู้ยืมก่อน"); return; }
          const l: Loan = { id: uid(), ...loan };
          patch(asset.id, a => ({
            ...a, status: "ถูกยืม", loans: [...(a.loans ?? []), l],
            history: [...(a.history ?? []), { at: nowISO(), from: a.status, to: "ถูกยืม", reason: `ยืมโดย ${l.borrower}: ${l.purpose}` }],
          }), { action: "ยืมครุภัณฑ์", entity: "ครุภัณฑ์", entityId: asset.id, summary: `${asset.assetCode} → ${l.borrower}` });
          setLoan({ borrower: "", contact: "", purpose: "", issuedAt: nowLocal(), dueAt: "", conditionOut: "ปกติ" });
        }}>บันทึกการยืม</button>
      </div>

      <div className="card">
        <h3>ประวัติสถานะย้อนหลัง</h3>
        <table className="table">
          <thead><tr><th>เวลา</th><th>จาก</th><th>เป็น</th><th>เหตุผล</th></tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}><td>{fmtDateTime(h.at)}</td><td>{h.from}</td><td><Badge>{h.to}</Badge></td><td>{h.reason}</td></tr>
            ))}
            {history.length === 0 && <tr><td colSpan={4} className="muted center">ยังไม่มีประวัติ</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}