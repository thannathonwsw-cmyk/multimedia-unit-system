import React, { useMemo, useState } from "react";
import { DB } from "../types";
import { Session } from "../lib/auth";
import { Badge, fmtDateTime } from "../ui";

export type Alert = { level: "danger" | "warn" | "info"; title: string; detail: string; tab: string };

const DAY = 86400000;
const t = (s?: string) => (s ? new Date(s).getTime() : NaN);
const daysUntil = (s?: string) => Math.ceil((t(s) - Date.now()) / DAY);
const OPEN = ["ใหม่", "รับเรื่องแล้ว", "กำลังดำเนินการ", "รอข้อมูลเพิ่ม", "รอตรวจงาน"];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const THAI_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function computeAlerts(db: DB): Alert[] {
  const out: Alert[] = [];
  for (const r of db.requests ?? []) {
    if (!OPEN.includes(r.status)) continue;
    const d = daysUntil(r.dueAt);
    if (!isNaN(d)) {
      if (d < 0) out.push({ level: "danger", title: `เลยกำหนด ${Math.abs(d)} วัน: ${r.title}`, detail: `กำหนด ${fmtDateTime(r.dueAt)} • ${r.requesterDept || "-"}`, tab: "requests" });
      else if (d <= 7) out.push({ level: "warn", title: `ครบกำหนดใน ${d} วัน: ${r.title}`, detail: `กำหนด ${fmtDateTime(r.dueAt)} • สถานะ ${r.status}`, tab: "requests" });
    }
    const stale = Math.floor((Date.now() - t(r.updatedAt)) / DAY);
    if (["กำลังดำเนินการ", "รอข้อมูลเพิ่ม"].includes(r.status) && stale >= 14)
      out.push({ level: "warn", title: `งานไม่เคลื่อนไหว ${stale} วัน: ${r.title}`, detail: `สถานะ ${r.status}`, tab: "requests" });
  }
  for (const a of db.assets ?? []) {
    for (const l of a.loans ?? []) {
      if (l.returnedAt) continue;
      const d = daysUntil(l.dueAt);
      if (!isNaN(d)) {
        if (d < 0) out.push({ level: "danger", title: `คืนเกินกำหนด ${Math.abs(d)} วัน: ${a.assetCode} ${a.name}`, detail: `ผู้ยืม ${l.borrower} • กำหนด ${fmtDateTime(l.dueAt)}`, tab: "assets" });
        else if (d <= 7) out.push({ level: "warn", title: `ครบกำหนดคืนใน ${d} วัน: ${a.assetCode} ${a.name}`, detail: `ผู้ยืม ${l.borrower}`, tab: "assets" });
      } else {
        out.push({ level: "info", title: `ยังไม่ได้กำหนดวันคืน: ${a.assetCode} ${a.name}`, detail: `ผู้ยืม ${l.borrower}`, tab: "assets" });
      }
    }
    const last = Math.max(t(a.updatedAt) || 0, ...((a.history ?? []).map((h: any) => t(h.at) || 0).concat([0])));
    const idle = Math.floor((Date.now() - last) / DAY);
    if (idle >= 90 && !["ตัดจำหน่าย", "สูญหาย"].includes(a.status))
      out.push({ level: "info", title: `ครุภัณฑ์ไม่อัปเดตสถานะ ${idle} วัน: ${a.assetCode} ${a.name}`, detail: `สถานะปัจจุบัน ${a.status}`, tab: "assets" });
    const w = daysUntil(a.warrantyUntil);
    if (!isNaN(w) && w >= 0 && w <= 60)
      out.push({ level: "info", title: `ประกันใกล้หมดใน ${w} วัน: ${a.assetCode} ${a.name}`, detail: `หมดประกัน ${fmtDateTime(a.warrantyUntil)}`, tab: "assets" });
  }
  const order: any = { danger: 0, warn: 1, info: 2 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}

export default function Dashboard({ db, session, goTab }: { db: DB; session: Session; goTab: (t: string) => void }) {
  const alerts = computeAlerts(db);
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState<string | null>(key(now));

  const events = useMemo(() => {
    const map: Record<string, { type: string; label: string }[]> = {};
    const add = (s: string | undefined, type: string, label: string) => {
      if (!s) return; const d = new Date(s); if (isNaN(+d)) return;
      const k = key(d); (map[k] = map[k] || []).push({ type, label });
    };
    (db.requests ?? []).forEach(r => { if (OPEN.includes(r.status)) add(r.dueAt, "due", `ครบกำหนดส่ง: ${r.title}`); });
    (db.requests ?? []).forEach(r => { if (r.status === "เสร็จสิ้น") add(r.completedAt, "done", `ส่งงานแล้ว: ${r.title}`); });
    (db.assets ?? []).forEach(a => (a.loans ?? []).forEach((l: any) => { if (!l.returnedAt) add(l.dueAt, "ret", `กำหนดคืน: ${a.assetCode} ${a.name} (${l.borrower})`); }));
    (db.worklogs ?? []).forEach(w => add(w.workAt, "work", `งาน: ${w.title}`));
    return map;
  }, [db]);

  const reqs = db.requests ?? [];
  const openReqs = reqs.filter(r => OPEN.includes(r.status));
  const due7 = openReqs.filter(r => { const d = daysUntil(r.dueAt); return !isNaN(d) && d >= 0 && d <= 7; }).length;
  const overdue = openReqs.filter(r => { const d = daysUntil(r.dueAt); return !isNaN(d) && d < 0; }).length;
  const loansOpen = (db.assets ?? []).flatMap(a => (a.loans ?? []).filter((l: any) => !l.returnedAt).map((l: any) => ({ a, l })));
  const loansOver = loansOpen.filter(x => { const d = daysUntil(x.l.dueAt); return !isNaN(d) && d < 0; }).length;
  const published = (db.portfolio ?? []).filter(p => p.status === "เผยแพร่").length;

  const firstDow = new Date(cur.y, cur.m, 1).getDay();
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayKey = key(now);
  const selItems = sel ? (events[sel] ?? []) : [];

  const ongoing = [...openReqs].sort((a, b) => String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999"))).slice(0, 6);
  const recent = (db.audit ?? []).slice(0, 6);

  return (
    <div>
      <div className="page-head">
        <h2>ภาพรวมงาน • {session.displayName}</h2>
        <span className="muted">{now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => goTab("requests")}><div className="num">{openReqs.length}</div><div className="lbl">งานค้างดำเนินการ</div></div>
        <div className="stat-card warn" onClick={() => goTab("requests")}><div className="num">{due7}</div><div className="lbl">ครบกำหนดใน 7 วัน</div></div>
        <div className="stat-card danger" onClick={() => goTab("requests")}><div className="num">{overdue}</div><div className="lbl">เลยกำหนดส่ง</div></div>
        <div className="stat-card" onClick={() => goTab("assets")}><div className="num">{loansOpen.length}</div><div className="lbl">อุปกรณ์ถูกยืมอยู่</div></div>
        <div className="stat-card danger" onClick={() => goTab("assets")}><div className="num">{loansOver}</div><div className="lbl">คืนเกินกำหนด</div></div>
        <div className="stat-card" onClick={() => goTab("portfolio")}><div className="num">{published}</div><div className="lbl">ผลงานเผยแพร่</div></div>
      </div>

      <div className="dash-grid">
        <div>
          <div className="card">
            <h3>📅 ปฏิทินงาน</h3>
            <div className="row" style={{ marginBottom: 8 }}>
              <button className="icon-btn" onClick={() => setCur(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 })}>‹</button>
              <b>{THAI_MONTH[cur.m]} {cur.y + 543}</b>
              <button className="icon-btn" onClick={() => setCur(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 })}>›</button>
              <button className="btn" onClick={() => { setCur({ y: now.getFullYear(), m: now.getMonth() }); setSel(todayKey); }}>เดือนนี้</button>
            </div>
            <div className="cal">
              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => <div className="dow" key={d}>{d}</div>)}
              {cells.map((d, i) => {
                if (d === null) return <div className="cal-day blank" key={"b" + i} />;
                const k = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const evs = events[k] ?? [];
                return (
                  <div key={k} className={"cal-day" + (k === todayKey ? " today" : "") + (sel === k ? " sel" : "")} onClick={() => setSel(k)}>
                    {d}
                    <span className="dots">
                      {["due", "ret", "work", "done"].filter(tp => evs.some(e => e.type === tp)).map(tp => <span className={"dot " + tp} key={tp} />)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span><i className="dot due" /> ครบกำหนดส่ง</span>
              <span><i className="dot ret" /> กำหนดคืนอุปกรณ์</span>
              <span><i className="dot work" /> นัด/ทำงาน</span>
              <span><i className="dot done" /> ส่งงานแล้ว</span>
            </div>
            {sel && (
              <div style={{ marginTop: 10 }}>
                <b>วันที่ {sel.split("-")[2]}/{sel.split("-")[1]}/{Number(sel.split("-")[0]) + 543}</b>
                {selItems.length === 0 ? <p className="muted">ไม่มีรายการในวันนี้</p> : (
                  <ul style={{ margin: "6px 0", paddingLeft: 18 }}>
                    {selItems.map((e, i) => <li key={i}>{e.label}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3>🕒 กิจกรรมล่าสุด</h3>
            {recent.length === 0 ? <p className="muted">ยังไม่มีกิจกรรม</p> : recent.map(r => (
              <div className="alert-row info" key={r.id}>
                <div><div className="t">{r.action}</div><div className="d">{fmtDateTime(r.at)} • {r.username} • {r.summary || r.entity}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>🔔 การแจ้งเตือน ({alerts.length})</h3>
            {alerts.length === 0 ? <p className="muted">ไม่มีเรื่องค้างเคลียร์ 🎉</p> : alerts.slice(0, 10).map((a, i) => (
              <div className={"alert-row " + a.level} key={i} style={{ cursor: "pointer" }} onClick={() => goTab(a.tab)}>
                <div><div className="t">{a.level === "danger" ? "🔴" : a.level === "warn" ? "🟠" : "🔵"} {a.title}</div><div className="d">{a.detail}</div></div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>⚙️ งานที่กำลังดำเนินการ</h3>
            {ongoing.length === 0 ? <p className="muted">ไม่มีงานค้าง</p> : ongoing.map(r => (
              <div className="alert-row info" key={r.id}>
                <div style={{ flex: 1 }}>
                  <div className="t">{r.title}</div>
                  <div className="d">กำหนด {fmtDateTime(r.dueAt)} • <Badge>{r.status}</Badge></div>
                </div>
                <button className="btn" onClick={() => goTab("requests")}>เปิด</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}