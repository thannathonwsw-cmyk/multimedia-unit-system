import React, { useState } from "react";
import { DB, User, uid, nowISO } from "../types";
import { Session, hashPassword, verifyPassword } from "../lib/auth";

type Props = {
  db: DB;
  update: (fn: (d: DB) => DB, audit?: any) => void;
  onLoggedIn: (s: Session) => void;
  onLoginFail: (username: string) => void;
  onConnectFilen: (email: string, password: string) => Promise<string | null>;
  onPull: () => Promise<void>;
};

export default function Login({ db, update, onLoggedIn, onLoginFail, onConnectFilen, onPull }: Props) {
  const setup = (db.users ?? []).length === 0;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fPass, setFPass] = useState("");
  const [showFilen, setShowFilen] = useState(false);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      if (setup) {
        if (!username.trim() || !displayName.trim()) { setErr("กรอกชื่อผู้ใช้และชื่อที่แสดง"); return; }
        if (password.length < 8) { setErr("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
        if (password !== confirm) { setErr("รหัสผ่านยืนยันไม่ตรงกัน"); return; }
        const { hash, salt } = await hashPassword(password);
        const u: User = { id: uid(), username: username.trim(), displayName: displayName.trim(), role: "admin", passHash: hash, salt, status: "active", createdAt: nowISO(), updatedAt: nowISO() };
        update(d => ({ ...d, users: [u] }), { action: "สร้างแอดมินคนแรก", entity: "users", entityId: u.id, summary: u.username });
        onLoggedIn({ userId: u.id, username: u.username, displayName: u.displayName, role: "admin", loginAt: nowISO() });
      } else {
        const u = (db.users ?? []).find(x => x.username === username.trim());
        if (!u) { setErr("ไม่พบชื่อผู้ใช้นี้"); onLoginFail(username); return; }
        if (u.status !== "active") { setErr("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อแอดมิน"); onLoginFail(username); return; }
        const ok = await verifyPassword(password, u.salt, u.passHash);
        if (!ok) { setErr("รหัสผ่านไม่ถูกต้อง"); onLoginFail(username); return; }
        onLoggedIn({ userId: u.id, username: u.username, displayName: u.displayName, role: u.role, loginAt: nowISO() });
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap page-enter">
      <div className="modal" style={{ maxWidth: 430 }}>
        <div className="modal-head"><h3>{setup ? "🔐 ตั้งค่าระบบครั้งแรก" : "🔐 เข้าสู่ระบบงานสื่อมัลติมีเดีย"}</h3></div>
        <div className="modal-body">
          {setup && <p className="muted">ยังไม่มีบัญชีผู้ใช้ในระบบนี้ — สร้างบัญชีแอดมินคนแรกเพื่อเริ่มใช้งาน หรือดึงข้อมูลเดิมจาก Filen ก่อนได้</p>}
          <div className="field"><label>ชื่อผู้ใช้ (username)</label><input value={username} onChange={e => setUsername(e.target.value)} /></div>
          {setup && <div className="field"><label>ชื่อที่แสดง</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="เช่น มอส / หน่วยพัฒนาสื่อ" /></div>}
          <div className="field"><label>รหัสผ่าน</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} /></div>
          {setup && <div className="field"><label>ยืนยันรหัสผ่าน</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>}
          {err && <p className="error">{err}</p>}
          <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={submit}>
            {busy ? "กำลังตรวจสอบ..." : setup ? "สร้างแอดมินและเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
          </button>
          {setup && (
            <>
              <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
                <button className="btn link" onClick={() => setShowFilen(!showFilen)}>มีข้อมูลเดิมบน Filen? ดึงมาก่อน</button>
              </div>
              {showFilen && (
                <div className="card">
                  <div className="field"><label>Filen email</label><input value={fEmail} onChange={e => setFEmail(e.target.value)} /></div>
                  <div className="field"><label>รหัสผ่าน Filen</label><input type="password" value={fPass} onChange={e => setFPass(e.target.value)} /></div>
                  <button className="btn" disabled={busy} onClick={async () => {
                    setErr("");
                    const e2 = await onConnectFilen(fEmail, fPass);
                    if (e2) { setErr(e2); return; }
                    await onPull();
                  }}>เชื่อมต่อและดึงข้อมูล</button>
                  <p className="muted">ถ้าดึงสำเร็จและมีผู้ใช้เดิมอยู่แล้ว หน้าจอจะกลับเป็นโหมดเข้าสู่ระบบอัตโนมัติ</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}