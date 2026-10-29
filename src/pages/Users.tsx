import React, { useState } from "react";
import { DB, User, uid, nowISO } from "../types";
import { Session, hashPassword } from "../lib/auth";
import { Modal, fmtDateTime, Badge } from "../ui";

type Fn = (fn: (d: DB) => DB, audit?: any) => void;

export default function Users({ db, update, session }: { db: DB; update: Fn; session: Session }) {
  const users: User[] = db.users ?? [];
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", role: "user" as "admin" | "user", password: "" });
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPass, setNewPass] = useState("");
  const [err, setErr] = useState("");

  async function addUser() {
    setErr("");
    if (!form.username.trim() || !form.displayName.trim()) { setErr("กรอกชื่อผู้ใช้และชื่อที่แสดง"); return; }
    if (users.some(u => u.username === form.username.trim())) { setErr("ชื่อผู้ใช้นี้มีอยู่แล้ว"); return; }
    if (form.password.length < 8) { setErr("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
    const { hash, salt } = await hashPassword(form.password);
    const u: User = { id: uid(), username: form.username.trim(), displayName: form.displayName.trim(), role: form.role, passHash: hash, salt, status: "active", createdAt: nowISO(), updatedAt: nowISO() };
    update(d => ({ ...d, users: [...d.users, u] }), { action: "เพิ่มผู้ใช้", entity: "users", entityId: u.id, summary: `${u.username} (${u.role})` });
    setAdding(false);
    setForm({ username: "", displayName: "", role: "user", password: "" });
  }

  async function resetPass() {
    if (!resetFor) return;
    if (newPass.length < 8) { setErr("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
    const { hash, salt } = await hashPassword(newPass);
    update(d => ({ ...d, users: d.users.map(u => u.id === resetFor.id ? { ...u, passHash: hash, salt, updatedAt: nowISO() } : u) }),
      { action: "รีเซ็ตรหัสผ่าน", entity: "users", entityId: resetFor.id, summary: resetFor.username });
    setResetFor(null); setNewPass(""); setErr("");
  }

  function patchUser(u: User, changes: Partial<User>, action: string, summary: string) {
    update(d => ({ ...d, users: d.users.map(x => x.id === u.id ? { ...x, ...changes, updatedAt: nowISO() } : x) }),
      { action, entity: "users", entityId: u.id, summary });
  }

  return (
    <div>
      <div className="page-head">
        <h2>จัดการผู้ใช้งาน <span className="muted">({users.length} บัญชี)</span></h2>
        <button className="btn primary" onClick={() => { setAdding(true); setErr(""); }}>+ เพิ่มผู้ใช้</button>
      </div>
      <table className="table">
        <thead><tr><th>ผู้ใช้</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th>สถานะ</th><th>สร้างเมื่อ</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username} {u.id === session.userId && <Badge>คุณ</Badge>}</td>
              <td>{u.displayName}</td>
              <td><Badge>{u.role === "admin" ? "แอดมิน" : "ผู้ใช้งาน"}</Badge></td>
              <td><Badge>{u.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</Badge></td>
              <td>{fmtDateTime(u.createdAt)}</td>
              <td className="actions">
                <button className="btn" onClick={() => { setResetFor(u); setNewPass(""); setErr(""); }}>รีเซ็ตรหัส</button>
                {u.id !== session.userId && (
                  <>
                    <button className="btn" onClick={() => patchUser(u, { role: u.role === "admin" ? "user" : "admin" }, "เปลี่ยนบทบาท", `${u.username} → ${u.role === "admin" ? "user" : "admin"}`)}>
                      {u.role === "admin" ? "ลดเป็นผู้ใช้" : "เลื่อนเป็นแอดมิน"}
                    </button>
                    <button className={u.status === "active" ? "btn danger" : "btn"}
                      onClick={() => patchUser(u, { status: u.status === "active" ? "disabled" : "active" }, u.status === "active" ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี", u.username)}>
                      {u.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding && (
        <Modal title="เพิ่มผู้ใช้ใหม่" onClose={() => setAdding(false)}>
          <div className="field"><label>ชื่อผู้ใช้ (username)</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
          <div className="field"><label>ชื่อที่แสดง</label><input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></div>
          <div className="field"><label>บทบาท</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
              <option value="user">ผู้ใช้งาน (ดู / เพิ่ม / แก้ไข)</option>
              <option value="admin">แอดมิน (สิทธิ์ทั้งหมด)</option>
            </select>
          </div>
          <div className="field"><label>รหัสผ่านชั่วคราว (≥ 8 ตัว)</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          {err && <p className="error">{err}</p>}
          <div className="modal-foot">
            <button className="btn" onClick={() => setAdding(false)}>ยกเลิก</button>
            <button className="btn primary" onClick={addUser}>บันทึก</button>
          </div>
        </Modal>
      )}

      {resetFor && (
        <Modal title={`รีเซ็ตรหัสผ่าน: ${resetFor.username}`} onClose={() => setResetFor(null)}>
          <div className="field"><label>รหัสผ่านใหม่ (≥ 8 ตัว)</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} /></div>
          {err && <p className="error">{err}</p>}
          <div className="modal-foot">
            <button className="btn" onClick={() => setResetFor(null)}>ยกเลิก</button>
            <button className="btn primary" onClick={resetPass}>บันทึกรหัสผ่านใหม่</button>
          </div>
        </Modal>
      )}
    </div>
  );
}