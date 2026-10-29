import React, { useState } from "react";
import { DB } from "../types";
import { downloadBlob, fmtDateTime, Badge } from "../ui";
import { clearLocal } from "../lib/store";
import { Prefs, stepFontScale } from "../lib/prefs";
import { Session, can } from "../lib/auth";

type Props = {
  db: DB;
  update: (fn: (d: DB) => DB, audit?: any) => void;
  filenOn: boolean; connecting: boolean; lastSync?: string;
  onConnect: (email: string, password: string, twoFactor?: string) => Promise<string | null>;
  onDisconnect: () => void; onSyncNow: () => Promise<void>; onPullNow: () => Promise<void>;
  prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
  customUrl: string | null; setCustomBg: (b: Blob | null) => Promise<void>;
  session: Session; onLogout: () => void;
};

const BG_OPTIONS = [
  { key: "aurora", label: "Aurora", prev: "prev-aurora" },
  { key: "sunset", label: "Sunset", prev: "prev-sunset" },
  { key: "stars", label: "Starry Night", prev: "prev-stars" },
] as const;

export default function Settings(props: Props) {
  const { db, update, filenOn, connecting, lastSync, onConnect, onDisconnect, onSyncNow, onPullNow, prefs, setPrefs, customUrl, setCustomBg, session, onLogout } = props;
  const isAdmin = can.viewSystemSettings(session.role);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [two, setTwo] = useState("");
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");

  return (
    <div>
      <h2>ตั้งค่า</h2>

      <div className="card">
        <h3>👤 บัญชีของฉัน</h3>
        <p>เข้าสู่ระบบเป็น <b>{session.displayName}</b> ({session.username}) •
          สิทธิ์: <Badge>{session.role === "admin" ? "แอดมิน — ทั้งหมด" : "ผู้ใช้งาน — ดู/เพิ่ม/แก้ไข"}</Badge> •
          เข้าระบบเมื่อ {fmtDateTime(session.loginAt)}</p>
        <button className="btn" onClick={onLogout}>ออกจากระบบ</button>
      </div>

      <div className="card">
        <h3>🎨 รูปลักษณ์</h3>
        <div className="form-grid">
          <div className="field">
            <label>ธีมสี</label>
            <div className="seg">
              <button className={prefs.theme === "dark" ? "sel" : ""} onClick={() => setPrefs({ theme: "dark" })}>🌙 โหมดมืด</button>
              <button className={prefs.theme === "light" ? "sel" : ""} onClick={() => setPrefs({ theme: "light" })}>☀️ โหมดสว่าง</button>
            </div>
          </div>
          <div className="field">
            <label>ขนาดตัวอักษร ({Math.round(prefs.fontScale * 100)}%)</label>
            <div className="row">
              <button className="icon-btn" onClick={() => setPrefs({ fontScale: stepFontScale(prefs.fontScale, -1) })}>A−</button>
              <button className="icon-btn" onClick={() => setPrefs({ fontScale: stepFontScale(prefs.fontScale, 1) })}>A+</button>
              <button className="btn" onClick={() => setPrefs({ fontScale: 1 })}>รีเซ็ต 100%</button>
            </div>
          </div>
          <div className="field span2">
            <label>พื้นหลัง</label>
            <div className="bg-grid">
              {BG_OPTIONS.map(o => (
                <button key={o.key} className={"bg-tile " + o.prev + (prefs.bg === o.key ? " sel" : "")} onClick={() => setPrefs({ bg: o.key })}>
                  <span>{o.label}</span>
                </button>
              ))}
              <button className={"bg-tile" + (prefs.bg === "custom" ? " sel" : "")}
                onClick={() => (document.getElementById("custom-bg-input") as any)?.click()}>
                {customUrl ? <img src={customUrl} alt="พื้นหลังกำหนดเอง" /> : <span className="upload-hint">＋ เพิ่มภาพของคุณ</span>}
                <span>กำหนดเอง</span>
              </button>
            </div>
            <input id="custom-bg-input" type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              await setCustomBg(f); setMsg("ตั้งพื้นหลังกำหนดเองแล้ว");
            }} />
            {prefs.bg === "custom" && (
              <button className="btn danger" style={{ marginTop: 8 }} onClick={() => setCustomBg(null)}>ลบพื้นหลังกำหนดเอง</button>
            )}
          </div>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>

      {isAdmin && (
        <>
          <div className="card">
            <h3>☁️ เชื่อมต่อ Filen (หลังบ้านเก็บข้อมูล + ไฟล์)</h3>
            {filenOn ? (
              <>
                <p>เชื่อมต่ออยู่ • ซิงค์ล่าสุด {fmtDateTime(lastSync)}</p>
                <div className="row">
                  <button className="btn" onClick={async () => { await onSyncNow(); setMsg("Push ข้อมูลขึ้น Filen แล้ว"); }}>Push เดี๋ยวนี้</button>
                  <button className="btn" onClick={async () => { await onPullNow(); setMsg("ดึงข้อมูลจาก Filen แล้ว"); }}>Pull จาก Filen</button>
                  <button className="btn danger" onClick={onDisconnect}>ตัดการเชื่อมต่อ</button>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <div className="field"><label>Filen email</label><input value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="field"><label>รหัสผ่าน</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                  <div className="field"><label>2FA code (ถ้ามี)</label><input value={two} onChange={e => setTwo(e.target.value)} /></div>
                </div>
                <button className="btn primary" disabled={connecting}
                  onClick={async () => { setErr(""); const e = await onConnect(email, password, two || undefined); if (e) setErr(e); }}>
                  {connecting ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ"}
                </button>
                {err && <p className="error">{err}</p>}
                <p className="muted">รหัสผ่าน Filen ไม่ถูกบันทึกถาวร ใช้เฉพาะระหว่างเซสชันนี้</p>
              </>
            )}
          </div>

          <div className="card">
            <h3>💾 สำรอง / กู้คืนข้อมูล (JSON)</h3>
            <div className="row">
              <button className="btn" onClick={() => {
                downloadBlob(`multimedia-db-${new Date().toISOString().slice(0, 10)}.json`,
                  new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }));
                update(d => d, { action: "ส่งออกข้อมูลทั้งระบบ", entity: "system", summary: "Export JSON" });
              }}>Export JSON</button>
              <label className="btn">Import JSON
                <input type="file" accept=".json" style={{ display: "none" }} onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const parsed = JSON.parse(await f.text());
                  update(() => ({ ...parsed }), { action: "นำเข้าข้อมูลสำรอง", entity: "system", summary: f.name });
                  setMsg("นำเข้า JSON แล้ว");
                }} />
              </label>
            </div>
            <p className="muted">นำไฟล์ JSON ไปวางในไดรฟ์ X: (Network Drive) ของ Filen เป็นสำเนาสำรองชั้นที่ 2 ได้</p>
          </div>

          <div className="card">
            <h3>📁 โครงสร้างโฟลเดอร์ใน Filen</h3>
            <pre>{`/multimedia-system
  /db.json                  <- ฐานข้อมูลทั้งหมด รวม users + audit (E2EE)
  /work-logs/<idงาน>/...     <- ภาพ/ไฟล์แนบงาน
  /portfolio/<idผลงาน>/...   <- วิดีโอ + ภาพปก
  /assets/<idครุภัณฑ์>/...   <- รูปอุปกรณ์ / ใบเสร็จ`}</pre>
          </div>

          <div className="card">
            <h3>⚠️ โซนอันตราย</h3>
            <button className="btn danger" onClick={() => {
              if (confirm("ล้างข้อมูลในเครื่องนี้ทั้งหมด? (ข้อมูลบน Filen ไม่หาย)")) { clearLocal(); location.reload(); }
            }}>ล้างข้อมูล local</button>
          </div>
        </>
      )}
    </div>
  );
}