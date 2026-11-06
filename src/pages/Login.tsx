import React, { useState } from "react";
import { DB, Row, uid, nowISO, defaultPortal } from "../types";
import { hashPassword, verifyPassword } from "../lib/auth";
import { bridgeEnabled } from "../lib/bridge";
import { pullDB } from "../lib/filen";
import { clearLocal, saveDB, normalizeDB } from "../lib/store";
import { fmtDateTime, Badge } from "../ui";
import logoUrl from "../assets/logo.png";

type Props = {
  db: DB;
  update: (fn: (d: DB) => DB, audit?: any) => void;
  onLoggedIn: (s: any) => void;
  onLoginFail: (u: string) => void;
  onConnectFilen: (email: string, pass: string, twoFa?: string) => any;
  onPull?: () => Promise<void> | void;
};

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const toISO = (v: string) => (v ? new Date(v).toISOString() : undefined);
const STATUS_COLOR: Record<string, string> = {
  "ใหม่": "#6d8bff", "รับเรื่องแล้ว": "#06b6d4", "กำลังดำเนินการ": "#f59e0b",
  "รอข้อมูลเพิ่มเติม": "#a06bff", "รอตรวจงาน": "#f97316", "เสร็จสิ้น": "#22c55e", "ยกเลิก": "#94a3b8",
};

export default function Login({ db, update, onLoggedIn, onLoginFail, onConnectFilen }: Props) {
  const setup = (db.users ?? []).length === 0;
  const cfg = { ...defaultPortal(), ...(db.portal ?? {}) };
  const [mode, setMode] = useState<"portal" | "staff">("portal");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFilen, setShowFilen] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fPass, setFPass] = useState("");
  const [fTwo, setFTwo] = useState("");

  const [reqOpen, setReqOpen] = useState(false);
  const [rq, setRq] = useState({ requesterName: "", requesterDept: "", phone: "", detail: "", date: "", timeFrom: "", timeTo: "" });
  const [mmSel, setMmSel] = useState<string[]>([""]);
  const [avSel, setAvSel] = useState<string[]>([""]);
  const [asSel, setAsSel] = useState<string[]>([""]);
  const [reqDone, setReqDone] = useState<Row | null>(null);

  const [borrowOpen, setBorrowOpen] = useState(false);
  const [pickId, setPickId] = useState("");
  const [catF, setCatF] = useState("");
  const [bw, setBw] = useState({ borrower: "", dept: "", contact: "", borrowAt: nowLocal(), dueAt: "" });
  const [bwDone, setBwDone] = useState<string | null>(null);
    const [trackOpen, setTrackOpen] = useState(false);
  const [tk, setTk] = useState({ name: "", dept: "", phone: "" });
  const [trackResults, setTrackResults] = useState<Row[] | null>(null);
  const [trackTotal, setTrackTotal] = useState(0);
  const [inqOpen, setInqOpen] = useState(false);
  const [inq, setInq] = useState({ name: "", phone: "", message: "" });
  const [inqDone, setInqDone] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max?: number) => {
    if (list.includes(v)) set(list.filter(x => x !== v));
    else {
      if (max && list.length >= max) { alert(`เลือกได้สูงสุด ${max} รายการ`); return; }
      set([...list, v]);
    }
  };

    const SelectBars = ({ title, hint, values, set, options, max, addLabel }: {
    title: string; hint?: string; values: string[]; set: (v: string[]) => void;
    options: string[]; max?: number; addLabel?: string;
  }) => (
    <div className="portal-group">
      <h4>{title}</h4>
      <div style={{ display: "grid", gap: 8 }}>
        {values.map((v, i) => (
          <div className="row" key={i} style={{ gap: 8 }}>
            <select style={{ flex: 1 }} value={v} onChange={e => {
              const nv = e.target.value;
              if (nv && values.includes(nv)) { alert("เลือกรายการนี้ไปแล้ว"); return; }
              const next = values.slice(); next[i] = nv; set(next);
            }}>
              <option value="">— แตะเพื่อเลือกรายการ —</option>
              {options.filter(s => s === v || !values.includes(s)).map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn danger" title="ลบแถวนี้" onClick={() => set(values.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {(!max || values.filter(Boolean).length < max) && (
          <button className="btn" style={{ justifySelf: "start" }} onClick={() => set([...values, ""])}>
            {addLabel ?? "+ เพิ่มรายการที่เลือก"}
          </button>
        )}
      </div>
      {hint && <p className="muted" style={{ fontSize: ".85em", marginTop: 8 }}>{hint}</p>}
    </div>
  );

  async function submit() {
    setErr(""); setBusy(true);
    try {
      if (setup) {
        if (!username.trim() || !displayName.trim()) { setErr("กรอกชื่อผู้ใช้และชื่อที่แสดง"); return; }
        if (password.length < 8) { setErr("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
        if (password !== confirm) { setErr("รหัสผ่านยืนยันไม่ตรงกัน"); return; }
        const { hash, salt } = await hashPassword(password);
        const u = { id: uid(), username: username.trim(), displayName: displayName.trim(), role: "admin" as const, passHash: hash, salt, status: "active", createdAt: nowISO() };
        update(d => ({ ...d, users: [u] }), { action: "สร้างแอดมินคนแรก", entity: "users", summary: u.username });
        onLoggedIn({ userId: u.id, username: u.username, displayName: u.displayName, role: u.role, loginAt: nowISO() });
      } else {
        const u = (db.users ?? []).find(x => x.username === username.trim());
        if (!u) { setErr("ไม่พบชื่อผู้ใช้นี้"); onLoginFail(username); return; }
        if (u.status && u.status !== "active") { setErr("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อแอดมิน"); onLoginFail(username); return; }
        const ok = await verifyPassword(password, u.salt, u.passHash ?? (u.hash as string));
        if (!ok) { setErr("รหัสผ่านไม่ถูกต้อง"); onLoginFail(username); return; }
        onLoggedIn({ userId: u.id, username: u.username, displayName: u.displayName, role: u.role, loginAt: nowISO() });
      }
    } finally { setBusy(false); }
  }

    function submitPublicRequest() {
    if (!rq.requesterName.trim() || !rq.requesterDept.trim() || !rq.phone.trim()) { alert("กรุณากรอก ชื่อผู้รับบริการ หน่วยงาน และเบอร์โทรศัพท์ ให้ครบ"); return; }
    const mm = mmSel.filter(Boolean);
    const av = avSel.filter(Boolean);
    const as = asSel.filter(Boolean);
    if (mm.length + av.length === 0) { alert("เลือกประเภทบริการอย่างน้อย 1 รายการ"); return; }
    if (!rq.detail.trim()) { alert("กรุณากรอกรายละเอียดของงาน"); return; }
    if (!rq.date || !rq.timeFrom) { alert("ระบุวันที่และเวลาเริ่มต้นที่ต้องการใช้บริการ"); return; }
    const services = [...mm, ...av];
    const row: Row = {
      id: uid(), createdAt: nowISO(), updatedAt: nowISO(), source: "portal", status: "ใหม่",
      receivedAt: nowISO(), dueAt: toISO(`${rq.date}T${rq.timeFrom}`),
      requesterName: rq.requesterName.trim(), requesterDept: rq.requesterDept.trim(), contact: rq.phone.trim(),
      title: services.join(", ").slice(0, 120),
      description: rq.detail.trim(),
      servicesMM: mm, servicesAV: av,
      serviceDate: rq.date, timeFrom: rq.timeFrom, timeTo: rq.timeTo || "",
      assignee1: as[0] ?? "", assignee2: as[1] ?? "", assignee3: as[2] ?? "",
      workType: mm.length ? "สื่อมัลติมีเดีย" : "โสตทัศนูปกรณ์",
      notes: "รับผ่านเว็บสาธารณะ",
    };
    update(d => ({ ...d, requests: [row, ...d.requests] }),
      { action: "คำขอจากภายนอก", entity: "คำขอใช้บริการ", summary: `${row.requesterName} (${row.requesterDept}) • ${row.title.slice(0, 60)}` });
    setReqDone(row);
  }

      function doTrack() {
    const n = tk.name.trim().toLowerCase();
    const dp = tk.dept.trim().toLowerCase();
    const digits = (s: string) => s.replace(/\D/g, "");
    const ph = digits(tk.phone);
    if (!n && !dp && ph.length < 6) { alert("กรอกอย่างน้อยหนึ่งช่อง: ชื่อผู้รับบริการ / หน่วยงาน / เบอร์โทรศัพท์"); return; }
    const matches = db.requests.filter(r => {
      const rn = String(r.requesterName ?? "").toLowerCase();
      const rd = String(r.requesterDept ?? "").toLowerCase();
      const rp = digits(String(r.contact ?? ""));
      const nameOk = !!n && !!rn && (rn.includes(n) || n.includes(rn));
      const deptOk = !!dp && !!rd && (rd.includes(dp) || dp.includes(rd));
      const phoneOk = ph.length >= 6 && !!rp && (rp.includes(ph) || ph.includes(rp));
      return nameOk || deptOk || phoneOk;
    }).sort((a, b) => String(b.receivedAt ?? b.createdAt ?? "").localeCompare(String(a.receivedAt ?? a.createdAt ?? "")));
    setTrackTotal(matches.length);
    setTrackResults(matches.slice(0, 3));
  }

  function submitInquiry() {
    if (!inq.phone.trim() || !inq.message.trim()) { alert("กรอกข้อความและเบอร์โทรติดต่อกลับ"); return; }
    update(d => ({
      ...d,
      inquiries: [{ id: uid(), createdAt: nowISO(), name: inq.name.trim() || tk.name.trim() || undefined, phone: inq.phone.trim(), message: inq.message.trim(), done: false }, ...(d.inquiries ?? [])],
    }), { action: "ข้อความสอบถามภายนอก", entity: "inquiries", summary: inq.phone.trim() });
    setInqDone(true);
  }

  const availableAssets = db.assets.filter(a => !["ส่งซ่อม", "ชำรุด"].includes(a.status) && !(a.borrows ?? []).some((b: any) => !b.returnedAt));
  const cats = Array.from(new Set(availableAssets.map(a => a.category || "อื่น ๆ")));
  const shownAssets = availableAssets.filter(a => !catF || (a.category || "อื่น ๆ") === catF);

  function submitBorrow() {
    const asset = db.assets.find(a => a.id === pickId);
    if (!asset) { alert("เลือกอุปกรณ์ที่ต้องการยืม"); return; }
    if (!bw.borrower.trim() || !bw.dept.trim() || !bw.dueAt) { alert("กรอกชื่อผู้ยืม หน่วยงาน และกำหนดคืน"); return; }
    const b = { id: uid(), borrower: bw.borrower.trim(), dept: bw.dept.trim(), contact: bw.contact.trim(), borrowAt: toISO(bw.borrowAt) ?? nowISO(), dueAt: toISO(bw.dueAt) as string, returnedAt: undefined, state: "pending" };
    update(d => ({ ...d, assets: d.assets.map(a => (a.id === asset.id ? { ...a, status: "ถูกยืม", borrows: [...(a.borrows ?? []), b] } : a)) }),
      { action: "ยืมอุปกรณ์(ภายนอก)", entity: "ครุภัณฑ์", summary: `${asset.name} → ${b.borrower} (${b.dept})` });
    setBwDone(`${asset.name} • กำหนดคืน ${fmtDateTime(b.dueAt)} • สถานะ: รอเจ้าหน้าที่ตรวจสอบสภาพและยืนยันการยืม`);
  }

  if (setup) {
    return (
      <div className="login-wrap page-enter">
        <div className="modal" style={{ maxWidth: 430 }}>
          <div className="modal-head"><h3>🎬 ตั้งค่าระบบครั้งแรก</h3></div>
          <div className="modal-body">
            <p className="muted">ยังไม่มีบัญชีผู้ใช้ในระบบ — สร้างบัญชีแอดมินคนแรกเพื่อเริ่มต้นใช้งาน หรือดึงข้อมูลเดิมจากส่วนกลางก่อนได้</p>
            <div className="field"><label>ชื่อผู้ใช้ (username)</label><input value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div className="field"><label>ชื่อที่แสดง</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
            <div className="field"><label>รหัสผ่าน</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <div className="field"><label>ยืนยันรหัสผ่าน</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
            {err && <p className="error">{err}</p>}
            <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={submit}>
              {busy ? "กำลังตรวจสอบ..." : "สร้างแอดมินและเข้าสู่ระบบ"}
            </button>
            {bridgeEnabled() && (
              <button className="btn link" style={{ width: "100%", marginTop: 8 }} onClick={async () => {
                if (!window.confirm("ล้างข้อมูลในเบราว์เซอร์นี้แล้วดึงฐานข้อมูลส่วนกลางมาแทน?")) return;
                clearLocal();
                const remote = await pullDB();
                if (remote) saveDB(normalizeDB(remote));
                location.reload();
              }}>🔄 ดึงข้อมูลส่วนกลางทับเครื่องนี้</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "staff") {
    return (
      <div className="login-wrap page-enter">
        <div className="modal" style={{ maxWidth: 430 }}>
          <div className="modal-head"><h3>🔐 เข้าสู่ระบบงานสื่อมัลติมีเดีย</h3></div>
          <div className="modal-body">
            <div className="field"><label>ชื่อผู้ใช้ (username)</label><input value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div className="field"><label>รหัสผ่าน</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} /></div>
            {err && <p className="error">{err}</p>}
            <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={submit}>
              {busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </button>
            {bridgeEnabled() && (
              <button className="btn link" style={{ width: "100%", marginTop: 8 }} onClick={async () => {
                if (!window.confirm("ล้างข้อมูลในเบราว์เซอร์นี้แล้วดึงฐานข้อมูลส่วนกลางมาแทน?")) return;
                clearLocal();
                const remote = await pullDB();
                if (remote) saveDB(normalizeDB(remote));
                location.reload();
              }}>🔄 ดึงข้อมูลส่วนกลางทับเครื่องนี้</button>
            )}
            <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
              <button className="btn link" onClick={() => setShowFilen(!showFilen)}>ไม่มีข้อมูลเดิมบน Filen? ดึงมาก่อน</button>
            </div>
            {showFilen && (
              <div className="card" style={{ marginTop: 8 }}>
                <div className="field"><label>อีเมล Filen</label><input value={fEmail} onChange={e => setFEmail(e.target.value)} /></div>
                <div className="field"><label>รหัสผ่าน Filen</label><input type="password" value={fPass} onChange={e => setFPass(e.target.value)} /></div>
                <div className="field"><label>รหัส 2FA (ถ้าเปิด)</label><input value={fTwo} onChange={e => setFTwo(e.target.value)} /></div>
                <button className="btn" onClick={() => onConnectFilen(fEmail, fPass, fTwo || undefined)}>เชื่อมต่อและดึงข้อมูล</button>
              </div>
            )}
            <button className="btn link" style={{ width: "100%", marginTop: 10 }} onClick={() => setMode("portal")}>← กลับหน้าสาธารณะ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-wrap page-enter">
      <header className="portal-top">
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <img src={logoUrl} alt="โลโก้หน่วยพัฒนาสื่อมัลติมีเดีย" className="portal-logo" />
          <div>
            <div className="portal-brand">หน่วยพัฒนาสื่อมัลติมีเดีย</div>
            <div className="muted">คณะทันตแพทยศาสตร์ มหาวิทยาลัยสงขลานครินทร์</div>
          </div>
        </div>
        <button className="btn" onClick={() => setMode("staff")}>🔐 เจ้าหน้าที่เข้าสู่ระบบ</button>
      </header>

      <section className="portal-hero">
        <h1>{cfg.heroTitle.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</h1>
        <p className="portal-motto">{cfg.motto}</p>
      </section>

      <section className="portal-pillars">
        <div className="card"><div style={{ fontSize: "1.8rem" }}>🎯</div><strong>คุณภาพระดับวิชาชีพ</strong><span className="muted">อุปกรณ์มาตรฐานอุตสาหกรรม ทีมงานเชี่ยวชาญ</span></div>
        <div className="card"><div style={{ fontSize: "1.8rem" }}>⏱️</div><strong>ส่งมอบตรงเวลา</strong><span className="muted">วางแผนการผลิตชัดเจน ติดตามสถานะได้ทุกขั้น</span></div>
        <div className="card"><div style={{ fontSize: "1.8rem" }}>🤝</div><strong>บริการด้วยใจ</strong><span className="muted">พร้อมสนับสนุนทุกหน่วยงานในคณะ</span></div>
      </section>

      <section className="card portal-services">
        <h2>🎬 การให้บริการ</h2>
        <div className="marquee" title="งานสื่อมัลติมีเดีย">
          <div className="marquee-track">
            <span className="marquee-label">🎬 งานสื่อมัลติมีเดีย:</span>
            {cfg.mmServices.map(s => <span key={s} className="chip">{s}</span>)}
            <span className="marquee-label">🎬 งานสื่อมัลติมีเดีย:</span>
            {cfg.mmServices.map(s => <span key={"b" + s} className="chip">{s}</span>)}
          </div>
        </div>
        <div className="marquee" title="งานโสตทัศนูปกรณ์">
          <div className="marquee-track marquee-slow">
            <span className="marquee-label">🎧 งานโสตทัศนูปกรณ์:</span>
            {cfg.avServices.map(s => <span key={s} className="chip">{s}</span>)}
            <span className="marquee-label">🎧 งานโสตทัศนูปกรณ์:</span>
            {cfg.avServices.map(s => <span key={"b" + s} className="chip">{s}</span>)}
          </div>
        </div>
        <div className="portal-cta">
          <button className="btn primary portal-big" onClick={() => { setReqOpen(true); setReqDone(null); setBorrowOpen(false); }}>📝 ส่งคำขอใช้บริการ</button>
          <button className="btn portal-big" onClick={() => { setBorrowOpen(true); setBwDone(null); setPickId(""); setReqOpen(false); }}>🎒 ยืมอุปกรณ์หน่วย</button>
                  <button className="btn portal-big" onClick={() => { setTrackOpen(true); setTrackResults(null); setReqOpen(false); setBorrowOpen(false); }}>🔍 ติดตามสถานะงาน</button>
        </div>
        <p className="muted" style={{ textAlign: "center" }}>{cfg.note}</p>
      </section>

      {reqOpen && !reqDone && (
        <section className="card portal-form">
          <h3>📝 ใบขอรับบริการ</h3>
          <p className="muted">งานสื่อสารองค์กร คณะทันตแพทยศาสตร์ (ขอล่วงหน้า 3 วันทำการ) • ช่องที่มี * จำเป็นต้องกรอก</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="muted">ชื่อผู้รับบริการ *<input value={rq.requesterName} onChange={e => setRq({ ...rq, requesterName: e.target.value })} /></label>
            <label className="muted">หน่วยงาน *<input value={rq.requesterDept} onChange={e => setRq({ ...rq, requesterDept: e.target.value })} /></label>
            <label className="muted" style={{ gridColumn: "1 / -1" }}>เบอร์โทรศัพท์หน่วยงานผู้ขอบริการ *<input value={rq.phone} onChange={e => setRq({ ...rq, phone: e.target.value })} /></label>
          </div>

                    <SelectBars title="รูปแบบการขอรับบริการ: งานสื่อมัลติมีเดีย (เลือกได้มากกว่า 1)"
            addLabel="+ เพิ่มบริการที่ขอรับ" values={mmSel} set={setMmSel} options={cfg.mmServices} />
          <SelectBars title="งานสื่อโสตทัศนูปกรณ์ (เลือกได้มากกว่า 1)"
            addLabel="+ เพิ่มบริการที่ขอรับ" values={avSel} set={setAvSel} options={cfg.avServices} />
          <SelectBars title="ผู้รับผิดชอบงาน (สูงสุด 3 คน หรือไม่ระบุก็ได้)"
            hint="หากไม่ระบุ หัวหน้าหน่วยจะเป็นผู้แจกจ่ายงานให้เอง"
            addLabel="+ เพิ่มผู้รับผิดชอบ" values={asSel} set={setAsSel}
            options={db.staff.map(s => `${s.firstName} ${s.lastName}`)} max={3} />

          <label className="muted" style={{ display: "grid", gap: 6, marginTop: 12 }}>ข้อมูลรายละเอียดของงาน *
            <textarea rows={4} value={rq.detail} onChange={e => setRq({ ...rq, detail: e.target.value })} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
            <label className="muted">วันที่ต้องการใช้บริการสื่อฯ / รับชิ้นงาน *<input type="date" value={rq.date} onChange={e => setRq({ ...rq, date: e.target.value })} /></label>
            <label className="muted">เวลาเริ่มต้นที่ต้องการใช้บริการฯ *<input type="time" value={rq.timeFrom} onChange={e => setRq({ ...rq, timeFrom: e.target.value })} /></label>
            <label className="muted">เวลาสิ้นสุดการขอใช้บริการโสตฯ<input type="time" value={rq.timeTo} onChange={e => setRq({ ...rq, timeTo: e.target.value })} /></label>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary portal-big" onClick={submitPublicRequest}>ส่งคำขอ</button>
            <button className="btn" onClick={() => setReqOpen(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {reqDone && (
        <section className="card" style={{ borderColor: "#22c55e" }}>
          <h3>✅ ส่งคำขอเรียบร้อย</h3>
          <p>หมายเลขคำขอ: <strong>#{reqDone.id.slice(0, 4).toUpperCase()}</strong> • {reqDone.title}</p>
          <p className="muted">หน่วยพัฒนาสื่อมัลติมีเดียได้รับคำขอของคุณแล้ว และจะติดต่อกลับตามเบอร์ที่ระบุไว้</p>
          <div className="row">
            <button className="btn" onClick={() => { setReqDone(null); setRq({ requesterName: "", requesterDept: "", phone: "", detail: "", date: "", timeFrom: "", timeTo: "" }); setMmSel([""]); setAvSel([""]); setAsSel([""]); }}>ส่งคำขออื่น</button>
            <button className="btn link" onClick={() => setReqDone(null)}>กลับหน้าหลัก</button>
          </div>
        </section>
      )}

            {trackOpen && trackResults === null && (
        <section className="card">
          <h3>🔍 ติดตามสถานะงาน</h3>
          <p className="muted">กรอกเพียงช่องใดช่องหนึ่งก็ได้ (ชื่อผู้รับบริการ / หน่วยงาน / เบอร์โทรศัพท์) เพื่อค้นหาคำขอของคุณ • แสดงสูงสุด 3 รายการล่าสุด</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label className="muted">ชื่อผู้รับบริการ<input value={tk.name} onChange={e => setTk({ ...tk, name: e.target.value })} /></label>
            <label className="muted">หน่วยงาน<input value={tk.dept} onChange={e => setTk({ ...tk, dept: e.target.value })} /></label>
            <label className="muted">เบอร์โทรศัพท์<input value={tk.phone} onChange={e => setTk({ ...tk, phone: e.target.value })} /></label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={doTrack}>ค้นหาคำขอ</button>
            <button className="btn" onClick={() => setTrackOpen(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {trackResults !== null && (
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <h3>🔍 ผลการติดตาม (พบ {trackTotal} รายการ • แสดง {trackResults.length} ล่าสุด)</h3>
            <button className="btn" onClick={() => setTrackResults(null)}>← ค้นหาใหม่</button>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {trackResults.map(r => (
              <div key={r.id} className="day-bar" style={{ borderLeftColor: STATUS_COLOR[r.status] ?? "#6d8bff" }}>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <strong>#{String(r.id).slice(0, 4).toUpperCase()} • {r.title}</strong>
                  <Badge>{r.status}</Badge>
                </div>
                <div className="muted" style={{ fontSize: ".85em" }}>
                  รับเรื่อง: {fmtDateTime(r.receivedAt)} • กำหนด: {r.dueAt ? fmtDateTime(r.dueAt) : "-"}
                </div>
                <div className="muted" style={{ fontSize: ".85em" }}>
                  ผู้รับผิดชอบ: {[r.assignee1, r.assignee2, r.assignee3].filter(Boolean).join(", ") || "หน่วยกำลังจัดสรร"}
                </div>
              </div>
            ))}
            {trackResults.length === 0 && <p className="muted">ไม่พบคำขอที่ตรงกับข้อมูล — หากเคยยื่นคำขอแล้ว กรุณาทิ้งข้อความสอบถามด้านล่าง</p>}
          </div>
          {(trackTotal > trackResults.length || trackResults.length === 0) && (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => { setInqOpen(true); setInqDone(false); }}>💬 ทิ้งข้อความสอบถามคำขอที่เก่ากว่า</button>
            </div>
          )}
        </section>
      )}

      {inqOpen && !inqDone && (
        <section className="card">
          <h3>💬 ข้อความสอบถาม</h3>
          <label className="muted" style={{ display: "grid", gap: 6 }}>ชื่อ-นามสกุล (ถ้ามี)
            <input value={inq.name} onChange={e => setInq({ ...inq, name: e.target.value })} />
          </label>
          <label className="muted" style={{ display: "grid", gap: 6, marginTop: 8 }}>เบอร์โทรติดต่อกลับ *
            <input value={inq.phone} onChange={e => setInq({ ...inq, phone: e.target.value })} />
          </label>
          <label className="muted" style={{ display: "grid", gap: 6, marginTop: 8 }}>ข้อความ *
            <textarea rows={3} value={inq.message} onChange={e => setInq({ ...inq, message: e.target.value })}
              placeholder="เช่น ต้องการค้นหาคำขอเดือนที่ผ่านมา / สอบถามกำหนดส่งชิ้นงาน" />
          </label>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={submitInquiry}>ส่งข้อความ</button>
            <button className="btn" onClick={() => setInqOpen(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {inqDone && (
        <section className="card" style={{ borderColor: "#22c55e" }}>
          <h3>✅ รับข้อความแล้ว</h3>
          <p className="muted">เจ้าหน้าที่จะตรวจสอบและติดต่อกลับตามเบอร์ที่ระบุไว้</p>
          <button className="btn link" onClick={() => { setInqDone(false); setInqOpen(false); setTrackOpen(false); setTrackResults(null); }}>กลับหน้าหลัก</button>
        </section>
      )}

      {borrowOpen && !bwDone && (
        <section className="card">
          <h3>🎒 ยืมอุปกรณ์หน่วย</h3>
          <p className="muted">เลือกอุปกรณ์ที่ "พร้อมให้ยืม" แล้วกรอกข้อมูลการยืม — รายการเข้าระบบของหน่วยทันที</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className={catF === "" ? "btn primary" : "btn"} onClick={() => setCatF("")}>ทั้งหมด</button>
            {cats.map(c => <button key={c} className={catF === c ? "btn primary" : "btn"} onClick={() => setCatF(c)}>{c}</button>)}
          </div>
          <div className="portal-assets">
            {shownAssets.map(a => (
              <button key={a.id} className={"portal-asset" + (pickId === a.id ? " on" : "")} onClick={() => setPickId(a.id)}>
                <strong>{a.name}</strong>
                <span className="muted">{a.assetCode || "-"} • หมวด {a.category || "อื่น ๆ"}</span>
                <span style={{ color: "#22c55e", fontSize: ".85em" }}>● พร้อมให้ยืม</span>
              </button>
            ))}
            {shownAssets.length === 0 && <p className="muted">ไม่มีอุปกรณ์พร้อมให้ยืมในหมวดนี้</p>}
          </div>
          {pickId && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <label className="muted">ชื่อ-นามสกุล ผู้ยืม *<input value={bw.borrower} onChange={e => setBw({ ...bw, borrower: e.target.value })} /></label>
              <label className="muted">หน่วยงาน / องค์กร *<input value={bw.dept} onChange={e => setBw({ ...bw, dept: e.target.value })} /></label>
              <label className="muted">โทรศัพท์ ติดต่อกลับ<input value={bw.contact} onChange={e => setBw({ ...bw, contact: e.target.value })} /></label>
              <label className="muted">วันเวลายืม<input type="datetime-local" value={bw.borrowAt} onChange={e => setBw({ ...bw, borrowAt: e.target.value })} /></label>
              <label className="muted">กำหนดคืน *<input type="datetime-local" value={bw.dueAt} onChange={e => setBw({ ...bw, dueAt: e.target.value })} /></label>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={submitBorrow}>ยืนยันการยืม</button>
            <button className="btn" onClick={() => setBorrowOpen(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {bwDone && (
        <section className="card" style={{ borderColor: "#22c55e" }}>
          <h3>✅ บันทึกการยืมเรียบร้อย</h3>
          <p>{bwDone}</p>
          <p className="muted">คำขอยืมถูกส่งเข้าระบบแล้ว — กรุณารอเจ้าหน้าที่ตรวจสอบสภาพอุปกรณ์และกดยืนยันการยืม จึงติดต่อรับอุปกรณ์ได้ที่หน่วยพัฒนาสื่อมัลติมีเดีย</p>
          <div className="row">
            <button className="btn" onClick={() => { setBwDone(null); setPickId(""); setBw({ borrower: "", dept: "", contact: "", borrowAt: nowLocal(), dueAt: "" }); }}>ยืมรายการอื่น</button>
            <button className="btn link" onClick={() => setBwDone(null)}>กลับหน้าหลัก</button>
          </div>
        </section>
      )}

      <footer className="portal-foot muted">
        © 2569 หน่วยพัฒนาสื่อมัลติมีเดีย คณะทันตแพทยศาสตร์ ม.อ. • ระบบบริหารงานภายในและบริการสื่อครบวงจร
      </footer>
    </div>
  );
}