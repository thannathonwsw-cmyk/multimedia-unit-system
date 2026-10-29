import React, { useState } from "react";
import { DB } from "../types";
import { fmtDateTime, Badge, downloadBlob } from "../ui";

export default function Audit({ db }: { db: DB }) {
  const [q, setQ] = useState("");
  const rows = (db.audit ?? []).filter(r =>
    !q || [r.username, r.action, r.entity, r.summary].some(v => String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  function exportCsv() {
    const head = "เวลา,ผู้ใช้,การกระทำ,หมวดข้อมูล,รายละเอียด";
    const lines = rows.map(r => [r.at, r.username, r.action, r.entity, (r.summary ?? "").replace(/,/g, " ")].join(","));
    downloadBlob(`audit-${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob(["\uFEFF" + [head, ...lines].join("\n")], { type: "text/csv" }));
  }

  return (
    <div>
      <div className="page-head">
        <h2>ประวัติการแก้ไข / การใช้งานระบบ <span className="muted">({rows.length} รายการ)</span></h2>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="filters"><input placeholder="ค้นหาผู้ใช้ / การกระทำ / รายละเอียด..." value={q} onChange={e => setQ(e.target.value)} /></div>
      <table className="table">
        <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>หมวดข้อมูล</th><th>รายละเอียด</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{fmtDateTime(r.at)}</td>
              <td>{r.username}</td>
              <td><Badge>{r.action}</Badge></td>
              <td>{r.entity}</td>
              <td>{r.summary || "-"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted center">ยังไม่มีประวัติ</td></tr>}
        </tbody>
      </table>
    </div>
  );
}