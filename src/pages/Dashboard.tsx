import React, { useMemo, useState } from "react";
import { DB, Row, STAFF_COLORS } from "../types";
import { Session } from "../lib/auth";
import { fmtDateTime, Badge } from "../ui";

export interface AlertItem { icon: string; text: string; sub: string; persons?: string[]; tab?: string; id?: string; level?: string }

export function computeAlerts(db: DB): AlertItem[] {
  const out: AlertItem[] = [];
  const now = Date.now();
  const week = 7 * 86400000;
  const names = (r: Row) => [r.assignee1, r.assignee2, r.assignee3].filter(Boolean) as string[];
  for (const r of db.requests) {
    if (["เสร็จสิ้น", "ยกเลิก"].includes(r.status)) continue;
    if (!r.dueAt) continue;
    const t = new Date(r.dueAt).getTime();
    if (t < now) out.push({ icon: "🔴", text: `เลยกำหนดส่ง: ${r.title}`, sub: `กำหนด ${fmtDateTime(r.dueAt)} • สถานะ ${r.status}`, persons: names(r), tab: "requests", id: r.id , level: "over"});
    else if (t - now < week) out.push({ icon: "🟠", text: `ครบกำหนดใน ${Math.max(1, Math.ceil((t - now) / 86400000))} วัน: ${r.title}`, sub: `กำหนด ${fmtDateTime(r.dueAt)} • สถานะ ${r.status}`, persons: names(r), tab: "requests", id: r.id , level: "warn"});
  }
  for (const a of db.assets) for (const b of (a.borrows ?? [])) {
    if (b.returnedAt || !b.dueAt) continue;
    const t = new Date(b.dueAt).getTime();
          if (t < now) out.push({ icon: "🔴", text: `คืนเกินกำหนด: ${a.name}`, sub: `ผู้ยืม ${b.borrower} • กำหนด ${fmtDateTime(b.dueAt)}`, persons: [b.borrower], tab: "assets", id: a.id , level: "over" });
          else if (t - now < week) out.push({ icon: "🟠", text: `ครบกำหนดคืนใน ${Math.max(1, Math.ceil((t - now) / 86400000))} วัน: ${a.name}`, sub: `ผู้ยืม ${b.borrower}`, persons: [b.borrower], tab: "assets", id: a.id , level: "warn" });
  }
  return out;
}

type Ev = { id: string; kind: string; title: string; date: string; from?: string; to?: string; persons: string[]; color: string; status?: string };
type Props = { db: DB; session: Session; goTab: (t: string) => void; mine?: boolean };

export default function Dashboard({ db, session, goTab, mine }: Props) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [dayView, setDayView] = useState<string | null>(null);

  const staffNames = useMemo(() => db.staff.map(s => `${s.firstName} ${s.lastName}`), [db.staff]);
  const colorOf = (name?: string) => {
    if (!name) return "#94a3b8";
    const i = staffNames.indexOf(name);
    return i < 0 ? "#94a3b8" : (db.staff[i].color || STAFF_COLORS[i % STAFF_COLORS.length]);
  };
  const myName = useMemo(() => {
    const s = db.staff.find(st => st.username && st.username === session.username);
    return s ? `${s.firstName} ${s.lastName}` : undefined;
  }, [db.staff, session.username]);

  const namesOf = (r: Row) => [r.assignee1, r.assignee2, r.assignee3].filter(Boolean) as string[];

  const allEvents = useMemo<Ev[]>(() => {
    const evs: Ev[] = [];
    for (const r of db.requests) {
      const persons = namesOf(r);
      const color = colorOf(persons[0]);
      if (r.dueAt) evs.push({ id: "qd" + r.id, kind: "กำหนดส่ง", title: r.title, date: r.dueAt, from: r.dueAt, persons, color, status: r.status });
      if (r.receivedAt) evs.push({ id: "qr" + r.id, kind: "รับงาน", title: r.title, date: r.receivedAt, persons, color, status: r.status });
    }
    for (const w of db.worklogs) {
      const d = (w as any).date || (w as any).finishedAt || w.createdAt;
      if (!d) continue;
      const persons = namesOf(w);
      evs.push({ id: "w" + w.id, kind: "งานผลิต", title: (w as any).title || "งานย้อนหลัง", date: d, from: (w as any).timeFrom, to: (w as any).timeTo, persons, color: colorOf(persons[0]) });
    }
    for (const a of db.assets) for (const b of (a.borrows ?? [])) {
      if (!b.dueAt || b.returnedAt) continue;
      evs.push({ id: "b" + b.id, kind: "กำหนดคืน", title: a.name, date: b.dueAt, from: b.dueAt, persons: [b.borrower], color: colorOf(b.borrower) });
    }
    return evs;
  }, [db, staffNames]);

  const events = useMemo(() => (mine && myName ? allEvents.filter(e => e.persons.includes(myName)) : allEvents), [allEvents, mine, myName]);

  const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const hhmm = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 5) : "");

  const first = new Date(cursor.y, cursor.m, 1);
  const startIdx = (first.getDay() + 6) % 7;
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startIdx).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const evOf = (day: number) => events.filter(e => dayKey(e.date) === `${monthPrefix}-${String(day).padStart(2, "0")}`);
  const todayKey = dayKey(new Date().toISOString());
  const dayEvents = dayView ? events.filter(e => dayKey(e.date) === dayView).sort((a, b) => (a.from ?? "99").localeCompare(b.from ?? "99")) : [];

  const ongoing = db.requests.filter(r => r.status === "กำลังดำเนินการ");
  const alerts = computeAlerts(db).filter(a => !mine || !myName || (a.persons ?? []).includes(myName));
  const now = Date.now();
  const due7 = db.requests.filter(r => !["เสร็จสิ้น", "ยกเลิก"].includes(r.status) && r.dueAt && new Date(r.dueAt).getTime() > now && new Date(r.dueAt).getTime() - now < 7 * 86400000).length;
  const overdue = db.requests.filter(r => !["เสร็จสิ้น", "ยกเลิก"].includes(r.status) && r.dueAt && new Date(r.dueAt).getTime() < now).length;
  const onLoan = db.assets.filter(a => (a.borrows ?? []).some((b: any) => !b.returnedAt)).length;
  const loanOver = db.assets.reduce((n, a) => n + (a.borrows ?? []).filter((b: any) => !b.returnedAt && b.dueAt && new Date(b.dueAt).getTime() < now).length, 0);
  const published = db.portfolio.filter(p => p.status === "เผยแพร่").length;
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const thDate = (key: string) => new Date(key + "T00:00:00").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const Persons = ({ list }: { list: string[] }) => (
    <span className="muted" style={{ fontSize: ".85em" }}>
      {list.length
        ? list.map(n => <span key={n} style={{ marginRight: 8, whiteSpace: "nowrap" }}><i className="pdot" style={{ background: colorOf(n) }} />{n}</span>)
        : <span>ยังไม่ระบุผู้รับผิดชอบ</span>}
    </span>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2>ภาพรวมงาน • {session.displayName}{mine && myName ? ` (เฉพาะงานของ ${myName})` : ""}</h2>
        <span className="muted">{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {([
          [ongoing.length, "งานค้างดำเนินการ", "#6d8bff"],
          [due7, "ครบกำหนดใน 7 วัน", "#f59e0b"],
          [overdue, "เลยกำหนดส่ง", "#ef4444"],
          [onLoan, "อุปกรณ์ถูกยืมอยู่", "#6d8bff"],
          [loanOver, "คืนเกินกำหนด", "#ef4444"],
          [published, "ผลงานเผยแพร่", "#a06bff"],
        ] as [number, string, string][]).map(([n, label, c], i) => (
          <div key={i} className="card stat-card">
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: c }}>{n}</div>
            <div className="muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 14 }}>
        <div className="card">
          {!dayView ? (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>📅 ปฏิทินงาน {monthLabel}</h3>
                <span className="row">
                  <button className="icon-btn" onClick={() => setCursor(c => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))}>‹</button>
                  <button className="icon-btn" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>เดือนนี้</button>
                  <button className="icon-btn" onClick={() => setCursor(c => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}>›</button>
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 10 }}>
                {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => <div key={d} className="muted" style={{ textAlign: "center", fontSize: ".8em" }}>{d}</div>)}
                {cells.map((d, i) => d === null ? <div key={"e" + i} /> : (
                  <button key={d} className={"cal-cell" + (dayKey(new Date(cursor.y, cursor.m, d).toISOString()) === todayKey ? " today" : "")}
                    onClick={() => setDayView(`${monthPrefix}-${String(d).padStart(2, "0")}`)}>
                    {d}
                    <span className="cal-dots">
                      {Array.from(new Set(evOf(d).map(e => e.color))).slice(0, 4).map(c => <i key={c} style={{ background: c }} />)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                {db.staff.map((s, i) => (
                  <span key={s.id} className="muted" style={{ fontSize: ".85em" }}>
                    <i className="pdot" style={{ background: s.color || STAFF_COLORS[i % STAFF_COLORS.length] }} />{s.firstName} {s.lastName}
                  </span>
                ))}
                <span className="muted" style={{ fontSize: ".8em" }}>• แตะวันที่เพื่อดูงานรายวัน</span>
              </div>
            </>
          ) : (
            <>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <h3>🗓️ {thDate(dayView)}</h3>
                <button className="btn" onClick={() => setDayView(null)}>← กลับปฏิทินเดือน</button>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {dayEvents.map(e => (
                  <div key={e.id} className="day-bar" style={{ borderLeftColor: e.color }}>
                    <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                      <strong>{e.title}</strong>
                      <Badge>{e.kind}</Badge>
                    </div>
                    <div className="muted" style={{ fontSize: ".9em" }}>
                      🕒 {e.from && e.to ? `${hhmm(e.from)} – ${hhmm(e.to)}` : e.from ? hhmm(e.from) : "ทั้งวัน"}
                      {e.status ? ` • ${e.status}` : ""}
                    </div>
                    <Persons list={e.persons} />
                  </div>
                ))}
                {dayEvents.length === 0 && <div className="muted">ไม่มีรายการในวันนี้</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div className="card">
            <h3>🔔 การแจ้งเตือน ({alerts.length})</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} className="day-bar alert-click" style={{ borderLeftColor: a.icon === "🔴" ? "#ef4444" : "#f59e0b" }}
                  title="คลิกเพื่อเปิดหน้างานนี้" onClick={() => a.tab && goTab(a.tab)}>
                  <div>{a.icon} <strong>{a.text}</strong></div>
                  <div className="muted" style={{ fontSize: ".85em" }}>{a.sub}</div>
                  <Persons list={a.persons ?? []} />
                </div>
              ))}
              {alerts.length === 0 && <div className="muted">ไม่มีการแจ้งเตือน</div>}
            </div>
          </div>

          <div className="card">
            <h3>⚙️ งานที่กำลังดำเนินการ</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {ongoing.map(r => (
                <div key={r.id} className="day-bar" style={{ borderLeftColor: colorOf(namesOf(r)[0]) }}>
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <strong>{r.title}</strong>
                    <button className="btn" onClick={() => goTab("requests")}>เปิด</button>
                  </div>
                  <div className="muted" style={{ fontSize: ".85em" }}>กำหนด {r.dueAt ? fmtDateTime(r.dueAt) : "-"}</div>
                  <Persons list={namesOf(r)} />
                </div>
              ))}
              {ongoing.length === 0 && <div className="muted">ไม่มีงานค้าง</div>}
            </div>
          </div>

          <div className="card">
            <h3>🕘 กิจกรรมล่าสุด</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {db.audit.slice(-6).reverse().map(a => (
                <div key={a.id} className="day-bar" style={{ borderLeftColor: "#6d8bff" }}>
                  <strong>{a.action}</strong>
                  <div className="muted" style={{ fontSize: ".85em" }}>{fmtDateTime(a.at)} • {a.username} • {a.summary ?? ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}