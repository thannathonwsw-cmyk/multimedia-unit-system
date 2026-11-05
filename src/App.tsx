import logoUrl from "./assets/logo.png";
import { bridgeEnabled } from "./lib/bridge";
import React, { useEffect, useRef, useState } from "react";
import { DB, nowISO } from "./types";
import { loadDB, saveDB, normalizeDB } from "./lib/store";
import { connect as filenConnect, disconnect as filenDisconnect, pushDB, pullDB, filenConnected } from "./lib/filen";
import { loadPrefs, savePrefs, applyPrefs, Prefs, stepFontScale } from "./lib/prefs";
import { getSession, setSession, clearSession, Session } from "./lib/auth";
import { idbGet, idbSet } from "./lib/idb";
import { fmtDateTime } from "./ui";
import Login from "./pages/Login";
import Dashboard, { computeAlerts } from "./pages/Dashboard";
import Requests from "./pages/Requests";
import WorkLogs from "./pages/WorkLogs";
import Assets from "./pages/Assets";
import Portfolio from "./pages/Portfolio";
import Users from "./pages/Users";
import Audit from "./pages/Audit";
import Settings from "./pages/Settings";

export default function App() {
  const [db, setDb] = useState<DB>(loadDB);
  const dbRef = useRef(db);
  const [tab, setTab] = useState("dashboard");
  const [filenOn, setFilenOn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastSync, setLastSync] = useState<string | undefined>(db.meta.lastSyncAt);
  const pushTimer = useRef<any>(null);

  const [session, setSessionState] = useState<Session | null>(getSession());
  const sessionRef = useRef<Session | null>(session);

  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
    const [viewMode, setViewMode] = useState<"all" | "mine">(prefs.viewMode ?? "all");
      const [menuOpen, setMenuOpen] = useState(false);
  const go = (t: any) => { setTab(t); setMenuOpen(false); };
  function setViewModeSafe(m: "all" | "mine") {
    setViewMode(m);
    const p = { ...prefs, viewMode: m };
    setPrefsState(p); savePrefs(p); applyPrefs(p);
  }
  const myStaff = session ? db.staff.find(s => s.username && s.username === session.username) : undefined;
  const myStaffName = myStaff ? `${myStaff.firstName} ${myStaff.lastName}` : undefined;
  const mineOn = viewMode === "mine" && !!session;
  const dbView: DB = mineOn
    ? { ...db, requests: myStaffName ? db.requests.filter(r => [r.assignee1, r.assignee2, r.assignee3].includes(myStaffName)) : [] }
    : db;
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const setPrefs = (p: Partial<Prefs>) => setPrefsState(s => ({ ...s, ...p }));
  useEffect(() => { applyPrefs(prefs); savePrefs(prefs); }, [prefs]);
  useEffect(() => {
    let alive = true;
    if (prefs.bg === "custom") {
      idbGet("custom-bg").then(b => { if (alive && b && b.size) setCustomUrl(URL.createObjectURL(b)); });
    } else setCustomUrl(null);
    return () => { alive = false; };
  }, [prefs.bg]);
    // ===== ซิงค์กลางอัตโนมัติผ่านสะพาน Google Drive =====
  useEffect(() => {
    if (!bridgeEnabled()) return;
    setFilenOn(true);
    let alive = true;
    const softPull = async () => {
      try {
        const remote = await pullDB();
        if (!alive || !remote || !remote.meta) return;
        const localT = dbRef.current.meta?.lastSavedAt ?? "";
        const remoteT = remote.meta?.lastSavedAt ?? "";
        if (remoteT && remoteT > localT) {
          const nd = normalizeDB(remote); dbRef.current = nd; setDb(nd); saveDB(nd);
        }
        setLastSync(nowISO());
      } catch (e) { console.warn("soft pull ล้มเหลว", e); }
    };
    softPull();
    const iv = setInterval(softPull, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  async function setCustomBg(blob: Blob | null) {
    if (blob) { await idbSet("custom-bg", blob); setCustomUrl(URL.createObjectURL(blob)); setPrefs({ bg: "custom" }); }
    else { await idbSet("custom-bg", new Blob([])); setCustomUrl(null); if (prefs.bg === "custom") setPrefs({ bg: "aurora" }); }
  }

  const schedulePush = () => {
    if (!filenConnected()) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        await pushDB(dbRef.current);
        const t = nowISO(); setLastSync(t);
        setDb(d => { const nd = { ...d, meta: { ...d.meta, lastSyncAt: t } }; dbRef.current = nd; saveDB(nd); return nd; });
      } catch (e) { console.warn("sync ล้มเหลว", e); }
    }, 2500);
  };

  const update = (fn: (d: DB) => DB, audit?: { action: string; entity: string; entityId?: string; summary?: string }) => {
    setDb(prev => {
      let next = { ...fn(prev), meta: { ...prev.meta, lastSavedAt: nowISO() } };
      if (audit) {
        const s = sessionRef.current;
        next = {
          ...next,
          audit: [{
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            at: nowISO(),
            userId: s?.userId ?? "system",
            username: s?.username ?? "system",
            ...audit
          }, ...next.audit].slice(0, 2000),
        };
      }
      dbRef.current = next; saveDB(next); schedulePush();
      return next;
    });
  };

  function handleLoggedIn(s: Session) {
    sessionRef.current = s; setSessionState(s); setSession(s);
    update(d => d, { action: "เข้าสู่ระบบ", entity: "auth", entityId: s.userId, summary: `${s.username} (${s.role})` });
  }
  function handleLoginFail(username: string) {
    update(d => d, { action: "เข้าสู่ระบบไม่สำเร็จ", entity: "auth", summary: username || "(ว่าง)" });
  }
  function logout() {
    update(d => d, { action: "ออกจากระบบ", entity: "auth", summary: session?.username ?? "" });
    clearSession(); sessionRef.current = null; setSessionState(null); setTab("dashboard");
  }

  async function handleConnect(email: string, password: string, twoFactor?: string): Promise<string | null> {
    setConnecting(true);
    try {
      await filenConnect(email, password, twoFactor);
      setFilenOn(true);
      update(d => d, { action: "เชื่อมต่อ Filen", entity: "system", summary: email });
      const remote = await pullDB();
      if (remote && Array.isArray(remote.requests)) {
        const nd = normalizeDB(remote); dbRef.current = nd; setDb(nd); saveDB(nd);
      } else { await pushDB(dbRef.current); setLastSync(nowISO()); }
      return null;
    } catch (e: any) { return (e?.stack ? String(e.stack).split("\n").slice(0, 4).join(" | ") : String(e?.message ?? e)); }
    finally { setConnecting(false); }
  }
  async function pullOnly(): Promise<void> {
    const remote = await pullDB();
    if (remote) { const nd = normalizeDB(remote); dbRef.current = nd; setDb(nd); saveDB(nd); }
  }
  async function syncNow() {
    await pushDB(dbRef.current);
    const t = nowISO(); setLastSync(t);
    update(d => ({ ...d, meta: { ...d.meta, lastSyncAt: t } }));
  }
  async function pullNow() {
    const remote = await pullDB();
    if (remote && Array.isArray(remote.requests)) {
      const nd = normalizeDB(remote); dbRef.current = nd; setDb(nd); saveDB(nd);
    } else alert("ไม่พบ db.json บน Filen");
  }

  const bgLayer = (
    <div id="bg-layer" className={"bg-" + prefs.bg}
      style={customUrl ? ({ "--custom-bg-url": `url("${customUrl}")` } as any) : undefined} />
  );

  if (!session) {
    return (
      <>
        {bgLayer}
        <Login db={db} update={update} onLoggedIn={handleLoggedIn} onLoginFail={handleLoginFail}
          onConnectFilen={async (e, p) => {
            try { await filenConnect(e, p); setFilenOn(true); return null; }
            catch (err: any) { return String(err?.message ?? err); }
          }}
          onPull={pullOnly} />
      </>
    );
  }

  const isAdmin = session.role === "admin";
  const alertCount = computeAlerts(db).filter(a => a.level !== "info").length;
  const TABS = [
    { key: "dashboard", label: "ภาพรวม" },
    { key: "requests", label: "คำขอใช้บริการ" },
    { key: "worklogs", label: "งานย้อนหลัง" },
    { key: "assets", label: "ยืม-คืนอุปกรณ์" },
    { key: "portfolio", label: "คลังผลงาน" },
    ...(isAdmin ? [{ key: "users", label: "ผู้ใช้งาน" }, { key: "audit", label: "ประวัติการแก้ไข" }] : []),
    { key: "settings", label: "ตั้งค่า" },
  ];

  return (
    <>
      {bgLayer}
      <header className="mms-topbar">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", flexWrap: "wrap" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <button className="icon-btn mms-menu-btn" onClick={() => setMenuOpen(o => !o)} title="เปิด/ปิดเมนู">☰</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <img src={logoUrl} alt="โลโก้หน่วยพัฒนาสื่อมัลติมีเดีย" className="mms-logo" />
        หน่วยพัฒนาสื่อมัลติมีเดีย
      </div>
    </div>
    <div className="mms-actions" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {session && (
        <div className="seg" title="สลับมุมมองงาน">
          <button className={viewMode === "all" ? "on" : ""} onClick={() => setViewModeSafe("all")}>ภาพรวม</button>
          <button className={viewMode === "mine" ? "on" : ""} onClick={() => setViewModeSafe("mine")}>ของฉัน</button>
        </div>
      )}
      <button className="icon-btn" style={{ position: "relative" }} title="การแจ้งเตือน" onClick={() => go("dashboard")}>
        🔔{alertCount > 0 && <span className="bell-dot">{alertCount}</span>}
      </button>
      <span className="mms-fs" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <button className="icon-btn" title="ลดขนาดตัวอักษร" onClick={() => setPrefs({ fontScale: stepFontScale(prefs.fontScale, -1) })}>A-</button>
        <span className="fs-label">{Math.round(prefs.fontScale * 100)}%</span>
        <button className="icon-btn" title="เพิ่มขนาดตัวอักษร" onClick={() => setPrefs({ fontScale: stepFontScale(prefs.fontScale, 1) })}>A+</button>
      </span>
      <button className="icon-btn" title="สลับธีมสว่าง/มืด" onClick={() => setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}>
        {prefs.theme === "dark" ? "☀️" : "🌙"}
      </button>
      {session && <span className="badge mms-who">👤 {session.displayName} • {isAdmin ? "แอดมิน" : "ผู้ใช้งาน"}</span>}
      {session && <button className="btn mms-btn-sm" onClick={logout}>ออก</button>}
      {filenOn
        ? <button className="btn mms-btn-sm" title={`ซิงค์ล่าสุด ${fmtDateTime(lastSync)}`} onClick={syncNow}>ซิงค์</button>
        : <button className="btn mms-btn-sm" onClick={() => go("settings")}>โหมด local</button>}
    </div>
  </div>
  <nav className={"mms-tabs" + (menuOpen ? " open" : "")}>
    <button className={tab === "dashboard" ? "on" : ""} onClick={() => go("dashboard")}>ภาพรวม</button>
    <button className={tab === "requests" ? "on" : ""} onClick={() => go("requests")}>คำขอใช้บริการ</button>
    <button className={tab === "worklogs" ? "on" : ""} onClick={() => go("worklogs")}>งานย้อนหลัง</button>
    <button className={tab === "assets" ? "on" : ""} onClick={() => go("assets")}>ยืม-คืนอุปกรณ์</button>
    <button className={tab === "portfolio" ? "on" : ""} onClick={() => go("portfolio")}>คลังผลงาน</button>
    {isAdmin && <button className={tab === "users" ? "on" : ""} onClick={() => go("users")}>ผู้ใช้งาน</button>}
    {isAdmin && <button className={tab === "audit" ? "on" : ""} onClick={() => go("audit")}>ประวัติการแก้ไข</button>}
    <button className={tab === "settings" ? "on" : ""} onClick={() => go("settings")}>ตั้งค่า</button>
  </nav>
</header>

      <main key={tab} className="page-enter">
        {tab === "dashboard" && <Dashboard db={dbView} session={session} goTab={setTab} mine={mineOn} />}
        {tab === "requests" && <Requests db={dbView} update={update} session={session} viewMine={mineOn} hasLink={!!myStaffName} />}
        {tab === "worklogs" && <WorkLogs db={db} update={update} session={session} />}
        {tab === "assets" && <Assets db={db} update={update} session={session} />}
        {tab === "portfolio" && <Portfolio db={db} update={update} session={session} />}
        {tab === "users" && isAdmin && <Users db={db} update={update} session={session} />}
        {tab === "audit" && isAdmin && <Audit db={db} />}
        {tab === "settings" && (
          <Settings db={db} update={update} filenOn={filenOn} connecting={connecting} lastSync={lastSync}
            onConnect={handleConnect}
            onDisconnect={() => { filenDisconnect(); setFilenOn(false); update(d => d, { action: "ตัดการเชื่อมต่อ Filen", entity: "system" }); }}
            onSyncNow={syncNow} onPullNow={pullNow}
            prefs={prefs} setPrefs={setPrefs} customUrl={customUrl} setCustomBg={setCustomBg}
            session={session} onLogout={logout} />
        )}
      </main>
    </>
  );
}