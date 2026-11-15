import { storage } from "./storage.js";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, Camera, Plus, X, Flame, Settings, Home, CalendarDays, LayoutGrid, TrendingUp, BarChart3, Wallet, Dumbbell, BookOpen, Briefcase, Sparkles, Play, Square, Droplets, Pencil, Target, ShieldAlert, PenLine, Timer, Bell, Compass } from "lucide-react";

/* ================= helpers ================= */
const STATE_KEY = "hww-state";
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtTime = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? "pm" : "am"}`; };
const sumBy = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const lastDays = (now, n) => Array.from({ length: n }, (_, i) => { const d = addDays(now, i - n + 1); return { d, k: dateKey(d) }; });
const dow = (d) => d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
const hrs = (min) => (min >= 60 ? `${(min / 60).toFixed(1).replace(/\.0$/, "")}h` : `${min}m`);
const WIN_AT = 0.8;

const AREAS = {
  health: { label: "Health", Icon: Dumbbell, op: 1 },
  business: { label: "Business", Icon: Briefcase, op: 0.68 },
  learning: { label: "Learning", Icon: BookOpen, op: 0.42 },
  personal: { label: "Personal", Icon: Sparkles, op: 0.22 },
};
const ACCENTS = {
  orange: { name: "Orange", c: "#FF7A1A", rgb: "255,122,26", on: "#16171A" },
  purple: { name: "Purple", c: "#8B6CFF", rgb: "139,108,255", on: "#FFFFFF" },
  blue: { name: "Electric blue", c: "#2F7BFF", rgb: "47,123,255", on: "#FFFFFF" },
};
const OUT_CATS = ["Food", "Transport", "Gym", "Study", "Business", "Bills", "Other"];
const IN_CATS = ["Client", "Salary", "Other"];
const STAGES = [["lead", "Leads"], ["contacted", "Contacted"], ["call", "Call booked"], ["client", "Clients"]];

const seed = () => ({
  v: 2, name: "Daud", mission: "Build an AI automation agency for creative editors.", accent: "orange", currency: "Rs", strict: true,
  blocks: [
    ["Wake up and breakfast", "health", "06:30", "07:30"], ["Studies", "learning", "08:00", "11:00"],
    ["Agency work: client outreach", "business", "11:15", "13:30"], ["Lunch and short rest", "health", "13:30", "14:30"],
    ["Build automations", "business", "14:30", "17:15"], ["Gym", "health", "17:30", "19:00"],
    ["Dinner", "health", "19:30", "20:15"], ["Learn one new AI tool", "learning", "20:30", "21:45"],
    ["Reflect, screens off, sleep", "personal", "22:30", "23:00"],
  ].map(([title, area, start, end]) => ({ id: uid(), title, area, start, end })),
  days: {},
  goals: [{
    id: uid(), title: "Launch my AI automation agency for creative editors", area: "business", deadline: "",
    milestones: ["Pick one service to sell first", "Build 3 demo automations", "Publish a one-page portfolio", "Message 20 editors and creators", "Sign the first paying client", "Reach 3 monthly retainers"].map((text) => ({ id: uid(), text, done: false })),
  }],
  habits: [
    { id: uid(), name: "Scrolling reels during work blocks", plan: "Phone goes in another room until the block ends.", since: Date.now(), best: 0, beaten: 0, slips: 0 },
    { id: uid(), name: "Staying up past midnight", plan: "Charger stays outside the bedroom.", since: Date.now(), best: 0, beaten: 0, slips: 0 },
  ],
  sessions: [], focus: null, tx: [], budget: 0, water: {}, sleep: {}, workouts: [], weights: [], courses: [], leads: [], revTarget: 0, journal: {},
  why: { reason: "", struggle: "", weak: "", drift: "", build: "", words: "" },
  notify: { blocks: true, lead: 10, goals: true, goalTime: "09:00", reflect: true, reflectTime: "22:00", sound: true },
  inbox: [], fired: { date: "", keys: {} },
});
const beep = () => { try { const A = window.AudioContext || window.webkitAudioContext; const a = new A(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.45); o.start(); o.stop(a.currentTime + 0.45); } catch (e) { /* no audio */ } };
const sysNotify = async (t, b) => {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const opts = { body: b, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: t };
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) await reg.showNotification(t, opts); else new Notification(t, opts);
  } catch (e) { /* alerts not allowed on this device */ }
};

const migrate = (d) => {
  const mp = { healthy: "health", wealthy: "business", wise: "learning" };
  const fix = (b) => (b.area ? b : { ...b, area: mp[b.pillar] || "personal" });
  const base = seed(); const out = { ...base, ...d, v: 2 };
  out.why = { ...base.why, ...(d.why || {}) }; out.notify = { ...base.notify, ...(d.notify || {}) };
  out.blocks = (out.blocks || []).map(fix);
  out.goals = (out.goals || []).map(fix);
  const days = {};
  Object.keys(out.days || {}).forEach((k) => { const r = out.days[k]; days[k] = { ...r, plan: (r.plan || []).map(fix), entries: r.entries || {} }; });
  out.days = days;
  return out;
};

const dayStat = (rec) => {
  const by = {}; Object.keys(AREAS).forEach((a) => (by[a] = { d: 0, t: 0, min: 0 }));
  if (!rec || !rec.plan) return { total: 0, done: 0, skipped: 0, pct: 0, won: false, by };
  let done = 0, skipped = 0;
  rec.plan.forEach((b) => {
    const e = rec.entries && rec.entries[b.id]; const a = by[b.area] || by.personal;
    a.t++;
    if (e && e.status === "done") { done++; a.d++; a.min += Math.max(0, toMin(b.end) - toMin(b.start)); }
    if (e && e.status === "skipped") skipped++;
  });
  const total = rec.plan.length; const pct = total ? done / total : 0;
  return { total, done, skipped, pct, won: total > 0 && pct >= WIN_AT, by };
};

const shrinkPhoto = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onerror = () => rej(new Error("Could not read the photo"));
  r.onload = () => {
    const img = new Image();
    img.onerror = () => rej(new Error("Could not open the photo"));
    img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      res(cv.toDataURL("image/jpeg", 0.7));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
});


/* ================= shared parts ================= */
function Sheet({ title, onClose, children, locked }) {
  return (
    <div className="veil" onClick={locked ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 14 }}>
          <h2 className="grow" style={{ fontSize: 21 }}>{title}</h2>
          {!locked && <button className="icon" onClick={onClose} aria-label="Close"><X size={20} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
function Seg({ value, onChange, options }) {
  return <div className="seg2">{options.map(([v, l]) => <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
function Head({ title, sub, right }) {
  return <div className="row" style={{ alignItems: "flex-start", marginBottom: 18 }}><div className="grow"><h1>{title}</h1>{sub && <div className="muted" style={{ marginTop: 5 }}>{sub}</div>}</div>{right}</div>;
}
function TwoTap({ label, confirm, onYes, className = "btn line sm" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t); }, [armed]);
  return <button className={armed ? className.replace(/line|ghost/, "warn") : className} onClick={() => (armed ? (setArmed(false), onYes()) : setArmed(true))}>{armed ? confirm : label}</button>;
}
function AreaPick({ value, onChange }) {
  return <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>{Object.keys(AREAS).map((a) => { const I = AREAS[a].Icon; return <button key={a} className={`chip ${value === a ? "on" : ""}`} onClick={() => onChange(a)}><I size={15} />{AREAS[a].label}</button>; })}</div>;
}
/* tap a bar to read its value */
function Bars({ data, fmt = (v) => v, initial }) {
  const [sel, setSel] = useState(initial == null ? data.length - 1 : initial);
  const max = Math.max(1, ...data.map((d) => d.value));
  const cur = data[Math.min(sel, data.length - 1)];
  return (
    <div>
      <div className="row" style={{ marginBottom: 12, alignItems: "baseline" }}><span className="num">{cur ? fmt(cur.value) : ""}</span><span className="muted small">{cur ? cur.long || cur.label : ""}</span></div>
      <div className="bars">
        {data.map((d, i) => (
          <button key={i} className={`${i === sel ? "sel" : ""} ${d.value ? "" : "zero"}`} onClick={() => setSel(i)} aria-label={`${d.long || d.label}: ${fmt(d.value)}`}>
            <div className="pill" style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }} />{d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
function Donut({ data, fmt }) {
  const [sel, setSel] = useState(null);
  const total = sumBy(data, (d) => d.value);
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const cur = sel != null ? data[sel] : null;
  return (
    <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Time by area">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--card2)" strokeWidth="16" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * C; const el = (
            <circle key={d.key} cx="70" cy="70" r={R} fill="none" stroke="var(--acc)" strokeOpacity={sel == null || sel === i ? d.op : d.op * 0.35} strokeWidth={sel === i ? 20 : 16}
              strokeDasharray={`${Math.max(0, len - 3)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" style={{ cursor: "pointer", transition: "stroke-width .2s,stroke-opacity .2s" }} onClick={() => setSel(sel === i ? null : i)} />
          ); off += len; return el;
        })}
        <text x="70" y="68" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="300">{total ? fmt(cur ? cur.value : total) : "0"}</text>
        <text x="70" y="86" textAnchor="middle" fill="var(--muted)" fontSize="11">{cur ? cur.label : "this week"}</text>
      </svg>
      <div className="grow" style={{ minWidth: 150 }}>
        {data.map((d, i) => (
          <button key={d.key} className="li" style={{ width: "100%", padding: "8px 0" }} onClick={() => setSel(sel === i ? null : i)}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: "var(--acc)", opacity: d.op }} />
            <span className="grow" style={{ textAlign: "left", color: sel === i ? "var(--ink)" : "var(--muted)" }}>{d.label}</span>
            <span>{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function Arc({ pct, big, small }) {
  const L = Math.PI * 80;
  return (
    <svg viewBox="0 0 200 118" style={{ width: "100%", maxWidth: 250, display: "block", margin: "0 auto" }} aria-hidden="true">
      <path d="M20 104 A80 80 0 0 1 180 104" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="12" strokeLinecap="round" />
      <path d="M20 104 A80 80 0 0 1 180 104" fill="none" stroke="var(--acc)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${Math.max(0.01, Math.min(1, pct)) * L} ${L}`} style={{ transition: "stroke-dasharray .6s ease" }} />
      <text x="100" y="88" textAnchor="middle" fill="#fff" fontSize="34" fontWeight="300">{big}</text>
      <text x="100" y="108" textAnchor="middle" fill="var(--muted)" fontSize="12">{small}</text>
    </svg>
  );
}
function Tile({ Icon, value, label, className = "half" }) {
  return <div className={`tile ${className}`}><div className="ic"><Icon size={18} color="var(--acc)" /></div><div><div className="num">{value}</div><div className="small muted" style={{ marginTop: 5 }}>{label}</div></div></div>;
}
function Strip({ c }) {
  const { sorted, today, nowMin } = c;
  if (!sorted.length) return null;
  const first = toMin(sorted[0].start), last = Math.max(...sorted.map((b) => toMin(b.end))), span = Math.max(1, last - first);
  return (
    <div>
      <div className="strip" aria-label="Your day at a glance">
        {sorted.map((b) => { const e = today.entries[b.id]; return <div key={b.id} className={`seg ${e ? e.status : ""}`} style={{ left: `${((toMin(b.start) - first) / span) * 100}%`, width: `${((toMin(b.end) - toMin(b.start)) / span) * 100}%`, opacity: e ? (e.status === "done" ? AREAS[b.area].op * 0.75 + 0.25 : 0.5) : 0.16 }} />; })}
        {nowMin >= first && nowMin <= last && <div className="needle" style={{ left: `${((nowMin - first) / span) * 100}%` }} />}
      </div>
      <div className="row small muted" style={{ justifyContent: "space-between", marginTop: 7 }}><span>{fmtTime(sorted[0].start)}</span><span>{fmtTime(sorted[sorted.length - 1].end)}</span></div>
    </div>
  );
}
function SkipForm({ onSkip, reason }) {
  const [why, setWhy] = useState("");
  return (
    <div className="stack" style={{ gap: 8 }}>
      {reason && <div className="card flat"><div className="small muted">Before you skip, remember why you started</div>{reason}</div>}
      <label style={{ margin: 0 }}>Why are you skipping it?</label>
      <textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Be honest. You will see this in Insights." />
      <button className="btn ghost full" disabled={why.trim().length < 8} onClick={() => onSkip(why.trim())}>Skip with this reason</button>
    </div>
  );
}

/* ================= block sheets ================= */
function BlockSheet({ id, locked, c }) {
  const { s, tk, today, photos, loadPhoto, savePhoto, setEntry, setOpenBlock, setEditBlock } = c;
  const b = s.blocks.find((x) => x.id === id);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [skipping, setSkipping] = useState(false);
  const fileRef = useRef(null);
  const e = today.entries[id]; const key = `hww-photo:${tk}:${id}`;
  useEffect(() => { if (e && e.photo) loadPhoto(key); }, [e && e.photo]);
  if (!b) return null;
  const onFile = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    setBusy(true); setErr("");
    try { await savePhoto(id, f); } catch (x) { setErr(x.message || "Could not save the photo. Try again."); }
    setBusy(false);
  };
  return (
    <div className="stack">
      <div className="small muted">{AREAS[b.area].label}, {fmtTime(b.start)} to {fmtTime(b.end)}</div>
      {e && e.photo && photos[key] && <img src={photos[key]} alt={`Proof for ${b.title}`} style={{ width: "100%", borderRadius: 16 }} />}
      {e && e.status === "skipped" && <div className="card flat"><div className="small muted">Your reason</div>{e.reason}</div>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
      {err && <div className="err">{err}</div>}
      {(!e || e.status !== "done") && <button className="btn full" onClick={() => { setEntry(id, { status: "done", reason: "" }); if (!locked) setOpenBlock(null); }}><Check size={18} />Mark done</button>}
      <button className="btn ghost full" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><Camera size={18} />{busy ? "Saving photo…" : e && e.photo ? "Replace proof photo" : "Mark done with a proof photo"}</button>
      {!e && (skipping ? <SkipForm reason={s.why.reason} onSkip={(reason) => { setEntry(id, { status: "skipped", reason }); if (!locked) setOpenBlock(null); }} /> : <button className="btn line full" onClick={() => setSkipping(true)}>Skip this block</button>)}
      {e && !locked && <button className="btn line full" onClick={() => setEntry(id, null)}>Undo, mark as not done</button>}
      {!locked && <button className="btn line full" onClick={() => { setOpenBlock(null); setEditBlock(b); }}><Pencil size={16} />Edit block</button>}
    </div>
  );
}
function BlockEditor({ init, c }) {
  const { setS, setEditBlock } = c;
  const [f, setF] = useState(init);
  const bad = !f.title.trim() ? "Give the block a name." : toMin(f.end) <= toMin(f.start) ? "End time must be after start time." : "";
  const save = () => { setS((p) => ({ ...p, blocks: f.id ? p.blocks.map((b) => (b.id === f.id ? { ...f, title: f.title.trim() } : b)) : [...p.blocks, { ...f, id: uid(), title: f.title.trim() }] })); setEditBlock(null); };
  return (
    <div className="stack">
      <div><label>Name</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Gym" /></div>
      <div className="row"><div className="grow"><label>Starts</label><input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value || f.start })} /></div><div className="grow"><label>Ends</label><input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value || f.end })} /></div></div>
      <div><label>Area of life</label><AreaPick value={f.area} onChange={(a) => setF({ ...f, area: a })} /></div>
      {bad && <div className="err">{bad}</div>}
      <button className="btn full" disabled={!!bad} onClick={save}>Save block</button>
      {f.id && <TwoTap label="Delete block" confirm="Tap again to delete" className="btn line full" onYes={() => { setS((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== f.id) })); setEditBlock(null); }} />}
    </div>
  );
}

/* ================= Home ================= */
function FocusCard({ c }) {
  const { s, setS, tk, nowMin, sorted, today, setOpenBlock } = c;
  const [, force] = useState(0);
  const on = !!s.focus;
  useEffect(() => { if (!on) return; const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, [on]);
  const current = sorted.find((b) => toMin(b.start) <= nowMin && nowMin < toMin(b.end));
  const next = sorted.find((b) => toMin(b.start) > nowMin);
  const entry = current && today.entries[current.id];
  const f = s.focus;
  const el = f ? Math.max(0, Math.floor((Date.now() - f.startedAt) / 1000)) : 0;
  const late = current ? nowMin - toMin(current.start) : 0;
  const start = () => setS((p) => ({ ...p, focus: { title: current ? current.title : "Free focus", area: current ? current.area : "personal", startedAt: Date.now(), target: current ? Math.max(5, toMin(current.end) - nowMin) : 25 } }));
  const stop = () => setS((p) => { if (!p.focus) return p; const min = Math.round((Date.now() - p.focus.startedAt) / 60000); return { ...p, focus: null, sessions: min >= 1 ? [...p.sessions, { id: uid(), date: tk, area: p.focus.area, min, label: p.focus.title }] : p.sessions }; });
  const status = f ? "Focusing" : !current ? (next ? `Free until ${fmtTime(next.start)}` : "Planned day is over") : entry ? (entry.status === "done" ? "Done" : "Skipped") : late > 5 ? `Started ${late} min ago. Start now.` : "On now";
  return (
    <div className="card glow c5 stack">
      <div><div className="small" style={{ color: "var(--acc)", fontWeight: 600 }}>{status}</div><div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2, marginTop: 2 }}>{f ? f.title : current ? current.title : next ? `Next: ${next.title}` : "Rest well"}</div></div>
      {!f && current && !entry && late > 5 && s.why.drift && <div className="small" style={{ background: "rgba(0,0,0,.28)", borderRadius: 12, padding: "9px 12px" }}><span className="muted">If you drift: </span>{s.why.drift}</div>}
      {f ? <Arc pct={el / (f.target * 60)} big={`${pad(Math.floor(el / 60))}:${pad(el % 60)}`} small={`of ${f.target} min`} />
        : current ? <Arc pct={late / (toMin(current.end) - toMin(current.start))} big={`${toMin(current.end) - nowMin}m`} small={`left, ends ${fmtTime(current.end)}`} />
        : <Arc pct={0} big="0:00" small="no timer running" />}
      <div className="row">
        {f ? <button className="btn white grow" onClick={stop}><Square size={16} />Stop and log</button> : <button className="btn white grow" onClick={start}><Play size={16} />Start focus</button>}
        {current && !entry && <button className="btn ghost grow" onClick={() => setOpenBlock(current.id)}><Check size={17} />Mark done</button>}
      </div>
    </div>
  );
}
/* review built on the device from the same facts, used when the AI coach is not reachable */
function localReview(f) {
  const planned = sumBy(f.days, (d) => d.planned), done = sumBy(f.days, (d) => d.done);
  if (!done) return "There is not enough tracked data yet.\nMark each block done or skipped today so your week can be reviewed.\nTomorrow: finish your first block on time.";
  const best = [...f.days].sort((a, b) => b.done - a.done)[0];
  const areas = f.byArea.filter((a) => a.planned > 0).map((a) => ({ ...a, pct: a.done / a.planned })).sort((a, b) => a.pct - b.pct);
  const weak = areas[0], strong = areas[areas.length - 1];
  const goal = f.goals.find((g) => g.stepsDone < g.steps);
  const good = `You finished ${done} of ${planned} blocks this week, with ${best.day} your best day${strong ? ` and ${AREAS[strong.area].label} your strongest area` : ""}.`;
  const leak = f.skips.length ? `Biggest leak: ${f.skips.length} skipped block${f.skips.length > 1 ? "s" : ""}, most recently ${f.skips[f.skips.length - 1].split(":")[0]}.` : weak && weak.pct < 1 ? `Biggest leak: ${AREAS[weak.area].label}, ${weak.done} of ${weak.planned} blocks done.` : "No clear leak this week. Keep the same routine.";
  const next = goal ? `Tomorrow: do the next step of "${goal.title}" before anything else.` : weak ? `Tomorrow: protect your first ${AREAS[weak.area].label} block.` : "Tomorrow: repeat today.";
  return `${good}\n${leak}\n${next}`;
}
function Coach({ c }) {
  const { s, week, streak } = c;
  const [busy, setBusy] = useState(false); const [text, setText] = useState("");
  const ask = async () => {
    setBusy(true);
    const skips = []; week.forEach((w) => w.rec && w.rec.plan.forEach((b) => { const e = w.rec.entries[b.id]; if (e && e.status === "skipped") skips.push(`${b.title}: ${e.reason}`); }));
    const facts = {
      mission: s.mission, why: s.why, streak, days: week.map((w) => ({ day: dow(w.d), done: w.st.done, planned: w.st.total })),
      byArea: Object.keys(AREAS).map((a) => ({ area: a, done: sumBy(week, (w) => w.st.by[a].d), planned: sumBy(week, (w) => w.st.by[a].t) })),
      focusMinutes: sumBy(s.sessions.filter((x) => week.some((w) => w.k === x.date)), (x) => x.min), skips: skips.slice(-6),
      habits: s.habits.map((h) => ({ name: h.name, daysClean: Math.floor((Date.now() - h.since) / 86400000), slips: h.slips || 0 })),
      goals: s.goals.map((g) => ({ title: g.title, stepsDone: g.milestones.filter((m) => m.done).length, steps: g.milestones.length })),
    };
    let t = "";
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: s.name, facts }) });
      if (r.ok) { const d = await r.json(); t = (d.text || "").trim(); }
    } catch (e) { /* offline or no coach backend: use the on-device review */ }
    setText(t || localReview(facts));
    setBusy(false);
  };
  return (
    <div className="card c4 stack">
      <div className="row"><span className="chip on"><Sparkles size={14} />AI coach</span></div>
      {text ? <div style={{ whiteSpace: "pre-line" }}>{text}</div> : <div className="muted">Get a 3-line review of your last 7 days: what worked, what leaked, and one move for tomorrow.</div>}
      <button className="btn ghost full" disabled={busy} onClick={ask}>{busy ? "Reviewing your week…" : text ? "Review again" : "Review my week"}</button>
    </div>
  );
}
function HomeTab({ c }) {
  const { s, now, tk, stat, streak, week, sorted, setTab, setShowSettings, setShowInbox } = c;
  const unread = s.inbox.filter((x) => !x.read).length;
  const hour = now.getHours(); const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const focusMin = sumBy(s.sessions.filter((x) => week.some((w) => w.k === x.date)), (x) => x.min);
  const mk = tk.slice(0, 7);
  const net = sumBy(s.tx.filter((t) => t.date.startsWith(mk)), (t) => (t.type === "in" ? t.amount : -t.amount));
  const balance = Object.keys(AREAS).map((a) => ({ key: a, label: AREAS[a].label, op: AREAS[a].op, value: sumBy(week, (w) => w.st.by[a].min) }));
  return (
    <div>
      <Head title={`${greet}${s.name ? `, ${s.name}` : ""}`} sub={`${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${s.mission ? `. ${s.mission}` : ""}`}
        right={<div className="row" style={{ gap: 8 }}><button className="icon" style={{ position: "relative" }} onClick={() => setShowInbox(true)} aria-label={`Reminders, ${unread} new`}><Bell size={20} />{unread > 0 && <span className="dot">{unread}</span>}</button><button className="icon" onClick={() => setShowSettings(true)} aria-label="Settings"><Settings size={20} /></button></div>} />
      <div className="grid">
        <Tile Icon={Flame} value={streak} label={`day streak${stat.won ? ", today won" : ""}`} />
        <Tile Icon={Check} value={`${stat.done}/${stat.total}`} label="blocks done today" />
        <Tile Icon={Timer} value={hrs(focusMin)} label="focused this week" />
        <Tile Icon={Wallet} value={`${net < 0 ? "-" : ""}${Math.abs(Math.round(net)).toLocaleString()}`} label={`${s.currency} net this month`} />
        <FocusCard c={c} />
        <div className="card c7 stack">
          <div className="row"><h2 className="grow">Today's timeline</h2><button className="btn ghost sm" onClick={() => setTab("plan")}>Open planner</button></div>
          {sorted.length ? <Strip c={c} /> : <div className="muted">No blocks yet. Open the planner to add your first one.</div>}
          <div className="small muted">A day is won at {WIN_AT * 100}% of blocks done. You are at {Math.round(stat.pct * 100)}%.</div>
          <div className="bar"><i style={{ width: `${stat.pct * 100}%` }} /></div>
        </div>
        <WhyCard c={c} />
        <div className="card c4"><h2 style={{ marginBottom: 12 }}>Completion</h2><Bars data={week.map((w) => ({ label: dow(w.d), long: w.d.toLocaleDateString(undefined, { weekday: "long" }), value: Math.round(w.st.pct * 100) }))} fmt={(v) => `${v}%`} /></div>
        <div className="card c4"><h2 style={{ marginBottom: 12 }}>Life balance</h2><Donut data={balance} fmt={hrs} /></div>
        <Coach c={c} />
      </div>
    </div>
  );
}

/* ================= Why + reminders ================= */
const WHY_FIELDS = [
  ["reason", "Why I am using this app", "e.g. I am tired of wasting days and want to build something real."],
  ["struggle", "What I am struggling with right now", "e.g. I don't know if my plans will work, so I avoid starting."],
  ["weak", "When I usually give in", "e.g. Late at night on my phone, or when a task feels too big."],
  ["drift", "My life in one year if I don't follow this plan", "Be specific. Where are you, what are you doing, how do you feel?"],
  ["build", "My life in one year if I do", "Be just as specific about the life you are building."],
  ["words", "What I tell myself in a weak moment", "One sentence in your own voice."],
];
function WhyCard({ c }) {
  const { s, setShowWhy } = c; const w = s.why;
  if (!(w.reason || w.drift || w.build || w.struggle)) return (
    <div className="card stack">
      <div className="row"><span className="chip on"><Compass size={14} />My why</span></div>
      <div style={{ fontSize: 21, fontWeight: 500 }}>Why are you here?</div>
      <div className="muted" style={{ maxWidth: 620 }}>Write what you are struggling with and the two lives ahead of you. The app shows your own words back to you when you are late, about to skip, or fighting an urge.</div>
      <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setShowWhy(true)}>Write my why</button>
    </div>);
  return (
    <div className="card stack">
      <div className="row"><span className="chip on"><Compass size={14} />My why</span><div className="grow" /><button className="btn ghost sm" onClick={() => setShowWhy(true)}><Pencil size={14} />Edit</button></div>
      {w.reason && <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>{w.reason}</div>}
      {w.struggle && <div className="muted">Right now: {w.struggle}</div>}
      {w.weak && <div className="muted">Watch out for: {w.weak}</div>}
      {(w.drift || w.build) && <div className="grid" style={{ gap: 10 }}>
        {w.drift && <div className="card flat c6"><div className="small muted" style={{ marginBottom: 4 }}>If I drift</div>{w.drift}</div>}
        {w.build && <div className="card flat c6" style={{ borderColor: "var(--acc)" }}><div className="small" style={{ color: "var(--acc)", marginBottom: 4 }}>If I follow the plan</div>{w.build}</div>}
      </div>}
    </div>);
}
function WhyBody({ c }) {
  const { s, setS, setShowWhy } = c;
  const [w, setW] = useState(s.why);
  return (
    <div className="stack">
      <div className="muted small">Only you see this. Be honest, and be fair to yourself: these are reminders, not punishments.</div>
      {WHY_FIELDS.map(([k, label, ph]) => <div key={k}><label>{label}</label><textarea rows={2} value={w[k] || ""} placeholder={ph} onChange={(e) => setW({ ...w, [k]: e.target.value })} /></div>)}
      <button className="btn full" onClick={() => { setS({ ...s, why: w }); setShowWhy(false); }}>Save my why</button>
    </div>);
}
function Toggle({ label, sub, on, onChange }) {
  return <button className="row" style={{ width: "100%", textAlign: "left", padding: "6px 0" }} role="switch" aria-checked={on} onClick={() => onChange(!on)}><div className="grow"><div style={{ fontWeight: 500 }}>{label}</div>{sub && <div className="small muted">{sub}</div>}</div><div className={`sw ${on ? "on" : ""}`}><i /></div></button>;
}
function InboxBody({ c }) {
  const { s, setS, pushNote } = c; const n = s.notify;
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const set = (k, v) => setS((p) => ({ ...p, notify: { ...p.notify, [k]: v } }));
  useEffect(() => { setS((p) => (p.inbox.some((x) => !x.read) ? { ...p, inbox: p.inbox.map((x) => ({ ...x, read: true })) } : p)); }, [s.inbox.length]);
  const askPerm = async () => { try { const r = await Notification.requestPermission(); setPerm(r); } catch (e) { setPerm("unsupported"); } };
  return (
    <div className="stack">
      <div>
        {s.inbox.length === 0 ? <div className="muted">No reminders yet. They appear here as your blocks come up.</div> : s.inbox.slice(0, 12).map((x) => (
          <div key={x.id} className="li" style={{ alignItems: "flex-start" }}><div className="grow"><div style={{ fontWeight: 500 }}>{x.title}</div><div className="small muted">{x.body}</div></div><div className="small muted" style={{ whiteSpace: "nowrap" }}>{new Date(x.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div></div>))}
      </div>
      {s.inbox.length > 0 && <button className="btn line sm" style={{ alignSelf: "flex-start" }} onClick={() => setS((p) => ({ ...p, inbox: [] }))}>Clear reminders</button>}
      <div className="card flat stack" style={{ gap: 8 }}>
        <h2>Reminder settings</h2>
        <Toggle label="Task reminders" sub="Before a block, when it starts, and 10 minutes after if you haven't started." on={n.blocks} onChange={(v) => set("blocks", v)} />
        <div className="row"><label className="grow" style={{ margin: 0 }}>Warn me before a block</label><select style={{ width: 130 }} value={n.lead} onChange={(e) => set("lead", parseInt(e.target.value))} aria-label="Warning time">{[[0, "No warning"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [30, "30 minutes"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <Toggle label="Goal reminders" sub="Your next step for each goal, plus your why, once a day." on={n.goals} onChange={(v) => set("goals", v)} />
        <div className="row"><label className="grow" style={{ margin: 0 }}>Goal reminder time</label><input type="time" style={{ width: 130 }} value={n.goalTime} onChange={(e) => set("goalTime", e.target.value || n.goalTime)} aria-label="Goal reminder time" /></div>
        <Toggle label="Evening reflection" sub="A nudge to write your journal." on={n.reflect} onChange={(v) => set("reflect", v)} />
        <div className="row"><label className="grow" style={{ margin: 0 }}>Reflection time</label><input type="time" style={{ width: 130 }} value={n.reflectTime} onChange={(e) => set("reflectTime", e.target.value || n.reflectTime)} aria-label="Reflection time" /></div>
        <Toggle label="Sound" on={n.sound} onChange={(v) => set("sound", v)} />
      </div>
      <button className="btn ghost full" onClick={() => pushNote([{ title: "Test reminder", body: s.why.reason ? `Remember: ${s.why.reason}` : "This is how reminders look." }])}>Send a test reminder</button>
      {perm === "granted" ? <div className="small muted">Phone alerts are on. They arrive while Rise is open or running in the background.</div>
        : perm === "default" ? <button className="btn line full" onClick={askPerm}>Turn on phone alerts</button>
        : <div className="small muted">{perm === "denied" ? "Phone alerts are blocked for this app. Allow notifications in your browser or phone settings to turn them on." : "On iPhone, add Rise to your Home Screen first, then open it from there to turn on phone alerts. Until then, reminders show inside the app."}</div>}
    </div>);
}

/* ================= Planner ================= */
function PlanTab({ c }) {
  const { now, sorted, today, stat, setOpenBlock, setEditBlock } = c;
  return (
    <div>
      <Head title="Planner" sub={`${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${stat.done} of ${stat.total} done`} />
      <div className="grid">
        <div className="card c8">
          <Strip c={c} />
          <ul className="tl" style={{ marginTop: 6 }}>
            {sorted.map((b) => { const e = today.entries[b.id]; const I = AREAS[b.area].Icon; return (
              <li key={b.id}>
                <div className="time">{fmtTime(b.start)}</div>
                <div className="rail" style={{ opacity: e ? 1 : 0.3 }} />
                <button className={`body ${e ? "gone" : ""}`} onClick={() => setOpenBlock(b.id)}>
                  <div className="grow"><div className="title" style={{ fontWeight: 500 }}>{b.title}</div><div className="small muted row" style={{ gap: 6 }}><I size={13} />{AREAS[b.area].label}, until {fmtTime(b.end)}{e && e.status === "skipped" ? ", skipped" : ""}</div></div>
                  {e && e.photo && <Camera size={16} color="var(--muted)" />}
                  <div className={`tick ${e && e.status === "done" ? "done" : ""}`}>{e && e.status === "done" && <Check size={17} />}{e && e.status === "skipped" && <X size={15} color="var(--muted)" />}</div>
                </button>
              </li>); })}
          </ul>
          {sorted.length === 0 && <p className="muted">No blocks yet. Add your first one to plan the day.</p>}
        </div>
        <div className="c4 stack">
          <button className="btn full" onClick={() => setEditBlock({ id: null, title: "", area: "health", start: "09:00", end: "10:00" })}><Plus size={18} />Add a block</button>
          <div className="card flat small muted">Tap a block to mark it done, add a proof photo, skip it with a reason, or edit it. Your routine repeats every day.</div>
        </div>
      </div>
    </div>
  );
}

/* ================= Life: finance, fitness, learning, business ================= */
function Finance({ c }) {
  const { s, setS, now, tk } = c;
  const [f, setF] = useState({ type: "out", amount: "", cat: "Food", note: "" });
  const mk = tk.slice(0, 7); const month = s.tx.filter((t) => t.date.startsWith(mk));
  const inc = sumBy(month.filter((t) => t.type === "in"), (t) => t.amount), out = sumBy(month.filter((t) => t.type === "out"), (t) => t.amount);
  const money = (n) => `${s.currency} ${Math.round(n).toLocaleString()}`;
  const days = lastDays(now, 7).map((x) => ({ label: dow(x.d), long: x.d.toLocaleDateString(undefined, { weekday: "long" }), value: sumBy(s.tx.filter((t) => t.date === x.k && t.type === "out"), (t) => t.amount) }));
  const cats = OUT_CATS.map((k) => [k, sumBy(month.filter((t) => t.type === "out" && t.cat === k), (t) => t.amount)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const amt = parseFloat(f.amount);
  return (
    <div className="grid">
      <Tile Icon={TrendingUp} value={Math.round(inc).toLocaleString()} label={`${s.currency} earned this month`} className="half c4" />
      <Tile Icon={Wallet} value={Math.round(out).toLocaleString()} label={`${s.currency} spent this month`} className="half c4" />
      <div className="card c4 stack">
        <div className="row"><h2 className="grow">Monthly budget</h2><input style={{ width: 120 }} inputMode="numeric" placeholder="Set amount" value={s.budget || ""} onChange={(e) => setS({ ...s, budget: parseFloat(e.target.value) || 0 })} aria-label="Monthly budget" /></div>
        <div className="bar"><i style={{ width: `${s.budget ? Math.min(100, (out / s.budget) * 100) : 0}%`, background: s.budget && out > s.budget ? "var(--danger)" : "var(--acc)" }} /></div>
        <div className="small muted">{s.budget ? (out > s.budget ? `${money(out - s.budget)} over budget` : `${money(s.budget - out)} left of ${money(s.budget)}`) : "Set a budget to see how much is left."}</div>
      </div>
      <div className="card c6"><h2 style={{ marginBottom: 12 }}>Spending, last 7 days</h2><Bars data={days} fmt={money} /></div>
      <div className="card c6 stack">
        <h2>Add money in or out</h2>
        <Seg value={f.type} onChange={(v) => setF({ ...f, type: v, cat: v === "in" ? "Client" : "Food" })} options={[["out", "Spent"], ["in", "Earned"]]} />
        <div className="row"><input className="grow" inputMode="decimal" placeholder={`Amount in ${s.currency}`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <select className="grow" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} aria-label="Category">{(f.type === "in" ? IN_CATS : OUT_CATS).map((k) => <option key={k}>{k}</option>)}</select></div>
        <input placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button className="btn full" disabled={!(amt > 0)} onClick={() => { setS({ ...s, tx: [...s.tx, { id: uid(), date: tk, type: f.type, amount: amt, cat: f.cat, note: f.note.trim() }] }); setF({ ...f, amount: "", note: "" }); }}>Save entry</button>
      </div>
      <div className="card c6"><h2 style={{ marginBottom: 6 }}>Where it went this month</h2>
        {cats.length === 0 ? <div className="muted small">Nothing spent yet this month.</div> : cats.map(([k, v]) => <div key={k} style={{ padding: "8px 0" }}><div className="row small" style={{ justifyContent: "space-between", marginBottom: 5 }}><span>{k}</span><span className="muted">{money(v)}</span></div><div className="bar"><i style={{ width: `${(v / out) * 100}%` }} /></div></div>)}
      </div>
      <div className="card c6"><h2 style={{ marginBottom: 6 }}>Recent entries</h2>
        {s.tx.length === 0 ? <div className="muted small">No entries yet. Add your first one.</div> : s.tx.slice(-8).reverse().map((t) => (
          <div key={t.id} className="li"><div className="grow"><div>{t.cat}{t.note ? `, ${t.note}` : ""}</div><div className="small muted">{t.date}</div></div><div style={{ color: t.type === "in" ? "var(--acc)" : "var(--ink)" }}>{t.type === "in" ? "+" : "-"}{Math.round(t.amount).toLocaleString()}</div>
            <button className="icon" style={{ background: "none" }} aria-label="Delete entry" onClick={() => setS({ ...s, tx: s.tx.filter((x) => x.id !== t.id) })}><X size={16} /></button></div>))}
      </div>
    </div>
  );
}
function Fitness({ c }) {
  const { s, setS, now, tk } = c;
  const [w, setW] = useState({ type: "Push", min: "60" }); const [kg, setKg] = useState("");
  const water = s.water[tk] || 0; const wk = lastDays(now, 7);
  const sessions = s.workouts.filter((x) => wk.some((d) => d.k === x.date));
  const pts = s.weights.slice(-12); const lo = Math.min(...pts.map((p) => p.kg)), hi = Math.max(...pts.map((p) => p.kg));
  return (
    <div className="grid">
      <div className="card c6 stack">
        <div className="row"><h2 className="grow">Water today</h2><span className="muted">{water} of 8 glasses</span></div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{Array.from({ length: 8 }, (_, i) => <button key={i} className={`drop ${i < water ? "on" : ""}`} aria-label={`${i + 1} glasses`} onClick={() => setS({ ...s, water: { ...s.water, [tk]: water === i + 1 ? i : i + 1 } })}><Droplets size={17} /></button>)}</div>
      </div>
      <div className="card c6 stack">
        <div className="row"><h2 className="grow">Sleep last night</h2><input style={{ width: 110 }} inputMode="decimal" placeholder="Hours" value={s.sleep[tk] || ""} onChange={(e) => setS({ ...s, sleep: { ...s.sleep, [tk]: e.target.value } })} aria-label="Hours slept" /></div>
        <Bars data={wk.map((x) => ({ label: dow(x.d), long: x.d.toLocaleDateString(undefined, { weekday: "long" }), value: parseFloat(s.sleep[x.k]) || 0 }))} fmt={(v) => `${v}h`} />
      </div>
      <div className="card c6 stack">
        <div className="row"><h2 className="grow">Workouts</h2><span className="muted">{sessions.length} this week</span></div>
        <div className="row"><select className="grow" value={w.type} onChange={(e) => setW({ ...w, type: e.target.value })} aria-label="Workout type">{["Push", "Pull", "Legs", "Full body", "Cardio", "Sport", "Other"].map((k) => <option key={k}>{k}</option>)}</select>
          <input style={{ width: 90 }} inputMode="numeric" value={w.min} onChange={(e) => setW({ ...w, min: e.target.value })} aria-label="Minutes" />
          <button className="btn" disabled={!(parseInt(w.min) > 0)} onClick={() => setS({ ...s, workouts: [...s.workouts, { id: uid(), date: tk, type: w.type, min: parseInt(w.min) }] })}>Log</button></div>
        {s.workouts.length === 0 ? <div className="muted small">No workouts logged yet.</div> : s.workouts.slice(-5).reverse().map((x) => <div key={x.id} className="li"><div className="grow">{x.type}<span className="muted small"> {x.date}</span></div><span className="muted">{x.min} min</span><button className="icon" style={{ background: "none" }} aria-label="Delete workout" onClick={() => setS({ ...s, workouts: s.workouts.filter((y) => y.id !== x.id) })}><X size={16} /></button></div>)}
      </div>
      <div className="card c6 stack">
        <div className="row"><h2 className="grow">Body weight</h2>{pts.length > 0 && <span className="num" style={{ fontSize: 24 }}>{pts[pts.length - 1].kg} kg</span>}</div>
        {pts.length > 1 ? <svg viewBox="0 0 300 80" style={{ width: "100%" }} aria-label="Weight trend"><polyline fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts.map((p, i) => `${6 + (i / (pts.length - 1)) * 288},${70 - ((p.kg - lo) / Math.max(0.1, hi - lo)) * 60}`).join(" ")} /></svg> : <div className="muted small">Log your weight twice to see the trend line.</div>}
        <div className="row"><input className="grow" inputMode="decimal" placeholder="Weight in kg" value={kg} onChange={(e) => setKg(e.target.value)} /><button className="btn" disabled={!(parseFloat(kg) > 0)} onClick={() => { setS({ ...s, weights: [...s.weights.filter((x) => x.date !== tk), { id: uid(), date: tk, kg: parseFloat(kg) }] }); setKg(""); }}>Log</button></div>
      </div>
    </div>
  );
}
function Learning({ c }) {
  const { s, setS, now, tk } = c;
  const [f, setF] = useState({ topic: "", min: "45" }); const [n, setN] = useState({ title: "", total: "" });
  const wk = lastDays(now, 7); const mins = (k) => sumBy(s.sessions.filter((x) => x.date === k && x.area === "learning"), (x) => x.min);
  return (
    <div className="grid">
      <div className="card c6"><h2 style={{ marginBottom: 12 }}>Study time, last 7 days</h2><Bars data={wk.map((x) => ({ label: dow(x.d), long: x.d.toLocaleDateString(undefined, { weekday: "long" }), value: mins(x.k) }))} fmt={hrs} /></div>
      <div className="card c6 stack">
        <h2>Log study time</h2>
        <input placeholder="What did you study?" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
        <div className="row"><input className="grow" inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} aria-label="Minutes" /><span className="muted">minutes</span>
          <button className="btn" disabled={!(parseInt(f.min) > 0)} onClick={() => { setS({ ...s, sessions: [...s.sessions, { id: uid(), date: tk, area: "learning", min: parseInt(f.min), label: f.topic.trim() || "Study" }] }); setF({ ...f, topic: "" }); }}>Log</button></div>
        <div className="small muted">Focus sessions you run during Learning blocks are added here automatically.</div>
      </div>
      <div className="card stack">
        <h2>Courses and skills</h2>
        {s.courses.length === 0 && <div className="muted small">Nothing here yet. Add a course, book or skill and count lessons as you finish them.</div>}
        {s.courses.map((k) => (
          <div key={k.id}><div className="row" style={{ marginBottom: 7 }}><div className="grow">{k.title}<span className="muted small"> {k.done} of {k.total}</span></div>
            <button className="btn ghost sm" disabled={k.done >= k.total} onClick={() => setS({ ...s, courses: s.courses.map((x) => (x.id === k.id ? { ...x, done: x.done + 1 } : x)) })}><Plus size={15} />Lesson done</button>
            <button className="icon" style={{ background: "none" }} aria-label="Remove course" onClick={() => setS({ ...s, courses: s.courses.filter((x) => x.id !== k.id) })}><X size={16} /></button></div>
            <div className="bar"><i style={{ width: `${(k.done / k.total) * 100}%` }} /></div></div>))}
        <div className="row"><input className="grow" placeholder="Course or skill" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} /><input style={{ width: 96 }} inputMode="numeric" placeholder="Lessons" value={n.total} onChange={(e) => setN({ ...n, total: e.target.value })} />
          <button className="btn" disabled={!n.title.trim() || !(parseInt(n.total) > 0)} onClick={() => { setS({ ...s, courses: [...s.courses, { id: uid(), title: n.title.trim(), total: parseInt(n.total), done: 0 }] }); setN({ title: "", total: "" }); }}>Add</button></div>
      </div>
    </div>
  );
}
function Business({ c }) {
  const { s, setS, now } = c;
  const [f, setF] = useState({ name: "", value: "" });
  const won = sumBy(s.leads.filter((l) => l.stage === "client"), (l) => l.value);
  const wk = lastDays(now, 7); const deep = sumBy(s.sessions.filter((x) => x.area === "business" && wk.some((d) => d.k === x.date)), (x) => x.min);
  const money = (n) => `${s.currency} ${Math.round(n).toLocaleString()}`;
  const move = (id, dir) => setS({ ...s, leads: s.leads.map((l) => { if (l.id !== id) return l; const i = STAGES.findIndex((x) => x[0] === l.stage); return { ...l, stage: STAGES[Math.max(0, Math.min(3, i + dir))][0] }; }) });
  return (
    <div className="grid">
      <Tile Icon={Briefcase} value={s.leads.filter((l) => l.stage === "client").length} label="paying clients" className="half c3" />
      <Tile Icon={Timer} value={hrs(deep)} label="focused on business this week" className="half c3" />
      <div className="card c6 stack">
        <div className="row"><h2 className="grow">Monthly revenue target</h2><input style={{ width: 130 }} inputMode="numeric" placeholder="Set target" value={s.revTarget || ""} onChange={(e) => setS({ ...s, revTarget: parseFloat(e.target.value) || 0 })} aria-label="Revenue target" /></div>
        <div className="bar"><i style={{ width: `${s.revTarget ? Math.min(100, (won / s.revTarget) * 100) : 0}%` }} /></div>
        <div className="small muted">{money(won)} from clients{s.revTarget ? ` of ${money(s.revTarget)}` : ". Set a target to track it."}</div>
      </div>
      <div className="card stack">
        <h2>Add a lead</h2>
        <div className="row"><input className="grow" placeholder="Editor, creator or studio name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input style={{ width: 120 }} inputMode="numeric" placeholder={`Value, ${s.currency}`} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          <button className="btn" disabled={!f.name.trim()} onClick={() => { setS({ ...s, leads: [...s.leads, { id: uid(), name: f.name.trim(), value: parseFloat(f.value) || 0, stage: "lead" }] }); setF({ name: "", value: "" }); }}>Add</button></div>
      </div>
      {STAGES.map(([k, label], i) => { const list = s.leads.filter((l) => l.stage === k); return (
        <div key={k} className="card c3">
          <div className="row" style={{ marginBottom: 4 }}><h2 className="grow">{label}</h2><span className="chip">{list.length}</span></div>
          {list.length === 0 && <div className="muted small" style={{ paddingTop: 6 }}>{i === 0 ? "Add people you could help." : "Nobody here yet."}</div>}
          {list.map((l) => (
            <div key={l.id} className="li" style={{ flexWrap: "wrap" }}><div className="grow"><div>{l.name}</div>{l.value > 0 && <div className="small muted">{money(l.value)}</div>}</div>
              {i > 0 && <button className="btn line sm" onClick={() => move(l.id, -1)}>Back</button>}
              {i < 3 && <button className="btn ghost sm" onClick={() => move(l.id, 1)}>Move on</button>}
              <button className="icon" style={{ background: "none", width: 30 }} aria-label="Remove lead" onClick={() => setS({ ...s, leads: s.leads.filter((x) => x.id !== l.id) })}><X size={15} /></button></div>))}
        </div>); })}
    </div>
  );
}
function LifeTab({ c }) {
  const [t, setT] = useState("finance");
  return (
    <div>
      <Head title="Life areas" sub="Money, body, mind and business in one place." />
      <div style={{ marginBottom: 14 }}><Seg value={t} onChange={setT} options={[["finance", "Finance"], ["fitness", "Fitness"], ["learning", "Learning"], ["business", "Business"]]} /></div>
      {t === "finance" && <Finance c={c} />}{t === "fitness" && <Fitness c={c} />}{t === "learning" && <Learning c={c} />}{t === "business" && <Business c={c} />}
    </div>
  );
}

/* ================= Growth: goals, habits, journal ================= */
function Goals({ c }) {
  const { s, setS, now } = c;
  const [adding, setAdding] = useState(false); const [g, setG] = useState({ title: "", area: "business", deadline: "" }); const [drafts, setDrafts] = useState({});
  const upd = (id, fn) => setS((p) => ({ ...p, goals: p.goals.map((x) => (x.id === id ? fn(x) : x)) }));
  return (
    <div className="grid">
      {s.goals.length === 0 && <p className="muted">No goals yet. Add one and split it into steps.</p>}
      {s.goals.map((goal) => {
        const done = goal.milestones.filter((m) => m.done).length; const pct = goal.milestones.length ? done / goal.milestones.length : 0;
        const left = goal.deadline ? Math.ceil((new Date(goal.deadline) - now) / 86400000) : null;
        return (
          <div key={goal.id} className="card c6 stack">
            <div><span className="chip on">{AREAS[goal.area].label}{left !== null ? (left >= 0 ? `, ${left} days left` : `, ${-left} days overdue`) : ""}</span><div style={{ fontWeight: 500, fontSize: 20, lineHeight: 1.25, marginTop: 10 }}>{goal.title}</div></div>
            <div><div className="bar"><i style={{ width: `${pct * 100}%` }} /></div><div className="small muted" style={{ marginTop: 6 }}>{done} of {goal.milestones.length} steps done</div></div>
            <div>{goal.milestones.map((m) => (
              <div key={m.id} className="li">
                <button className={`tick ${m.done ? "done" : ""}`} aria-label={m.done ? "Mark step not done" : "Mark step done"} onClick={() => upd(goal.id, (x) => ({ ...x, milestones: x.milestones.map((y) => (y.id === m.id ? { ...y, done: !y.done } : y)) }))}>{m.done && <Check size={17} />}</button>
                <div className="grow" style={m.done ? { textDecoration: "line-through", color: "var(--muted)" } : null}>{m.text}</div>
                <button className="icon" style={{ background: "none" }} aria-label="Remove step" onClick={() => upd(goal.id, (x) => ({ ...x, milestones: x.milestones.filter((y) => y.id !== m.id) }))}><X size={16} /></button>
              </div>))}</div>
            <div className="row"><input className="grow" placeholder="Add a step" value={drafts[goal.id] || ""} onChange={(e) => setDrafts({ ...drafts, [goal.id]: e.target.value })} />
              <button className="btn" disabled={!(drafts[goal.id] || "").trim()} aria-label="Add step" onClick={() => { upd(goal.id, (x) => ({ ...x, milestones: [...x.milestones, { id: uid(), text: drafts[goal.id].trim(), done: false }] })); setDrafts({ ...drafts, [goal.id]: "" }); }}><Plus size={18} /></button></div>
            <TwoTap label="Delete goal" confirm="Tap again to delete" onYes={() => setS((p) => ({ ...p, goals: p.goals.filter((x) => x.id !== goal.id) }))} />
          </div>);
      })}
      {adding ? (
        <div className="card c6 stack">
          <div><label>Goal</label><input value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="What do you want to achieve?" /></div>
          <div><label>Area of life</label><AreaPick value={g.area} onChange={(a) => setG({ ...g, area: a })} /></div>
          <div><label>Deadline (optional)</label><input type="date" value={g.deadline} onChange={(e) => setG({ ...g, deadline: e.target.value })} /></div>
          <div className="row"><button className="btn ghost grow" onClick={() => setAdding(false)}>Cancel</button><button className="btn grow" disabled={!g.title.trim()} onClick={() => { setS((p) => ({ ...p, goals: [...p.goals, { ...g, title: g.title.trim(), id: uid(), milestones: [] }] })); setG({ title: "", area: "business", deadline: "" }); setAdding(false); }}>Save goal</button></div>
        </div>) : <button className="btn ghost full c6" style={{ alignSelf: "start" }} onClick={() => setAdding(true)}><Plus size={18} />Add a goal</button>}
    </div>
  );
}
function Habits({ c }) {
  const { s, setS } = c;
  const [name, setName] = useState(""); const [plan, setPlan] = useState(""); const [urge, setUrge] = useState(null); const [, tick] = useState(0);
  const upd = (id, fn) => setS((p) => ({ ...p, habits: p.habits.map((x) => (x.id === id ? fn(x) : x)) }));
  const clean = (h) => Math.floor((Date.now() - h.since) / 86400000);
  const slip = (h) => { upd(h.id, (x) => ({ ...x, best: Math.max(x.best || 0, clean(x)), since: Date.now(), slips: (x.slips || 0) + 1 })); setUrge(null); };
  useEffect(() => {
    if (!urge || urge.won) return;
    const t = setInterval(() => { if (Date.now() >= urge.ends) { upd(urge.id, (x) => ({ ...x, beaten: (x.beaten || 0) + 1 })); setUrge({ ...urge, won: true }); } tick((n) => n + 1); }, 1000);
    return () => clearInterval(t);
  }, [urge]);
  const uh = urge && s.habits.find((h) => h.id === urge.id);
  const left = urge && !urge.won ? Math.max(0, Math.ceil((urge.ends - Date.now()) / 1000)) : 0;
  return (
    <div className="grid">
      {s.habits.length === 0 && <p className="muted">Nothing here yet. Name one habit you want to stop.</p>}
      {s.habits.map((h) => (
        <div key={h.id} className="card c6 stack">
          <div className="row" style={{ alignItems: "flex-start" }}><div className="grow" style={{ fontWeight: 500, fontSize: 18, lineHeight: 1.3 }}>{h.name}</div><div style={{ textAlign: "right" }}><div className="num" style={{ color: "var(--acc)" }}>{clean(h)}</div><div className="small muted">days clean</div></div></div>
          {h.plan && <div className="small" style={{ background: "var(--card2)", borderRadius: 12, padding: "10px 12px" }}><span className="muted">My rule: </span>{h.plan}</div>}
          <div className="small muted">Best run {Math.max(h.best || 0, clean(h))} days. Urges beaten {h.beaten || 0}. Slips {h.slips || 0}.</div>
          <div className="row"><button className="btn grow" onClick={() => setUrge({ id: h.id, ends: Date.now() + 5 * 60000 })}>I feel the urge</button><TwoTap label="I slipped" confirm="Reset to day 0" className="btn line" onYes={() => slip(h)} /></div>
          <TwoTap label="Remove habit" confirm="Tap again to remove" onYes={() => setS((p) => ({ ...p, habits: p.habits.filter((x) => x.id !== h.id) }))} />
        </div>))}
      <div className="card c6 stack">
        <div><label>Habit to break</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Checking my phone in bed" /></div>
        <div><label>My rule against it</label><input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="e.g. Phone charges in the other room" /></div>
        <button className="btn ghost full" disabled={!name.trim()} onClick={() => { setS((p) => ({ ...p, habits: [...p.habits, { id: uid(), name: name.trim(), plan: plan.trim(), since: Date.now(), best: 0, beaten: 0, slips: 0 }] })); setName(""); setPlan(""); }}><Plus size={18} />Add habit</button>
      </div>
      {urge && uh && (
        <Sheet title={urge.won ? "Urge beaten" : "Wait 5 minutes"} onClose={() => setUrge(null)} locked={!urge.won}>
          <div className="stack" style={{ textAlign: "center" }}>
            {urge.won ? (<><p style={{ margin: 0 }}>You waited it out. That counts.</p><button className="btn full" onClick={() => setUrge(null)}>Back to my day</button></>) : (<>
              <Arc pct={1 - left / 300} big={`${Math.floor(left / 60)}:${pad(left % 60)}`} small="until the urge passes" />
              <p className="muted" style={{ margin: 0 }}>Most urges fade if you wait. Put the phone down, stand up, drink water.</p>
              {uh.plan && <div className="card flat"><div className="small muted">My rule</div>{uh.plan}</div>}
              {s.why.words && <div className="card flat"><div className="small muted">What I tell myself</div>{s.why.words}</div>}
              <TwoTap label="I gave in" confirm="Reset to day 0" className="btn line full" onYes={() => slip(uh)} /></>)}
          </div>
        </Sheet>)}
    </div>
  );
}
function Journal({ c }) {
  const { s, setS, tk } = c;
  const j = s.journal[tk] || { win: "", lesson: "", next: "" };
  const set = (k, v) => setS({ ...s, journal: { ...s.journal, [tk]: { ...j, [k]: v } } });
  const past = Object.keys(s.journal).filter((k) => k !== tk && (s.journal[k].win || s.journal[k].lesson || s.journal[k].next)).sort().reverse().slice(0, 7);
  return (
    <div className="grid">
      <div className="card c6 stack">
        <h2>Tonight's reflection</h2>
        <div><label>Best thing I did today</label><textarea rows={2} value={j.win} onChange={(e) => set("win", e.target.value)} /></div>
        <div><label>What I learned</label><textarea rows={2} value={j.lesson} onChange={(e) => set("lesson", e.target.value)} /></div>
        <div><label>Tomorrow's one must-do</label><input value={j.next} onChange={(e) => set("next", e.target.value)} /></div>
        <div className="small muted">Saved as you type.</div>
      </div>
      <div className="card c6"><h2 style={{ marginBottom: 6 }}>Earlier entries</h2>
        {past.length === 0 ? <div className="muted small">Your past reflections will appear here.</div> : past.map((k) => <div key={k} className="li" style={{ display: "block" }}><div className="small muted">{k}</div>{s.journal[k].win && <div>{s.journal[k].win}</div>}{s.journal[k].lesson && <div className="muted">{s.journal[k].lesson}</div>}</div>)}
      </div>
    </div>
  );
}
function GrowthTab({ c }) {
  const [t, setT] = useState("goals");
  return (
    <div>
      <Head title="Growth" sub="Goals to reach, habits to drop, and a daily reflection." />
      <div style={{ marginBottom: 14 }}><Seg value={t} onChange={setT} options={[["goals", "Goals"], ["habits", "Break habits"], ["journal", "Journal"]]} /></div>
      {t === "goals" && <Goals c={c} />}{t === "habits" && <Habits c={c} />}{t === "journal" && <Journal c={c} />}
    </div>
  );
}

/* ================= Insights ================= */
function InsightsTab({ c }) {
  const { s, now, tk, streak, photos, loadPhoto } = c;
  const [range, setRange] = useState("week");
  const n = range === "week" ? 7 : 28;
  const days = lastDays(now, n).map((x) => ({ ...x, rec: s.days[x.k], st: dayStat(s.days[x.k]) }));
  const won = days.filter((x) => x.st.won).length, done = sumBy(days, (x) => x.st.done), total = sumBy(days, (x) => x.st.total);
  const focus = sumBy(s.sessions.filter((x) => days.some((d) => d.k === x.date)), (x) => x.min);
  const skips = [], shots = [];
  days.forEach((x) => x.rec && x.rec.plan.forEach((b) => { const e = x.rec.entries[b.id]; if (!e) return; if (e.status === "skipped") skips.push({ d: x.d, title: b.title, reason: e.reason }); if (e.photo) shots.push({ key: `hww-photo:${x.k}:${b.id}`, title: b.title, d: x.d }); }));
  const recent = shots.slice(-9).reverse();
  useEffect(() => { recent.forEach((p) => loadPhoto(p.key)); }, [range, recent.length]);
  return (
    <div>
      <Head title="Insights" sub="Only what you marked done counts." />
      <div style={{ marginBottom: 14, maxWidth: 360 }}><Seg value={range} onChange={setRange} options={[["week", "This week"], ["month", "Last 4 weeks"]]} /></div>
      <div className="grid">
        <Tile Icon={Flame} value={streak} label="day streak" />
        <Tile Icon={Target} value={`${won}/${n}`} label="days won" />
        <Tile Icon={Check} value={`${done}/${total}`} label="blocks done" />
        <Tile Icon={Timer} value={hrs(focus)} label="focus time" />
        <div className="card c7">
          <h2 style={{ marginBottom: 12 }}>Completion by day</h2>
          {range === "week" ? <Bars key="w" data={days.map((x) => ({ label: dow(x.d), long: x.d.toLocaleDateString(undefined, { weekday: "long" }), value: Math.round(x.st.pct * 100) }))} fmt={(v) => `${v}%`} />
            : <div className="cal">{days.map((x) => <div key={x.k} className="cell" title={`${Math.round(x.st.pct * 100)}%`} style={x.k === tk ? { outline: "2px solid #fff" } : null}><i style={{ opacity: x.st.pct }} /><b style={x.st.pct > 0.5 ? { color: "var(--on)" } : null}>{x.d.getDate()}</b></div>)}</div>}
        </div>
        <div className="card c5 stack">
          <h2>By area of life</h2>
          {Object.keys(AREAS).map((a) => { const d = sumBy(days, (x) => x.st.by[a].d), t = sumBy(days, (x) => x.st.by[a].t); return <div key={a}><div className="row small" style={{ justifyContent: "space-between", marginBottom: 6 }}><span>{AREAS[a].label}</span><span className="muted">{d} of {t}</span></div><div className="bar"><i style={{ width: `${t ? (d / t) * 100 : 0}%` }} /></div></div>; })}
        </div>
        <div className="card c6 stack"><h2>Proof photos</h2>{recent.length === 0 ? <div className="muted small">No photos yet. Add one when you finish a block.</div> : <div className="photos">{recent.map((p) => (photos[p.key] ? <img key={p.key} src={photos[p.key]} alt={`${p.title}, ${p.d.toLocaleDateString()}`} /> : <div key={p.key} className="cell" />))}</div>}</div>
        <div className="card c6"><h2 style={{ marginBottom: 6 }}>Why you skipped</h2>
          {skips.length === 0 ? <div className="muted small">No skipped blocks in this period.</div> : skips.slice(-8).reverse().map((x, i) => <div key={i} className="li" style={{ display: "block" }}><div>{x.title} <span className="small muted">{x.d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></div><div className="small muted">{x.reason}</div></div>)}
        </div>
      </div>
    </div>
  );
}

/* ================= Settings ================= */
function SettingsBody({ c }) {
  const { s, setS, setPhotos, setShowSettings } = c;
  return (
    <div className="stack">
      <div><label>Your name</label><input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
      <div><label>Your mission, shown on Home</label><input value={s.mission} onChange={(e) => setS({ ...s, mission: e.target.value })} /></div>
      <div className="row"><div className="grow"><label>Currency</label><input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value.slice(0, 4) })} /></div></div>
      <div><label>Accent colour</label><div className="row" style={{ flexWrap: "wrap", gap: 8 }}>{Object.keys(ACCENTS).map((k) => <button key={k} className="chip" style={s.accent === k ? { outline: `2px solid ${ACCENTS[k].c}`, color: "#fff" } : null} onClick={() => setS({ ...s, accent: k })}><span style={{ width: 12, height: 12, borderRadius: 6, background: ACCENTS[k].c }} />{ACCENTS[k].name}</button>)}</div></div>
      <button className="card flat row" style={{ textAlign: "left", width: "100%" }} onClick={() => setS({ ...s, strict: !s.strict })} role="switch" aria-checked={s.strict}>
        <div className="grow"><div style={{ fontWeight: 500 }}>Strict mode</div><div className="small muted">Locks the app until every past block is marked done or skipped with a reason.</div></div>
        <div style={{ width: 50, height: 30, borderRadius: 15, background: s.strict ? "var(--acc)" : "var(--card2)", padding: 3, flex: "none" }}><div style={{ width: 24, height: 24, borderRadius: 12, background: "#fff", marginLeft: s.strict ? 20 : 0, transition: "margin .15s" }} /></div>
      </button>
      <TwoTap label="Erase all data" confirm="Tap again to erase everything" className="btn line full" onYes={async () => {
        try { const l = await storage.list("hww-photo:", false); if (l && l.keys) for (const k of l.keys) { try { await storage.delete(k, false); } catch (e) { /* skip */ } } } catch (e) { /* none */ }
        setPhotos({}); setS(seed()); setShowSettings(false);
      }} />
    </div>
  );
}

/* ================= App ================= */
export default function Rise() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("home");
  const [now, setNow] = useState(new Date());
  const [saveErr, setSaveErr] = useState("");
  const [photos, setPhotos] = useState({});
  const [openBlock, setOpenBlock] = useState(null);
  const [editBlock, setEditBlock] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [toast, setToast] = useState(null);
  const loaded = useRef(false);

  useEffect(() => { (async () => {
    let data = null;
    try { const r = await storage.get(STATE_KEY, false); if (r && r.value) data = JSON.parse(r.value); } catch (e) { /* first run */ }
    setS(data ? migrate(data) : seed()); loaded.current = true;
  })(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!s || !loaded.current) return;
    const t = setTimeout(async () => {
      const msg = "Could not save. Your changes may be lost if you close the app.";
      try { const r = await storage.set(STATE_KEY, JSON.stringify(s), false); setSaveErr(r ? "" : msg); } catch (e) { setSaveErr(msg); }
    }, 500);
    return () => clearTimeout(t);
  }, [s]);

  const tk = dateKey(now); const nowMin = now.getHours() * 60 + now.getMinutes();
  useEffect(() => {
    if (!s) return;
    const rec = s.days[tk];
    if (!rec || JSON.stringify(rec.plan) !== JSON.stringify(s.blocks)) setS((p) => ({ ...p, days: { ...p.days, [tk]: { plan: p.blocks, entries: (p.days[tk] && p.days[tk].entries) || {} } } }));
  }, [s && s.blocks, tk, !!s]);

  const sorted = useMemo(() => (s ? [...s.blocks].sort((a, b) => toMin(a.start) - toMin(b.start)) : []), [s && s.blocks]);
  const week = useMemo(() => (s ? lastDays(now, 7).map((x) => ({ ...x, rec: s.days[x.k], st: dayStat(s.days[x.k]) })) : []), [s && s.days, tk]);
  const streak = useMemo(() => {
    if (!s) return 0; let d = new Date(now), n = 0;
    if (!dayStat(s.days[dateKey(d)]).won) d = addDays(d, -1);
    while (dayStat(s.days[dateKey(d)]).won) { n++; d = addDays(d, -1); }
    return n;
  }, [s && s.days, tk]);

  /* show reminders: inbox + toast + sound (+ system alert where the browser allows it) */
  const pushNote = (list, marks) => {
    const items = list.map((x) => ({ id: uid(), at: Date.now(), read: false, title: x.title, body: x.body }));
    setS((p) => ({ ...p, inbox: [...items.slice().reverse(), ...p.inbox].slice(0, 40), fired: marks ? { date: marks.date, keys: { ...(p.fired.date === marks.date ? p.fired.keys : {}), ...marks.keys } } : p.fired }));
    if (!items.length) return;
    setToast(items[items.length - 1]);
    if (s && s.notify.sound) beep();
    items.forEach((x) => sysNotify(x.title, x.body));
  };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 9000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!s) return;
    const n = s.notify; const rec = s.days[tk] || { entries: {} }; const fired = s.fired.date === tk ? s.fired.keys : {};
    const due = []; const keys = {};
    /* each group is in time order; only the latest one that is due (and under 30 min old) is shown */
    const group = (cands) => { let pick = null; cands.forEach((x) => { if (nowMin >= x.at && !fired[x.key]) { keys[x.key] = true; pick = nowMin < x.at + 30 ? x : null; } }); if (pick) due.push(pick); };
    if (n.blocks) s.blocks.forEach((b) => {
      if (rec.entries[b.id]) return; const st = toMin(b.start); const cands = [];
      if (n.lead > 0) cands.push({ key: `b:${b.id}:pre`, at: st - n.lead, title: `${b.title} starts in ${n.lead} min`, body: `Get ready. It runs until ${fmtTime(b.end)}.` });
      cands.push({ key: `b:${b.id}:go`, at: st, title: `${b.title} starts now`, body: "Start your focus timer." });
      cands.push({ key: `b:${b.id}:late`, at: st + 10, title: `${b.title} started 10 minutes ago`, body: s.why.drift ? `If you drift: ${s.why.drift}` : "Start now, or skip it with a reason." });
      group(cands);
    });
    if (n.goals) {
      const at = toMin(n.goalTime);
      if (s.why.reason) group([{ key: "why", at, title: "Why you started", body: s.why.build ? `${s.why.reason} Where this leads: ${s.why.build}` : s.why.reason }]);
      s.goals.forEach((g) => { const step = g.milestones.find((m) => !m.done); if (!step) return; const left = g.deadline ? Math.ceil((new Date(g.deadline) - now) / 86400000) : null; group([{ key: `g:${g.id}`, at, title: g.title, body: `Next step: ${step.text}.${left !== null ? (left >= 0 ? ` ${left} days left.` : ` ${-left} days overdue.`) : ""}` }]); });
    }
    if (n.reflect) { const j = s.journal[tk]; if (!(j && (j.win || j.lesson || j.next))) group([{ key: "reflect", at: toMin(n.reflectTime), title: "Time to reflect", body: "Write today's win, what you learned, and tomorrow's must-do." }]); }
    if (Object.keys(keys).length) pushNote(due, { date: tk, keys });
  }, [tk, nowMin, !!s, s && s.blocks, s && s.notify, s && s.days, s && s.goals]);

  if (!s) return (<div className="lo"><div className="main"><p className="muted">Loading your day…</p></div></div>);

  const today = s.days[tk] || { plan: sorted, entries: {} };
  const stat = dayStat(today);
  const setEntry = (id, entry) => setS((p) => {
    const rec = p.days[tk] || { plan: p.blocks, entries: {} }; const entries = { ...rec.entries };
    if (entry) entries[id] = { ...entries[id], ...entry, at: Date.now() }; else delete entries[id];
    return { ...p, days: { ...p.days, [tk]: { ...rec, entries } } };
  });
  const savePhoto = async (id, file) => {
    const url = await shrinkPhoto(file); const key = `hww-photo:${tk}:${id}`;
    const r = await storage.set(key, url, false); if (!r) throw new Error("Could not save the photo");
    setPhotos((p) => ({ ...p, [key]: url })); setEntry(id, { status: "done", photo: true });
  };
  const loadPhoto = async (key) => {
    if (photos[key]) return;
    try { const r = await storage.get(key, false); if (r && r.value) setPhotos((p) => ({ ...p, [key]: r.value })); } catch (e) { /* missing */ }
  };
  const overdue = sorted.filter((b) => toMin(b.end) <= nowMin && !today.entries[b.id]);
  const strictLock = s.strict && overdue.length > 0;
  const acc = ACCENTS[s.accent] || ACCENTS.orange;
  const c = { s, setS, now, tk, nowMin, sorted, today, stat, streak, week, photos, setPhotos, loadPhoto, savePhoto, setEntry, setOpenBlock, setEditBlock, setShowSettings, setTab, setShowWhy, setShowInbox, pushNote };
  const tabs = [["home", "Home", Home], ["plan", "Planner", CalendarDays], ["life", "Life", LayoutGrid], ["growth", "Growth", TrendingUp], ["insights", "Insights", BarChart3]];
  const NavBtns = () => tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}><Icon size={20} />{label}</button>);

  return (
    <div className="lo" style={{ "--acc": acc.c, "--accrgb": acc.rgb, "--on": acc.on }}>
      
      <div className="shell">
        <aside className="side">
          <div className="row" style={{ padding: "4px 10px 18px" }}><div style={{ width: 30, height: 30, borderRadius: 10, background: "var(--acc)" }} /><div style={{ fontSize: 20, fontWeight: 600 }}>Rise</div></div>
          {NavBtns()}
          <div className="grow" />
          <button onClick={() => setShowSettings(true)}><Settings size={20} />Settings</button>
        </aside>
        <main className="main">
          {saveErr && <div className="card err" style={{ marginBottom: 14 }}>{saveErr}</div>}
          {!s.strict && overdue.length > 0 && <div className="card err" style={{ marginBottom: 14 }}>{overdue.length} block{overdue.length > 1 ? "s" : ""} not accounted for. Open the planner and mark each one done or skipped.</div>}
          {tab === "home" && <HomeTab c={c} />}
          {tab === "plan" && <PlanTab c={c} />}
          {tab === "life" && <LifeTab c={c} />}
          {tab === "growth" && <GrowthTab c={c} />}
          {tab === "insights" && <InsightsTab c={c} />}
        </main>
      </div>
      <nav className="nav">{NavBtns()}</nav>

      {openBlock && !strictLock && <Sheet title={(s.blocks.find((b) => b.id === openBlock) || {}).title || "Block"} onClose={() => setOpenBlock(null)}><BlockSheet id={openBlock} c={c} /></Sheet>}
      {editBlock && <Sheet title={editBlock.id ? "Edit block" : "Add a block"} onClose={() => setEditBlock(null)}><BlockEditor init={editBlock} c={c} /></Sheet>}
      {toast && <button className="toast" onClick={() => { setToast(null); setShowInbox(true); }}><Bell size={20} color="var(--acc)" style={{ flex: "none", marginTop: 2 }} /><span className="grow"><span style={{ display: "block", fontWeight: 600 }}>{toast.title}</span><span className="small muted" style={{ display: "block" }}>{toast.body}</span></span></button>}
      {showWhy && <Sheet title="My why" onClose={() => setShowWhy(false)}><WhyBody c={c} /></Sheet>}
      {showInbox && <Sheet title="Reminders" onClose={() => setShowInbox(false)}><InboxBody c={c} /></Sheet>}
      {showSettings && <Sheet title="Settings" onClose={() => setShowSettings(false)}><SettingsBody c={c} /></Sheet>}
      {strictLock && !editBlock && !showSettings && !showWhy && !showInbox && (
        <Sheet title="Account for your day" locked onClose={() => {}}>
          <p className="muted" style={{ marginTop: -6 }}>{overdue[0].title} ended at {fmtTime(overdue[0].end)}. Did you do it?{overdue.length > 1 ? ` ${overdue.length - 1} more after this.` : ""}</p>
          <BlockSheet key={overdue[0].id} id={overdue[0].id} locked c={c} />
          <button className="btn line full" style={{ marginTop: 12 }} onClick={() => setShowSettings(true)}><Settings size={16} />Settings</button>
        </Sheet>)}
    </div>
  );
}
