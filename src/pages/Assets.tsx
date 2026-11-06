import React, { useMemo, useState } from "react";
import { DB, Row, uid, nowISO } from "../types";
import { Session, can } from "../lib/auth";
import { fmtDateTime, Badge, useFocusScroll } from "../ui";
import { uploadAttachment, downloadAttachment, filenConnected } from "../lib/filen";

const ASSET_TYPES = ["กล้องวิดีโอ", "กล้องถ่ายภาพ", "เลนส์", "ขาตั้ง", "ไฟสตูดิโอ", "ไมโครโฟน", "คอมพิวเตอร์", "โดรน", "อื่น ๆ"];
const ASSET_STATUS = ["อยู่ในคลัง", "ถูกยืม", "ส่งซ่อม", "ชำรุด"];
type Borrow = { id: string; borrower: string; dept?: string; borrowAt: string; dueAt?: string; returnedAt?: string; state?: string };

type Props = { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session };

export default function Assets({ db, update, session }: Props) {
    useFocusScroll(db.assets.length);
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("");
  const [cat, setCat] = useState("");
  const [draft, setDraft] = useState<Row | null>(null);
  const [borrowFor, setBorrowFor] = useState<Row | null>(null);
  const [borrower, setBorrower] = useState("");
  const [dueAt, setDueAt] = useState("");
    const [borrowAt, setBorrowAt] = useState("");
  const [dept, setDept] = useState("");
  const [returnTimes, setReturnTimes] = useState<Record<string, string>>({});
  const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const toISO = (v: string) => (v ? new Date(v).toISOString() : undefined);

  const staffOptions = db.staff.map(s => `${s.firstName} ${s.lastName}`);
  const categories = useMemo(() => Array.from(new Set(db.assets.map(a => a.category || "อื่น ๆ"))), [db.assets]);
  const openCount = (a: Row) => (a.borrows ?? []).filter((b: Borrow) => !b.returnedAt).length;

  const filtered = db.assets.filter(a => {
    if (person && (a.holder || "ยังไม่ระบุ") !== person) return false;
    if (cat && (a.category || "อื่น ๆ") !== cat) return false;
    if (q) {
      const t = q.toLowerCase();
      if (![a.name, a.assetCode, a.holder, a.location, a.type, a.year].some(v => String(v ?? "").toLowerCase().includes(t))) return false;
    }
    return true;
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const a of filtered) { const c = a.category || "อื่น ๆ"; m.set(c, [...(m.get(c) ?? []), a]); }
    return Array.from(m.entries());
  }, [filtered]);

  const blank = (): Row => ({ id: uid(), createdAt: nowISO(), updatedAt: nowISO(), year: "", assetCode: "", name: "", type: ASSET_TYPES[0], category: "", holder: "", status: ASSET_STATUS[0], location: "", borrows: [], atts: [] });
  const set = (k: string, v: any) => setDraft(d => (d ? { ...d, [k]: v } : d));

  function saveDraft() {
    if (!draft) return;
    if (!String(draft.name ?? "").trim()) { alert("กรอกชื่ออุปกรณ์"); return; }
    const exists = db.assets.some(a => a.id === draft.id);
    update(d => ({
      ...d,
      assets: exists ? d.assets.map(a => (a.id === draft.id ? { ...draft, updatedAt: nowISO() } : a)) : [{ ...draft, updatedAt: nowISO() }, ...d.assets],
    }), { action: exists ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์", entity: "ครุภัณฑ์", summary: `${draft.name} [หมวด: ${draft.category || "อื่น ๆ"}]` });
    setDraft(null);
  }

  function removeAsset(id: string) {
    if (!confirm("ลบรายการอุปกรณ์นี้?")) return;
    update(d => ({ ...d, assets: d.assets.filter(a => a.id !== id) }), { action: "ลบอุปกรณ์", entity: "ครุภัณฑ์", summary: id });
  }

    function addBorrow(row: Row) {
    if (!borrower.trim()) { alert("กรอกชื่อผู้ยืม"); return; }
    const b: Borrow = {
      id: uid(), borrower: borrower.trim(), dept: dept.trim() || undefined,
      borrowAt: toISO(borrowAt) ?? nowISO(), dueAt: toISO(dueAt), returnedAt: undefined, state: "active",
    };
    update(d => ({ ...d, assets: d.assets.map(a => (a.id === row.id ? { ...a, status: "ถูกยืม", borrows: [...(a.borrows ?? []), b] } : a)) }),
      { action: "ยืมอุปกรณ์", entity: "ครุภัณฑ์", summary: `${row.name} → ${borrower.trim()} (${dept.trim() || "ไม่ระบุหน่วยงาน"})` });
    setBorrower(""); setDueAt(""); setDept(""); setBorrowAt(""); setBorrowFor(null);
  }

    function returnBorrow(row: Row, bid: string, atISO?: string) {
    update(d => ({
      ...d,
      assets: d.assets.map(a => {
        if (a.id !== row.id) return a;
        const borrows = (a.borrows ?? []).map((b: Borrow) => (b.id === bid ? { ...b, returnedAt: atISO ?? nowISO() } : b));
        return { ...a, borrows, status: borrows.some((b: Borrow) => !b.returnedAt) ? "ถูกยืม" : "อยู่ในคลัง" };
      }),
    }), { action: "คืนอุปกรณ์", entity: "ครุภัณฑ์", summary: row.name });
  }

    function confirmBorrow(row: Row, bid: string) {
    if (!confirm("ยืนยันว่าได้ตรวจสภาพอุปกรณ์และอนุมัติให้ยืมแล้ว?")) return;
    update(d => ({
      ...d,
      assets: d.assets.map(a => (a.id === row.id ? {
        ...a, status: "ถูกยืม",
        borrows: (a.borrows ?? []).map((b: Borrow) => (b.id === bid ? { ...b, state: "active" } : b)),
      } : a)),
    }), { action: "ยืนยันการยืม", entity: "ครุภัณฑ์", summary: `${row.name} → ${(row.borrows ?? []).find((b: Borrow) => b.id === bid)?.borrower ?? ""}` });
  }

  function cancelBorrow(row: Row, bid: string) {
    if (!confirm("ยกเลิกคำขอยืมนี้?")) return;
    update(d => ({
      ...d,
      assets: d.assets.map(a => (a.id === row.id ? { ...a, borrows: (a.borrows ?? []).filter((b: Borrow) => b.id !== bid) } : a)),
    }), { action: "ยกเลิกคำขอยืม", entity: "ครุภัณฑ์", summary: row.name });
  }

  async function attach(f: File, rowId: string) {
    try {
      const path = await uploadAttachment(f, "assets", rowId);
      const att = { id: uid(), name: f.name, path, size: f.size };
      update(d => ({ ...d, assets: d.assets.map(a => (a.id === rowId ? { ...a, atts: [...(a.atts ?? []), att] } : a)) }),
        { action: "แนบไฟล์อุปกรณ์", entity: "ครุภัณฑ์", summary: f.name });
      setDraft(dd => (dd ? { ...dd, atts: [...(dd.atts ?? []), att] } : dd));
    } catch (e: any) { alert("แนบไฟล์ไม่สำเร็จ: " + (e?.message ?? e)); }
  }

  const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3> การยืม-คืนอุปกรณ์ ({filtered.length} รายการ)</h3>
          {can.edit(session.role) && <button className="btn primary" onClick={() => setDraft(blank())}>+ เพิ่มรายการ</button>}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <select value={person} onChange={e => setPerson(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">👥 ภาพรวมอุปกรณ์ทั้งหมดของหน่วย</option>
            {staffOptions.map(n => <option key={n} value={n}>👤 {n}</option>)}
            <option value="ยังไม่ระบุ">ยังไม่ระบุผู้รับผิดชอบ</option>
          </select>
          <input placeholder="ค้นหาชื่อ / เลขครุภัณฑ์ / ผู้ถือ..." value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <button className={cat === "" ? "btn primary" : "btn"} onClick={() => setCat("")}>ทุกหมวดหมู่</button>
          {categories.map(c => (
            <button key={c} className={cat === c ? "btn primary" : "btn"} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      {draft && (
        <div className="card">
          <h3>{db.assets.some(a => a.id === draft.id) ? "✏️ แก้ไขอุปกรณ์" : "➕ เพิ่มอุปกรณ์ใหม่"}</h3>
          <div style={grid}>
            <input placeholder="รหัส (ปี พ.ศ.)" value={draft.year ?? ""} onChange={e => set("year", e.target.value)} />
            <input placeholder="เลขครุภัณฑ์" value={draft.assetCode ?? ""} onChange={e => set("assetCode", e.target.value)} />
            <input placeholder="ชื่ออุปกรณ์ *" value={draft.name ?? ""} onChange={e => set("name", e.target.value)} />
            <select value={draft.type ?? ASSET_TYPES[0]} onChange={e => set("type", e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input list="cat-list" placeholder="หมวดหมู่ (พิมพ์ใหม่ได้ทันที)" value={draft.category ?? ""} onChange={e => set("category", e.target.value)} />
            <select value={draft.holder ?? ""} onChange={e => set("holder", e.target.value)}>
              <option value="">— ผู้รับผิดชอบอุปกรณ์ —</option>
              {staffOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={draft.status ?? ASSET_STATUS[0]} onChange={e => set("status", e.target.value)}>
              {ASSET_STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="ที่เก็บ" value={draft.location ?? ""} onChange={e => set("location", e.target.value)} />
          </div>
          <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
          {db.assets.some(a => a.id === draft.id) && filenConnected() && (
            <div className="row" style={{ marginTop: 8 }}>
              <label className="btn">📎 แนบรูป/ไฟล์อุปกรณ์
                <input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) attach(f, draft.id); e.target.value = ""; }} />
              </label>
              <span className="muted">{(draft.atts ?? []).length} ไฟล์</span>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={saveDraft}>บันทึก</button>
            <button className="btn" onClick={() => setDraft(null)}>ยกเลิก</button>
          </div>
        </div>
      )}

            {borrowFor && (
        <div className="card">
          <h3>🔄 ประวัติยืม-คืน: {borrowFor.name}</h3>
          <table>
            <thead><tr><th>ผู้ยืม</th><th>หน่วยงาน</th><th>เวลายืม</th><th>กำหนดคืน</th><th>สถานะ / คืนเมื่อ</th><th></th></tr></thead>
            <tbody>
              {(borrowFor.borrows ?? []).slice().reverse().map((b: Borrow) => (
                <tr key={b.id}>
                  <td>{b.borrower}</td>
                  <td>{b.dept || "-"}</td>
                  <td>{fmtDateTime(b.borrowAt)}</td>
                  <td>{b.dueAt ? fmtDateTime(b.dueAt) : "-"}</td>
                  <td>
                    {b.returnedAt ? fmtDateTime(b.returnedAt)
                      : b.state === "pending" ? <Badge>รอยืนยันการยืม</Badge>
                      : <Badge>ค้างยืม</Badge>}
                  </td>
                  <td>
                    <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {!b.returnedAt && b.state === "pending" && (
                        <>
                          <button className="btn primary" onClick={() => confirmBorrow(borrowFor, b.id)}>✅ ยืนยันการยืม</button>
                          <button className="btn danger" onClick={() => cancelBorrow(borrowFor, b.id)}>ยกเลิกคำขอ</button>
                        </>
                      )}
                      {!b.returnedAt && b.state !== "pending" && (
                        <>
                          <input type="datetime-local" value={returnTimes[b.id] ?? nowLocal()}
                            onChange={e => setReturnTimes(m => ({ ...m, [b.id]: e.target.value }))} />
                          <button className="btn" onClick={() => returnBorrow(borrowFor, b.id, toISO(returnTimes[b.id] ?? nowLocal()))}>ยืนยันการรับคืน</button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {(borrowFor.borrows ?? []).length === 0 && <tr><td colSpan={6} className="muted">ยังไม่มีประวัติการยืม</td></tr>}
            </tbody>
          </table>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <input placeholder="ชื่อผู้ยืม" value={borrower} onChange={e => setBorrower(e.target.value)} />
            <input placeholder="หน่วยงานที่ยืมไปใช้" value={dept} onChange={e => setDept(e.target.value)} />
            <label className="muted">เวลายืม
              <input type="datetime-local" value={borrowAt} onChange={e => setBorrowAt(e.target.value)} />
            </label>
            <label className="muted">กำหนดคืน
              <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={() => addBorrow(borrowFor)}>บันทึกการยืม</button>
            <button className="btn" onClick={() => setBorrowFor(null)}>ปิด</button>
          </div>
        </div>
      )}

      {grouped.map(([c, rows]) => (
        <div key={c} className="card">
          <h3>📦 หมวด: {c} ({rows.length})</h3>
          <table>
            <thead><tr><th>รหัส</th><th>เลขครุภัณฑ์</th><th>ชื่อ</th><th>ประเภท</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>ที่เก็บ</th><th>ยืมค้าง</th><th></th></tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} data-rowid={a.id}>
                  <td>{a.year || "-"}</td>
                  <td>{a.assetCode || "-"}</td>
                  <td>{a.name}</td>
                  <td>{a.type || "-"}</td>
                  <td>{a.holder || <span className="muted">-</span>}</td>
                  <td>
                    {(a.borrows ?? []).some((b: any) => !b.returnedAt && b.state === "pending")
                      ? <Badge>รอยืนยันการยืม</Badge>
                      : <Badge>{a.status || "-"}</Badge>}
                  </td>
                  <td>{a.location || "-"}</td>
                  <td>{openCount(a) > 0 ? <Badge>{openCount(a)}</Badge> : "0"}</td>
                  <td className="row">
                    <button className="btn" onClick={() => { setBorrowFor(a); setBorrower(""); setDueAt(""); setDept(""); setBorrowAt(nowLocal()); }}>ประวัติ/ยืม-คืน</button>
                    {can.edit(session.role) && <button className="btn" onClick={() => setDraft({ ...a })}>แก้ไข</button>}
                    {can.edit(session.role) && <button className="btn danger" onClick={() => removeAsset(a.id)}>ลบ</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {grouped.length === 0 && <div className="card muted">ไม่พบอุปกรณ์ตามตัวกรองที่เลือก</div>}
    </div>
  );
}