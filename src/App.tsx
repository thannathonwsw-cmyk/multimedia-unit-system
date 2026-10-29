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
    } catch (e: any) { return String(e?.message ?? e); }
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
    { key: "assets", label: "ครุภัณฑ์" },
    { key: "portfolio", label: "คลังผลงาน" },
    ...(isAdmin ? [{ key: "users", label: "ผู้ใช้งาน" }, { key: "audit", label: "ประวัติการแก้ไข" }] : []),
    { key: "settings", label: "ตั้งค่า" },
  ];

  return (
    <>
      {bgLayer}
      <header>
        <h1>🎬 <span className="grad">หน่วยพัฒนาสื่อมัลติมีเดีย</span></h1>
        <nav>
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </nav>
        <div className="sync">
          <button className="icon-btn" title="การแจ้งเตือน" style={{ position: "relative" }} onClick={() => setTab("dashboard")}>
            🔔{alertCount > 0 && <span className="bell-dot">{alertCount}</span>}
          </button>
          <button className="icon-btn" title="ลดขนาดตัวอักษร" onClick={() => setPrefs({ fontScale: stepFontScale(prefs.fontScale, -1) })}>A−</button>
          <span className="fs-label">{Math.round(prefs.fontScale * 100)}%</span>
          <button className="icon-btn" title="เพิ่มขนาดตัวอักษร" onClick={() => setPrefs({ fontScale: stepFontScale(prefs.fontScale, 1) })}>A+</button>
          <button className="icon-btn" title="สลับมืด/สว่าง" onClick={() => setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}>
            {prefs.theme === "dark" ? "☀️" : "🌙"}
          </button>
          <span className="badge">👤 {session.displayName} • {isAdmin ? "แอดมิน" : "ผู้ใช้งาน"}</span>
          <button className="btn" onClick={logout}>ออกจากระบบ</button>
          {filenOn
            ? <><span className="muted">ซิงค์ {fmtDateTime(lastSync)}</span><button className="btn" onClick={syncNow}>ซิงค์</button></>
            : <button className="btn" onClick={() => setTab("settings")}>โหมด local</button>}
        </div>
      </header>

      <main key={tab} className="page-enter">
        {tab === "dashboard" && <Dashboard db={db} session={session} goTab={setTab} />}
        {tab === "requests" && <Requests db={db} update={update} session={session} />}
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