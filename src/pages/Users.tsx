import React, { useState } from "react";
import { DB, uid, nowISO, STAFF_COLORS } from "../types";
import { Session, Role, hashPassword } from "../lib/auth";

type Props = { db: DB; update: (fn: (d: DB) => DB, audit?: any) => void; session: Session };

export default function Users({ db, update, session }: Props) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [linkUser, setLinkUser] = useState("");
    const [color, setColor] = useState(STAFF_COLORS[0]);

  async function addUser() {
    if (!username.trim() || password.length < 8) { setMsg("กรอก username และรหัสผ่านอย่างน้อย 8 ตัวอักษร"); return; }
    if (db.users.some(u => u.username === username.trim())) { setMsg("username นี้มีอยู่แล้ว"); return; }
    const { hash, salt } = await hashPassword(password);
    update(d => ({
      ...d,
      users: [...d.users, { id: uid(), username: username.trim(), displayName: displayName.trim() || username.trim(), role, salt, hash, createdAt: nowISO() }],
    }), { action: "สร้างผู้ใช้", entity: "users", summary: username.trim() });
    setUsername(""); setDisplayName(""); setPassword(""); setMsg("");
  }

  async function resetPass(id: string) {
    const np = prompt("รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร):");
    if (!np || np.length < 8) return;
    const { hash, salt } = await hashPassword(np);
    update(d => ({ ...d, users: d.users.map(u => u.id === id ? { ...u, salt, hash } : u) }),
      { action: "รีเซ็ตรหัสผ่าน", entity: "users", summary: id });
    alert("รีเซ็ตรหัสผ่านแล้ว");
  }

  function removeUser(id: string) {
    if (!confirm("ลบผู้ใช้นี้?")) return;
    update(d => ({ ...d, users: d.users.filter(u => u.id !== id) }), { action: "ลบผู้ใช้", entity: "users", summary: id });
  }

    function addStaff() {
    if (!firstName.trim() || !lastName.trim()) { alert("กรอกชื่อและนามสกุล"); return; }
    update(d => ({
      ...d,
      staff: [...d.staff, { id: uid(), firstName: firstName.trim(), lastName: lastName.trim(), position: position.trim() || undefined, username: linkUser || undefined, color, createdAt: nowISO() }],
    }), { action: "เพิ่มทะเบียนผู้ปฏิบัติงาน", entity: "staff", summary: `${firstName} ${lastName}` });
    setFirstName(""); setLastName(""); setPosition(""); setLinkUser("");
    setColor(STAFF_COLORS[(db.staff.length + 1) % STAFF_COLORS.length]);
  }

  function removeStaff(id: string) {
    if (!confirm("ลบชื่อออกจากทะเบียน? (ใบงานที่เคยเลือกชื่อนี้ไว้จะไม่หาย)")) return;
    update(d => ({ ...d, staff: d.staff.filter(s => s.id !== id) }), { action: "ลบทะเบียนผู้ปฏิบัติงาน", entity: "staff", summary: id });
  }

  const cell = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <h3>👥 บัญชีผู้ใช้ระบบ</h3>
        <div style={cell}>
          <input placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
          <input placeholder="ชื่อที่แสดง" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <select value={role} onChange={e => setRole(e.target.value as Role)}>
            <option value="user">ผู้ใช้งาน</option>
            <option value="admin">แอดมิน</option>
          </select>
          <input type="password" placeholder="รหัสผ่าน ≥ 8 ตัว" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={addUser}>+ เพิ่มผู้ใช้</button>
        {msg && <p className="error" style={{ color: "#f87171" }}>{msg}</p>}
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>username</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th></th></tr></thead>
          <tbody>
            {db.users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>{u.role === "admin" ? "แอดมิน" : "ผู้ใช้งาน"}</td>
                <td className="row">
                  <button className="btn" onClick={() => resetPass(u.id)}>รีเซ็ตรหัส</button>
                  {u.username !== session.username && <button className="btn danger" onClick={() => removeUser(u.id)}>ลบ</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>📇 ทะเบียนผู้ปฏิบัติงานในหน่วย</h3>
        <p className="muted">รายชื่อที่นี่จะไปโผล่เป็นตัวเลือกในช่อง "ผู้รับผิดชอบงาน" ของคำขอใช้บริการ โดยไม่ต้องพิมพ์เอง</p>
                <div style={cell}>
          <input placeholder="ชื่อ" value={firstName} onChange={e => setFirstName(e.target.value)} />
          <input placeholder="นามสกุล" value={lastName} onChange={e => setLastName(e.target.value)} />
          <input placeholder="ตำแหน่ง (ถ้ามี)" value={position} onChange={e => setPosition(e.target.value)} />
          <label className="muted" style={{ display: "grid", gap: 4 }}>สีประจำตัว
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ height: 38 }} />
          </label>
          <select value={linkUser} onChange={e => setLinkUser(e.target.value)}>
            <option value="">— ไม่เชื่อมโยงบัญชีล็อกอิน —</option>
            {db.users.map(u => <option key={u.id} value={u.username}>{u.username} ({u.displayName})</option>)}
          </select>
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={addStaff}>+ เพิ่มชื่อเข้าทะเบียน</button>
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>เชื่อมโยงบัญชี</th><th>สี</th><th></th></tr></thead>
          <tbody>
            {db.staff.map(s => (
              <tr key={s.id}>
                <td>{s.firstName} {s.lastName}</td>
                <td>{s.position || "-"}</td>
                <td>{s.username || "-"}</td>
                <td>
                  <input type="color" value={s.color || STAFF_COLORS[db.staff.indexOf(s) % STAFF_COLORS.length]}
                    onChange={e => update(d => ({ ...d, staff: d.staff.map(x => (x.id === s.id ? { ...x, color: e.target.value } : x)) }),
                      { action: "เปลี่ยนสีประจำตัว", entity: "staff", summary: `${s.firstName} ${s.lastName}` })} />
                </td>
                <td><button className="btn danger" onClick={() => removeStaff(s.id)}>ลบ</button></td>
              </tr>
            ))}
            {db.staff.length === 0 && <tr><td colSpan={5} className="muted">ยังไม่มีชื่อในทะเบียน</td></tr>}
          </tbody>
        </table>
        <p className="muted">เคล็ดลับ: ช่อง "เชื่อมโยงบัญชี" คือกุญแจของโหมด "งานของฉัน" — เชื่อมชื่อใครไว้ คนนั้นล็อกอินแล้วสลับดูเฉพาะงานตัวเองได้</p>
      </div>
    </div>
  );
}