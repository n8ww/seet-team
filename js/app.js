import { api, isDemo } from './store.js?v=1';
import * as L from './logic.js?v=1';

const root = document.getElementById('root');
const dlg = document.getElementById('dlg');
const S = {
  me: null, month: L.monthOf(L.todayStr()), data: null, settings: L.settingsOf({}), team: null,
  filter: null, draft: null, ins: [], authMode: 'in', recovery: false, dlgTask: null, dlgQuality: null
};

// ---------- أدوات ----------
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const firstName = (n) => (n || '').split(' ')[0];
const initial = (n) => (n || '؟').trim().charAt(0);
const isLeader = () => !!(S.me && S.me.is_leader);
const profile = (id) => S.data.profiles.find((p) => p.id === id);
const av = (p, cls = '') => p ? `<span class="av ${cls}" style="background:${esc(p.color || '#d8c4a6')}" aria-hidden="true">${esc(initial(p.full_name))}</span>` : `<span class="av ${cls}" style="background:#3a2618;color:#a8917c" aria-hidden="true">؟</span>`;
const activeMembers = () => S.data.profiles.filter((p) => p.active !== false);

let toastT;
function toast(msg, err) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3200);
}

const I = {
  dash: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plan: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 17v-6M9 14l3-3 3 3"/>',
  tasks: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>',
  ai: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>'
};
const icon = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

// ---------- التشغيل ----------
let starting = null;
async function boot() {
  try { await api.init(); } catch (e) { root.innerHTML = `<div class="loading">تعذر الاتصال: ${esc(e.message)}</div>`; return; }
  api.onAuth((ev) => {
    if (ev === 'PASSWORD_RECOVERY') { S.recovery = true; renderLogin(); }
    else if (ev === 'SIGNED_OUT') { S.me = null; renderLogin(); }
    else if (ev === 'SIGNED_IN' && !S.me && !S.recovery) start();
  });
  window.addEventListener('hashchange', () => { if (S.me && S.data) render(); });
  await start();
}

function start() {
  if (!starting) starting = (async () => {
    try {
      S.me = await api.me();
      if (!S.me || S.me.denied || S.recovery) renderLogin();
      else { await load(); render(); }
    } catch (e) { toast(e.message, true); renderLogin(); }
    finally { starting = null; }
  })();
  return starting;
}

async function load() {
  S.data = await api.load(S.month, S.me);
  S.settings = L.settingsOf(S.data.settings);
  const fresh = S.data.profiles.find((p) => p.id === S.me.id);
  if (fresh) S.me = fresh;
  S.team = L.teamStats(S.data, S.settings);
  S.ins = isLeader() ? L.insights(S.data, S.settings, S.team) : [];
}

async function refresh() { await load(); render(true); }

async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); await refresh(); return true; }
  catch (e) { toast(e.message || 'صار خطأ', true); return false; }
}

// ---------- الدخول ----------
function renderLogin() {
  const box = (inner) => `<div class="login"><div class="login-box"><img class="logo" src="assets/logo.png" alt="صيت">${inner}</div></div>`;
  if (isDemo) {
    root.innerHTML = box(`<h1>متابعة أداء الفريق</h1>
      <div class="demo-bar">وضع تجريبي: البيانات تجريبية ومحفوظة في هذا المتصفح فقط. اختر شخص تدخل بحسابه.</div>
      ${api.demoUsers().filter((p) => p.active !== false).map((p) => `<button class="who" type="button" data-act="demo-login" data-id="${esc(p.id)}">${av(p)}<span class="grow"><span style="display:block">${esc(p.full_name)}</span><span class="muted" style="font-size:12px">${esc(p.role_title)}${p.is_leader ? ' · صلاحيات قائد' : ''}</span></span></button>`).join('')}`);
    return;
  }
  if (S.me && S.me.denied) {
    root.innerHTML = box(`<h1>بانتظار الإضافة</h1><p class="muted" style="text-align:center;line-height:1.9;margin:0">الإيميل <b style="color:var(--cream)">${esc(S.me.email)}</b> غير مضاف للفريق. اطلب من القائد يضيفه من الإعدادات، وبعدها حدّث الصفحة.</p><button class="btn" type="button" data-act="logout">تسجيل خروج</button>`);
    return;
  }
  if (S.recovery) {
    root.innerHTML = box(`<h1>كلمة مرور جديدة</h1><form class="card" data-form="newpass" style="display:flex;flex-direction:column;gap:14px"><label class="field">كلمة المرور الجديدة<input class="input" name="password" type="password" minlength="6" required autocomplete="new-password"></label><button class="btn pri" type="submit">حفظ</button></form>`);
    return;
  }
  const up = S.authMode === 'up';
  root.innerHTML = box(`<h1>${up ? 'إنشاء حساب' : 'تسجيل الدخول'}</h1>
    <form class="card" data-form="auth" style="display:flex;flex-direction:column;gap:14px">
      <label class="field">الإيميل<input class="input" name="email" type="email" required autocomplete="email" dir="ltr"></label>
      <label class="field">كلمة المرور<input class="input" name="password" type="password" minlength="6" required autocomplete="${up ? 'new-password' : 'current-password'}"></label>
      <button class="btn pri" type="submit">${up ? 'إنشاء الحساب' : 'دخول'}</button>
      <div class="row" style="justify-content:space-between;flex-wrap:wrap">
        <button class="btn ghost sm" type="button" data-act="auth-mode">${up ? 'عندي حساب' : 'أول مرة؟ أنشئ حساب'}</button>
        ${up ? '' : '<button class="btn ghost sm" type="button" data-act="forgot">نسيت كلمة المرور</button>'}
      </div>
    </form>
    <p class="muted" style="text-align:center;font-size:13px;margin:0">الدخول لفريق صيت فقط، بالإيميل اللي أضافه القائد.</p>`);
}

// ---------- الهيكل ----------
function route() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  return { name: parts[0] || 'dash', id: parts[1] || null };
}

function render(keep) {
  const r = route();
  const leaderOnly = ['plan', 'analyst', 'settings'];
  if (leaderOnly.includes(r.name) && !isLeader()) { location.hash = '#/'; return; }
  const views = { dash: viewDash, plan: viewPlan, tasks: viewTasks, team: viewTeam, reviews: viewReviews, analyst: viewAnalyst, settings: viewSettings };
  const v = views[r.name] || viewDash;
  const active = views[r.name] ? r.name : 'dash';
  const y = window.scrollY;
  root.innerHTML = shell(active, v(r));
  window.scrollTo(0, keep ? y : 0);
}

function shell(active, content) {
  const ld = isLeader();
  const items = [
    ['dash', '#/', 'dash', 'لوحة القيادة'],
    ld && ['plan', '#/plan', 'plan', 'الخطة الشهرية'],
    ['tasks', '#/tasks', 'tasks', ld ? 'المهام' : 'مهامي'],
    ['team', ld ? '#/team' : `#/team/${S.me.id}`, 'team', ld ? 'الفريق' : 'أدائي'],
    ['reviews', '#/reviews', 'award', ld ? 'التقييمات' : 'تقييمي'],
    ld && ['analyst', '#/analyst', 'ai', 'المحلل الذكي'],
    ld && ['settings', '#/settings', 'gear', 'الإعدادات']
  ].filter(Boolean);
  const cur = L.monthOf(L.todayStr());
  const months = [];
  for (let i = -6; i <= 1; i++) months.push(L.shiftMonth(cur, i));
  return `<div class="app">
  <aside class="side">
    <a href="#/" aria-label="الرئيسية" style="align-self:flex-start"><img class="logo" src="assets/logo.png" alt="صيت"></a>
    <nav class="nav" aria-label="القائمة الرئيسية">
      ${items.map(([k, href, ic, label]) => `<a href="${href}" class="${k === 'analyst' ? 'ai ' : ''}${k === active ? 'on' : ''}"${k === active ? ' aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}
    </nav>
    <div class="side-foot">
      <label class="field" style="min-width:150px">الشهر
        <select class="select" data-change="month">${months.map((m) => `<option value="${m}"${m === S.month ? ' selected' : ''}>${L.monthLabel(m)}</option>`).join('')}</select>
      </label>
      <div class="row" style="padding:4px 0">
        ${av(S.me)}
        <div class="grow"><div style="font-weight:600;font-size:14px">${esc(S.me.full_name)}</div><div class="muted" style="font-size:12px">${esc(S.me.role_title || '')}</div></div>
        <button class="btn icon-btn ghost" type="button" data-act="logout" aria-label="تسجيل خروج" title="تسجيل خروج">${icon('out')}</button>
      </div>
    </div>
  </aside>
  <main class="main">
    ${isDemo ? '<div class="demo-bar no-print">وضع تجريبي: البيانات محفوظة في هذا المتصفح فقط. بعد ربط Supabase يصير النظام مشترك للفريق كله.</div>' : ''}
    ${content}
  </main>
</div>`;
}

const header = (eyebrow, title, actions = '') => `<div class="top"><div><p class="eyebrow">${eyebrow}</p><h1 class="h1">${title}</h1></div>${actions ? `<div class="actions no-print">${actions}</div>` : ''}</div>`;

function kpi(label, value, unit, pctv, sub) {
  return `<div class="card kpi"><div class="muted" style="font-size:14px">${label}</div><div class="row" style="align-items:baseline;gap:8px"><span class="num">${value}</span><span class="muted" style="font-size:14px">${unit}</span></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, pctv))}%"></i></div><div class="muted" style="font-size:13px">${sub}</div></div>`;
}

function leaderboard() {
  const st = S.team.stats;
  const max = Math.max(1, ...st.map((x) => x.points));
  if (!st.length) return '<div class="empty">ما فيه أعضاء بعد.</div>';
  return st.map((x) => `<a class="list-row" href="#/team/${esc(x.member.id)}">
    <span class="num muted" style="width:22px;font-size:24px">${x.rank}</span>${av(x.member)}
    <span class="grow" style="display:flex;flex-direction:column;gap:8px">
      <span class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><span><b style="font-weight:600">${esc(x.member.full_name)}</b> <span class="muted" style="font-size:13px">· ${esc(x.member.role_title || '')}</span></span><span class="muted" style="font-size:12px">${x.doneCount} من ${x.total} مهام</span></span>
      <span class="bar"><i style="width:${Math.round(x.points / max * 100)}%;background:${esc(x.member.color)}"></i></span>
    </span>
    <span class="num" style="font-size:30px;min-width:56px;text-align:left">${fmt(x.points)}</span></a>`).join('');
}

function insightCard(n, i) {
  const a = n.action;
  return `<div class="insight"><div><span class="chip ${n.level >= 3 ? 'warn' : 'blue'}">${esc(n.tag)}</span></div><p>${esc(n.text)}</p>
    ${a ? `<div class="actions"><button class="btn sm pri" type="button" data-act="insight" data-i="${i}">${esc(a.label)}</button></div>` : ''}${n.taskId ? `<div class="actions"><button class="btn sm" type="button" data-act="open-task" data-id="${esc(n.taskId)}">افتح المهمة</button></div>` : ''}</div>`;
}

function taskRow(t, opts = {}) {
  const p = profile(t.assignee_id);
  const late = t.status !== 'done' && t.due_date && t.due_date < L.todayStr();
  return `<button type="button" class="list-row" data-act="open-task" data-id="${esc(t.id)}" style="width:100%;background:none;border-inline:0;border-bottom:0;font:inherit;cursor:pointer;text-align:right">
    ${opts.noAv ? '' : av(p, 'sm')}
    <span class="grow"><span style="display:block;font-weight:500;font-size:14px">${esc(t.title)}</span><span class="muted" style="font-size:12px">${esc(t.client || '—')}${opts.noAv ? '' : ' · ' + esc(p ? p.full_name : 'بدون مسؤول')} · ${L.STATUSES.find((s) => s.id === t.status).label}</span></span>
    <span class="chip ${late ? 'warn' : ''}">${late ? `متأخرة ${L.nDays(L.daysBetween(L.todayStr(), t.due_date))}` : esc(L.dayLabel(t.due_date))}</span>
    <span class="num" style="font-size:20px;min-width:38px;text-align:left;color:var(--sand)">+${t.points}</span></button>`;
}

// ---------- لوحة القيادة ----------
function viewDash() {
  const T = S.team, me = S.me;
  const fc = T.forecast;
  const soon = S.data.tasks.filter((t) => t.status !== 'done' && t.due_date && L.daysBetween(t.due_date, L.todayStr()) <= 7)
    .sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
  const eyebrow = `${L.monthLabel(S.month)}${fc.remaining > 0 && fc.elapsed > 0 ? ` · باقي ${L.nDays(fc.remaining)}` : ''}`;
  if (!isLeader()) {
    const x = T.stats.find((s) => s.member.id === me.id) || L.memberStats(me, S.data, S.settings);
    const mineSoon = x.open.slice().sort((a, b) => ((a.due_date || '9') > (b.due_date || '9') ? 1 : -1));
    const read = L.memberRead(x);
    return header(eyebrow, `أهلاً ${esc(firstName(me.full_name))}`, '<a class="btn pri" href="#/tasks">مهامي</a>') + `
    <section class="kpis" aria-label="مؤشراتي">
      ${kpi('نقاطي هذا الشهر', fmt(x.points), 'نقطة', 100, S.settings.showLeaderboard ? `ترتيبي ${x.rank || '—'} من ${T.stats.length}` : 'استمر')}
      ${kpi('المهام المكتملة', `${x.doneCount}/${x.total}`, '', x.parts.completion, `${x.parts.completion}% من مهامي`)}
      ${kpi('الالتزام بالمواعيد', x.parts.ontime, '%', x.parts.ontime, x.overdue.length ? `متأخر: ${L.nTasks(x.overdue.length)}` : 'ما عندي تأخير')}
      ${kpi('مؤشر الأداء', x.score, 'من 100', x.score, L.grade(x.score))}
    </section>
    <div class="split">
      <section class="card"><div class="card-h"><h2 class="card-t">مهامي المفتوحة</h2><a href="#/tasks" style="font-size:13px">لوحة المهام</a></div>
        ${mineSoon.length ? mineSoon.map((t) => taskRow(t, { noAv: true })).join('') : '<div class="empty">ما عندك مهام مفتوحة.</div>'}</section>
      ${S.settings.showLeaderboard ? `<section class="card"><div class="card-h"><h2 class="card-t">ترتيب الفريق</h2><span class="chip">${fmt(T.points)} نقطة</span></div>${leaderboard()}</section>`
        : `<section class="card ai"><h2 class="card-t">${icon('ai')}قراءة أدائي</h2><p style="font-size:15px;line-height:1.9">${esc(read.summary)}</p></section>`}
    </div>`;
  }
  const goals = L.goalProgress(S.data);
  return header(eyebrow, `أهلاً ${esc(firstName(me.full_name))}`, `<a class="btn" href="#/reviews">إصدار التقييمات</a><a class="btn pri" href="#/plan">${icon('up')}رفع الخطة</a>`) + `
  <section class="kpis" aria-label="مؤشرات الشهر">
    ${kpi('إنجاز الخطة', T.completion, '%', T.completion, `${T.done} من ${T.total} مهمة · التوقع ${fc.pct}%`)}
    ${kpi('نقاط الفريق', fmt(T.points), 'نقطة', 100, `${T.stats.length} أعضاء`)}
    ${kpi('الالتزام بالمواعيد', T.ontime, '%', T.ontime, T.overdue.length ? `متأخر حالياً: ${L.nTasks(T.overdue.length)}` : 'ما فيه تأخير')}
    ${kpi('جودة التسليم', T.quality ? T.quality.toFixed(1) : '—', 'من 5', T.quality / 5 * 100, 'متوسط تقييم القائد')}
  </section>
  <div class="split">
    <section class="card"><div class="card-h"><h2 class="card-t">ترتيب النقاط</h2><span class="chip">${fmt(T.points)} نقطة للفريق</span></div>${leaderboard()}</section>
    <section class="card ai" style="display:flex;flex-direction:column;gap:12px">
      <div class="card-h" style="margin:0"><h2 class="card-t">${icon('ai')}المحلل الذكي</h2><a href="#/analyst" class="blue" style="font-size:13px">التحليل الكامل</a></div>
      ${S.ins.length ? S.ins.slice(0, 3).map((n) => insightCard(n, S.ins.indexOf(n))).join('') : '<div class="empty">كل شي ماشي تمام، ما فيه تنبيهات.</div>'}
    </section>
  </div>
  <div class="split">
    <section class="card"><div class="card-h"><h2 class="card-t">أهداف ${L.monthLabel(S.month)}</h2><a href="#/plan" style="font-size:13px">الخطة</a></div>
      ${goals.length ? goals.map((g) => `<div style="display:flex;flex-direction:column;gap:8px;padding:10px 0"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><span style="font-weight:500">${esc(g.title)}</span><span class="muted" style="font-size:13px">${esc((profile(g.owner_id) || {}).full_name || '')} · ${g.done} من ${g.total}</span></div><div class="row"><div class="bar grow" style="height:8px"><i style="width:${g.pct}%"></i></div><span class="num" style="font-size:22px;min-width:46px;text-align:left">${g.pct}%</span></div></div>`).join('') : '<div class="empty">ما فيه أهداف لهالشهر. <a href="#/plan">ارفع الخطة</a></div>'}
    </section>
    <section class="card"><div class="card-h"><h2 class="card-t">تسليمات الأسبوع والمتأخر</h2><a href="#/tasks" style="font-size:13px">كل المهام</a></div>
      ${soon.length ? soon.slice(0, 8).map((t) => taskRow(t)).join('') : '<div class="empty">ما فيه تسليمات قريبة.</div>'}</section>
  </div>`;
}

// ---------- الخطة ----------
function viewPlan() {
  const members = activeMembers();
  const goals = S.data.goals;
  const d = S.draft;
  const load = {};
  members.forEach((m) => { load[m.id] = S.data.tasks.filter((t) => t.assignee_id === m.id && t.status !== 'done').reduce((a, t) => a + (t.points || 20), 0); });
  if (d) d.tasks.forEach((t) => { if (t.include && t.assignee_id) load[t.assignee_id] = (load[t.assignee_id] || 0) + Number(t.points || 0); });
  const maxLoad = Math.max(1, ...Object.values(load));
  const goalOpts = (sel) => `<option value="">بدون هدف</option>` + [...goals.map((g) => g.title), ...(d ? d.goals : [])].filter((v, i, a) => a.indexOf(v) === i).map((g) => `<option${g === sel ? ' selected' : ''}>${esc(g)}</option>`).join('');
  const memberOpts = (sel) => `<option value="">بدون مسؤول</option>` + members.map((m) => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.full_name)}</option>`).join('');
  return header(`خطة ${L.monthLabel(S.month)}`, 'ارفع الخطة، والمحلل يقسّمها ويوزّعها', `<button class="btn" type="button" data-act="new-task">+ مهمة يدوية</button>`) + `
  <div class="split">
    <section class="card">
      <div class="card-h"><h2 class="card-t">نص الخطة</h2><span class="muted" style="font-size:12px">انسخها من Word أو PDF والصقها هنا</span></div>
      <form data-form="parse" style="display:flex;flex-direction:column;gap:12px">
        <label class="field"><span class="sr">نص الخطة</span><textarea class="textarea" name="text" rows="10" placeholder="هدف: حملة الشتاء لوِكاد
- هوية بصرية لحملة الشتاء لعميل وِكاد كبيرة قبل 5/11
- تصوير منتجات الشتاء
- حملة سناب وتيك توك للإطلاق
الكيترينق:
- عروض أسعار لـ 3 فعاليات
- خطة محتوى ديسمبر لرهف">${esc(d ? d.text : '')}</textarea></label>
        <p class="muted" style="margin:0;font-size:12px;line-height:1.8">كل سطر = مهمة. السطر اللي ينتهي بـ «:» أو يبدأ بـ «هدف:» = هدف. اذكر اسم الموظف لو تبي تحدده، والحجم (صغيرة/متوسطة/كبيرة) والتاريخ (مثل 5/11). أو بصيغة: المهمة | العميل | المسؤول | الحجم | التاريخ</p>
        <div class="actions"><button class="btn ai" type="submit">${icon('ai')}حلّل ووزّع</button>${d ? '<button class="btn" type="button" data-act="draft-cancel">إلغاء</button>' : ''}</div>
      </form>
    </section>
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <section class="card">
        <div class="card-h"><h2 class="card-t">توازن الحمل</h2><span class="muted" style="font-size:12px">نقاط المهام المفتوحة${d ? ' + المقترحة' : ''}</span></div>
        ${members.map((m) => `<div style="display:flex;flex-direction:column;gap:6px;padding:7px 0"><div class="row" style="justify-content:space-between"><span class="row" style="gap:8px">${av(m, 'sm')}<span style="font-size:14px">${esc(m.full_name)}</span></span><span class="num" style="font-size:20px">${load[m.id] || 0}</span></div><div class="bar"><i style="width:${Math.round((load[m.id] || 0) / maxLoad * 100)}%;background:${esc(m.color)}"></i></div></div>`).join('')}
      </section>
      <section class="card">
        <div class="card-h"><h2 class="card-t">أهداف الشهر</h2></div>
        ${goals.map((g) => `<div class="list-row"><span class="grow">${esc(g.title)}</span><span class="muted" style="font-size:12px">${esc((profile(g.owner_id) || {}).full_name || '')}</span><button class="btn icon-btn ghost" type="button" data-act="del-goal" data-id="${esc(g.id)}" aria-label="حذف الهدف ${esc(g.title)}">${icon('x')}</button></div>`).join('') || '<div class="muted" style="font-size:13px;padding-bottom:10px">ما فيه أهداف بعد.</div>'}
        <form data-form="goal" class="row" style="margin-top:10px;flex-wrap:wrap">
          <label class="field grow" style="min-width:160px"><span class="sr">هدف جديد</span><input class="input" name="title" required placeholder="هدف جديد"></label>
          <label class="field" style="min-width:140px"><span class="sr">المسؤول</span><select class="select" name="owner">${memberOpts('')}</select></label>
          <button class="btn" type="submit">إضافة</button>
        </form>
      </section>
    </div>
  </div>
  ${d ? `<section class="card">
    <div class="card-h"><h2 class="card-t">المهام المقترحة (${d.tasks.filter((t) => t.include).length} من ${d.tasks.length})</h2>
      <div class="actions"><span class="muted" style="font-size:12px">راجع وعدّل، بعدها اعتمد</span><button class="btn pri" type="button" data-act="draft-approve">${icon('check')}اعتماد وإرسال للفريق</button></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th><span class="sr">تضمين</span></th><th>المهمة</th><th>العميل</th><th>المسؤول</th><th>الحجم</th><th>النقاط</th><th>التسليم</th><th>الهدف</th><th>ليش؟</th></tr></thead><tbody>
    ${d.tasks.map((t, i) => `<tr style="${t.include ? '' : 'opacity:.45'}">
      <td><input type="checkbox" aria-label="تضمين المهمة" data-change="draft" data-i="${i}" data-k="include"${t.include ? ' checked' : ''} style="width:18px;height:18px;accent-color:#d8c4a6"></td>
      <td><input class="input" aria-label="المهمة" value="${esc(t.title)}" data-change="draft" data-i="${i}" data-k="title" style="min-width:220px"></td>
      <td><input class="input" aria-label="العميل" value="${esc(t.client)}" data-change="draft" data-i="${i}" data-k="client" style="width:110px"></td>
      <td><select class="select" aria-label="المسؤول" data-change="draft" data-i="${i}" data-k="assignee_id">${memberOpts(t.assignee_id)}</select></td>
      <td><select class="select" aria-label="الحجم" data-change="draft" data-i="${i}" data-k="size">${['S', 'M', 'L'].map((s) => `<option value="${s}"${s === t.size ? ' selected' : ''}>${L.SIZE_LABEL[s]}</option>`).join('')}</select></td>
      <td><input class="input" type="number" min="0" aria-label="النقاط" value="${t.points}" data-change="draft" data-i="${i}" data-k="points" style="width:70px"></td>
      <td><input class="input" type="date" aria-label="التسليم" value="${esc(t.due_date)}" data-change="draft" data-i="${i}" data-k="due_date"></td>
      <td><select class="select" aria-label="الهدف" data-change="draft" data-i="${i}" data-k="goal">${goalOpts(t.goal)}</select></td>
      <td class="blue" style="font-size:12px;max-width:180px;line-height:1.6">${esc(t.reason)}</td></tr>`).join('')}
    </tbody></table></div></section>` : ''}`;
}

// ---------- المهام ----------
function viewTasks() {
  const ld = isLeader();
  if (S.filter == null) S.filter = ld ? 'all' : S.me.id;
  const members = activeMembers();
  const shown = S.data.tasks.filter((t) => S.filter === 'all' || t.assignee_id === S.filter);
  const filters = ld
    ? [`<button type="button" class="f all${S.filter === 'all' ? ' on' : ''}" data-act="filter" data-id="all" aria-pressed="${S.filter === 'all'}">كل الفريق</button>`,
       ...members.map((m) => `<button type="button" class="f${S.filter === m.id ? ' on' : ''}" data-act="filter" data-id="${esc(m.id)}" aria-pressed="${S.filter === m.id}">${av(m, 'sm')}${esc(m.full_name)}</button>`)]
    : [`<button type="button" class="f all${S.filter !== 'all' ? ' on' : ''}" data-act="filter" data-id="${esc(S.me.id)}" aria-pressed="${S.filter !== 'all'}">مهامي</button>`,
       `<button type="button" class="f all${S.filter === 'all' ? ' on' : ''}" data-act="filter" data-id="all" aria-pressed="${S.filter === 'all'}">كل الفريق</button>`];
  const s = S.settings;
  return header(`${L.monthLabel(S.month)} · ${shown.length} مهمة`, ld ? 'لوحة المهام' : 'مهامي', ld ? '<button class="btn pri" type="button" data-act="new-task">+ مهمة جديدة</button>' : '') + `
  <div class="filters" role="group" aria-label="تصفية">${filters.join('')}</div>
  <section class="rules" aria-label="نظام النقاط">
    <div class="rule"><span>حجم المهمة</span>صغيرة 10 · متوسطة 20 · كبيرة 30</div>
    <div class="rule"><span>تسليم قبل الموعد</span><b style="color:var(--sand);font-weight:500">+${s.earlyBonus}% من نقاط المهمة</b></div>
    <div class="rule"><span>جودة 5 من 5</span><b style="color:var(--sand);font-weight:500">+${s.qualityBonus} نقاط</b></div>
    <div class="rule"><span>تأخير بسبب الموظف</span><b class="warn" style="font-weight:500">−${s.latePenalty}% لكل يوم</b></div>
  </section>
  <div class="board-wrap"><div class="board">
    ${L.STATUSES.map((st) => {
      const items = shown.filter((t) => t.status === st.id).sort((a, b) => ((a.due_date || '9') > (b.due_date || '9') ? 1 : -1));
      return `<section class="col" aria-label="${st.label}"><div class="col-h"><span><span class="dot" style="background:${st.dot}"></span>${st.label}</span><span class="num muted" style="font-size:20px">${items.length}</span></div>
      ${items.map((t) => {
        const p = profile(t.assignee_id);
        const late = t.status !== 'done' && t.due_date && t.due_date < L.todayStr();
        const pts = t.status === 'done' ? L.taskPoints(t, s).total : t.points;
        return `<button type="button" class="tc" data-act="open-task" data-id="${esc(t.id)}">
          <span class="row" style="justify-content:space-between;gap:8px">${t.client ? `<span class="chip">${esc(t.client)}</span>` : '<span></span>'}<span class="num" style="font-size:20px;color:var(--sand)">${pts}</span></span>
          <h3>${esc(t.title)}</h3>
          ${t.late_reason ? `<span class="tc-note">سبب التأخير: ${L.LATE_REASONS[t.late_reason]}</span>` : ''}
          ${t.quality ? `<span class="muted" style="font-size:12px">الجودة ${t.quality}/5</span>` : ''}
          <span class="row" style="justify-content:space-between;gap:8px"><span class="row" style="gap:8px;font-size:13px">${av(p, 'sm')}${esc(p ? p.full_name : 'بدون مسؤول')}</span><span style="font-size:12px" class="${late ? 'warn' : 'muted'}">${late ? `متأخرة ${L.nDays(L.daysBetween(L.todayStr(), t.due_date))}` : esc(L.dayLabel(t.due_date))}</span></span>
        </button>`;
      }).join('') || '<div class="empty" style="padding:16px 8px">لا شيء</div>'}</section>`;
    }).join('')}
  </div></div>`;
}

function openTask(id) {
  const ld = isLeader();
  const t = id ? S.data.tasks.find((x) => x.id === id) : { id: null, title: '', client: '', description: '', assignee_id: '', goal_id: '', size: 'M', points: 20, due_date: '', status: 'new', quality: null, late_reason: null };
  if (!t) return;
  S.dlgTask = t;
  S.dlgQuality = t.quality || null;
  const p = profile(t.assignee_id);
  const mine = t.assignee_id === S.me.id;
  const late = t.status !== 'done' && t.due_date && t.due_date < L.todayStr();
  const reasonSel = (name) => `<label class="field">سبب التأخير<select class="select" name="${name}"><option value="">—</option>${Object.entries(L.LATE_REASONS).map(([k, v]) => `<option value="${k}"${t.late_reason === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`;
  let body;
  if (ld) {
    body = `<form data-form="task" style="display:flex;flex-direction:column;gap:14px">
      <label class="field">المهمة<input class="input" name="title" required value="${esc(t.title)}"></label>
      <div class="form-grid">
        <label class="field">العميل<input class="input" name="client" value="${esc(t.client)}"></label>
        <label class="field">المسؤول<select class="select" name="assignee_id"><option value="">بدون مسؤول</option>${activeMembers().map((m) => `<option value="${esc(m.id)}"${m.id === t.assignee_id ? ' selected' : ''}>${esc(m.full_name)}</option>`).join('')}</select></label>
        <label class="field">الهدف<select class="select" name="goal_id"><option value="">بدون هدف</option>${S.data.goals.map((g) => `<option value="${esc(g.id)}"${g.id === t.goal_id ? ' selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
        <label class="field">الحجم<select class="select" name="size" data-change="size">${['S', 'M', 'L'].map((s) => `<option value="${s}"${s === t.size ? ' selected' : ''}>${L.SIZE_LABEL[s]}</option>`).join('')}</select></label>
        <label class="field">النقاط<input class="input" type="number" min="0" name="points" value="${t.points}"></label>
        <label class="field">موعد التسليم<input class="input" type="date" name="due_date" value="${esc(t.due_date || '')}"></label>
        <label class="field">الحالة<select class="select" name="status">${L.STATUSES.map((s) => `<option value="${s.id}"${s.id === t.status ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label>
        ${reasonSel('late_reason')}
      </div>
      <label class="field">التفاصيل<textarea class="textarea" name="description" rows="3" style="min-height:80px">${esc(t.description || '')}</textarea></label>
      ${t.id && (t.status === 'review' || t.status === 'done') ? `<div class="field">تقييم الجودة<div class="stars" role="group" aria-label="الجودة">${[5, 4, 3, 2, 1].map((n) => `<button type="button" class="star${S.dlgQuality === n ? ' on' : ''}" data-act="q" data-v="${n}" aria-pressed="${S.dlgQuality === n}">${n}</button>`).join('')}</div></div>` : ''}
      ${t.submitted_at ? `<p class="muted" style="margin:0;font-size:13px">سُلّمت ${esc(t.submitted_at)}${t.due_date ? ` · الموعد ${esc(t.due_date)}` : ''}${t.status === 'done' ? ` · النقاط المحتسبة ${L.taskPoints(t, S.settings).total}` : ''}</p>` : ''}
      <div class="actions" style="justify-content:space-between">
        <span class="actions">${t.id && t.status === 'review' ? `<button class="btn pri" type="button" data-act="approve-task">${icon('check')}اعتماد التسليم</button>` : ''}<button class="btn ${t.id && t.status === 'review' ? '' : 'pri'}" type="submit">حفظ</button></span>
        ${t.id ? '<button class="btn danger" type="button" data-act="del-task">حذف</button>' : ''}
      </div></form>`;
  } else {
    const info = `<div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
      <div class="row">${av(p, 'sm')}<span>${esc(p ? p.full_name : 'بدون مسؤول')}</span></div>
      <div class="muted">العميل: <span style="color:var(--cream)">${esc(t.client || '—')}</span> · الحجم: ${L.SIZE_LABEL[t.size]} · ${t.points} نقطة</div>
      <div class="muted">التسليم: <span class="${late ? 'warn' : ''}" style="${late ? '' : 'color:var(--cream)'}">${esc(t.due_date || '—')}</span> · الحالة: ${L.STATUSES.find((s) => s.id === t.status).label}</div>
      ${t.description ? `<p style="margin:0;line-height:1.8">${esc(t.description)}</p>` : ''}
      ${t.quality ? `<div class="muted">تقييم الجودة: <span style="color:var(--sand)">${t.quality}/5</span></div>` : ''}</div>`;
    let acts = '';
    if (mine && t.status !== 'done') {
      acts = `<form data-form="mystatus" style="display:flex;flex-direction:column;gap:12px">
        ${late || t.late_reason ? reasonSel('reason') : ''}
        <div class="actions">
          ${t.status === 'new' ? '<button class="btn" type="submit" name="to" value="doing">بدأت فيها</button>' : ''}
          ${t.status !== 'review' ? '<button class="btn pri" type="submit" name="to" value="review">سلّمتها للمراجعة</button>' : '<button class="btn" type="submit" name="to" value="doing">رجّعها للتنفيذ</button>'}
        </div></form>`;
    }
    body = info + acts;
  }
  dlg.innerHTML = `<div class="dlg"><div class="dlg-h"><h2>${t.id ? esc(t.title) : 'مهمة جديدة'}</h2><button class="btn icon-btn ghost" type="button" data-act="close" aria-label="إغلاق">${icon('x')}</button></div>${body}</div>`;
  if (!dlg.open) dlg.showModal();
}

// ---------- الفريق ----------
function viewTeam(r) {
  if (!r.id) {
    if (!isLeader()) { location.hash = `#/team/${S.me.id}`; return ''; }
    return header(L.monthLabel(S.month), 'الفريق') + `<div class="grid-cards">${S.team.stats.map((x) => `<a class="card" href="#/team/${esc(x.member.id)}" style="display:flex;flex-direction:column;gap:14px;text-decoration:none;color:var(--cream)">
      <div class="row">${av(x.member)}<div class="grow"><div style="font-weight:600">${esc(x.member.full_name)}</div><div class="muted" style="font-size:12px">${esc(x.member.role_title || '')}</div></div></div>
      <div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="num" style="font-size:48px">${x.score}</div><span class="chip" style="margin-top:8px">${L.grade(x.score)}</span></div><div style="text-align:left"><div class="num" style="font-size:28px;color:var(--sand)">${fmt(x.points)}</div><div class="muted" style="font-size:12px">نقطة</div></div></div>
      <div class="muted" style="font-size:13px">${x.doneCount} من ${x.total} مهام · ${x.overdue.length ? `<span class="warn">متأخر: ${L.nTasks(x.overdue.length)}</span>` : 'بدون تأخير'}</div></a>`).join('')}</div>`;
  }
  if (!isLeader() && r.id !== S.me.id) { location.hash = `#/team/${S.me.id}`; return ''; }
  const m = profile(r.id);
  if (!m) return '<div class="empty">الموظف غير موجود.</div>';
  const x = S.team.stats.find((s) => s.member.id === m.id) || L.memberStats(m, S.data, S.settings);
  const read = L.memberRead(x);
  const maxW = Math.max(1, ...x.weeks);
  const s = S.settings;
  const log = [
    ...x.done.map((t) => { const b = L.taskPoints(t, s); const extra = [b.early ? `+${b.early} مبكر` : '', b.late ? `${b.late} تأخير` : '', b.quality ? `+${b.quality} جودة` : ''].filter(Boolean).join(' · '); return { date: t.done_at || t.submitted_at || '', text: t.title + (extra ? ` (${extra})` : ''), pts: b.total, id: null }; }),
    ...x.adj.map((a) => ({ date: (a.created_at || '').slice(0, 10), text: a.reason, pts: a.points, id: a.id }))
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section class="card" style="display:flex;flex-wrap:wrap;gap:26px;align-items:center;padding:28px">
    ${av(m, 'xl')}
    <div style="flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:8px">
      <p class="eyebrow">ملف الأداء · ${L.monthLabel(S.month)}</p>
      <h1 class="h1" style="margin:0">${esc(m.full_name)}</h1>
      <div class="actions"><span class="chip">${esc(m.role_title || '')}</span><span class="chip blue">${L.grade(x.score)}</span></div>
    </div>
    <div class="row" style="gap:30px;flex-wrap:wrap">
      <div style="text-align:center"><div class="num" style="font-size:76px;color:var(--sand)">${fmt(x.points)}</div><div class="muted" style="font-size:13px;margin-top:4px">نقطة هذا الشهر</div></div>
      ${isLeader() || S.settings.showLeaderboard ? `<div style="text-align:center"><div class="num" style="font-size:76px">#${x.rank || '—'}</div><div class="muted" style="font-size:13px;margin-top:4px">الترتيب في الفريق</div></div>` : ''}
    </div>
  </section>
  <section class="kpis" aria-label="المؤشرات">
    ${kpi('المهام المكتملة', `${x.doneCount}/${x.total}`, '', x.parts.completion, `${x.parts.completion}%`)}
    ${kpi('الالتزام بالمواعيد', x.parts.ontime, '%', x.parts.ontime, x.overdue.length ? `متأخر: ${L.nTasks(x.overdue.length)}` : 'بدون تأخير')}
    ${kpi('متوسط الجودة', x.qualityAvg ? x.qualityAvg.toFixed(1) : '—', 'من 5', x.parts.quality, 'تقييم القائد')}
    ${kpi('مؤشر الأداء', x.score, 'من 100', x.score, 'حسب معادلة التقييم')}
  </section>
  <div class="split">
    <section class="card"><h2 class="card-t" style="margin-bottom:16px">النقاط أسبوعياً</h2>
      <div class="chart" style="grid-template-columns:repeat(${x.weeks.length},minmax(0,1fr))">${x.weeks.map((w, i) => `<div class="chart-col"><span class="num" style="font-size:18px">${w}</span><div class="chart-bar" style="height:${Math.round(w / maxW * 85)}%;background:${i === x.weeks.length - 1 ? esc(m.color) : 'rgba(216,196,166,.3)'}"></div></div>`).join('')}</div>
      <div class="chart-x" style="grid-template-columns:repeat(${x.weeks.length},minmax(0,1fr))">${x.weeks.map((_, i) => `<span>أسبوع ${i + 1}</span>`).join('')}</div>
    </section>
    <section class="card ai"><h2 class="card-t" style="margin-bottom:12px">${icon('ai')}قراءة المحلل</h2>
      <p style="margin:0 0 16px;font-family:var(--display);font-size:21px;line-height:1.8">${esc(read.summary)}</p>
      <div class="grid-cards" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div style="padding:14px;border-radius:14px;background:var(--ink)"><div style="font-size:12px;color:var(--sand);margin-bottom:6px">نقطة القوة</div><div style="font-size:14px">${esc(read.strength)}</div></div>
        <div style="padding:14px;border-radius:14px;background:var(--ink)"><div class="warn" style="font-size:12px;margin-bottom:6px">فرصة التطوير</div><div style="font-size:14px">${esc(read.grow)}</div></div>
      </div></section>
  </div>
  <section class="card">
    <div class="card-h"><h2 class="card-t">سجل النقاط</h2></div>
    ${isLeader() ? `<form data-form="adjust" data-id="${esc(m.id)}" class="row no-print" style="flex-wrap:wrap;margin-bottom:12px">
      <label class="field" style="width:110px"><span class="sr">النقاط</span><input class="input" type="number" name="points" required placeholder="+10 أو -5"></label>
      <label class="field grow" style="min-width:200px"><span class="sr">السبب</span><input class="input" name="reason" required placeholder="السبب: مبادرة، شارة، ملاحظة…"></label>
      <button class="btn" type="submit">إضافة نقاط</button></form>` : ''}
    ${log.length ? log.map((l) => `<div class="list-row"><span class="muted" style="font-size:12px;min-width:84px">${esc(l.date)}</span><span class="grow" style="font-size:14px">${esc(l.text)}</span><span class="num" style="font-size:22px;color:${l.pts < 0 ? 'var(--warn)' : 'var(--sand)'}">${l.pts > 0 ? '+' : ''}${l.pts}</span>${l.id && isLeader() ? `<button class="btn icon-btn ghost no-print" type="button" data-act="del-adj" data-id="${esc(l.id)}" aria-label="حذف">${icon('x')}</button>` : ''}</div>`).join('') : '<div class="empty">ما فيه نقاط بعد هالشهر.</div>'}
  </section>`;
}

// ---------- التقييمات ----------
function evalCard(x, editable) {
  const ev = x.evaluation || {};
  const labels = { completion: 'الإنجاز', ontime: 'المواعيد', quality: 'الجودة', initiative: 'المبادرة' };
  const note = ev.note || L.draftNote(x);
  const score = ev.approved && ev.score != null ? ev.score : x.score;
  return `<article class="card" style="display:flex;flex-direction:column;gap:16px;${ev.approved ? 'border-color:rgba(216,196,166,.4)' : ''}">
    <div class="row" style="flex-wrap:wrap;gap:14px">${av(x.member)}<div class="grow" style="min-width:140px"><h2 style="margin:0;font-size:18px">${esc(x.member.full_name)}</h2><div class="muted" style="font-size:13px">${esc(x.member.role_title || '')} · ${fmt(x.points)} نقطة · ${x.doneCount}/${x.total} مهام</div></div>
      <div style="text-align:center"><div class="num" style="font-size:52px">${score}</div><span class="chip" style="margin-top:6px">${esc(ev.approved ? ev.grade : L.grade(score))}</span></div></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px">${Object.entries(x.parts).map(([k, v]) => `<div style="display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between;font-size:12px"><span class="muted">${labels[k]} (${S.settings.weights[k]}%)</span><span>${v}</span></div><div class="bar"><i style="width:${v}%"></i></div></div>`).join('')}</div>
    ${editable ? `<form data-form="eval" data-id="${esc(x.member.id)}" style="display:flex;flex-direction:column;gap:12px">
      <label class="field">درجة المبادرة (0–100)<input class="input" type="number" min="0" max="100" name="initiative" value="${ev.initiative != null ? ev.initiative : 50}" style="width:120px"></label>
      <label class="field"><span class="blue" style="display:flex;gap:6px;align-items:center">${icon('ai')}ملاحظة التقييم (مسودة من المحلل، عدّلها)</span><textarea class="textarea" name="note" rows="3" style="min-height:90px">${esc(note)}</textarea></label>
      <div class="actions no-print" style="justify-content:space-between"><button class="btn sm" type="submit" name="mode" value="save">حفظ</button>
        ${ev.approved ? `<span class="row" style="gap:8px;color:var(--sand);font-size:13px">${icon('check')}معتمد · يقدر يشوفه الموظف</span><button class="btn sm ghost" type="submit" name="mode" value="unapprove">إلغاء الاعتماد</button>` : `<button class="btn sm pri" type="submit" name="mode" value="approve">اعتماد ونشر للموظف</button>`}</div>
    </form>` : `<p style="margin:0;line-height:1.9;font-size:15px">${esc(ev.note || '')}</p>`}
  </article>`;
}

function viewReviews() {
  const w = S.settings.weights;
  if (!isLeader()) {
    const x = S.team.stats.find((s) => s.member.id === S.me.id);
    const ok = x && x.evaluation && x.evaluation.approved;
    return header(L.monthLabel(S.month), 'تقييمي', ok ? `<button class="btn" type="button" data-act="print">${icon('print')}طباعة / PDF</button>` : '') + (ok ? evalCard(x, false) : '<div class="card empty">تقييم هالشهر ما صدر بعد. يصدر بعد اعتماد القائد.</div>');
  }
  const approved = S.team.stats.filter((x) => x.evaluation && x.evaluation.approved).length;
  return header(`${L.monthLabel(S.month)} · ${approved} من ${S.team.stats.length} معتمدة`, 'إصدار التقييمات', `<button class="btn" type="button" data-act="print">${icon('print')}طباعة / PDF</button><button class="btn pri" type="button" data-act="approve-all">اعتماد الكل</button>`) + `
  <section class="card" style="padding:18px 22px"><div class="card-h" style="margin-bottom:12px"><h2 class="card-t" style="font-size:16px">معادلة التقييم</h2><a href="#/settings" class="no-print" style="font-size:13px">تعديل الأوزان</a></div>
    <div class="rules">${[['completion', 'الإنجاز', 'المكتمل من المسند'], ['ontime', 'المواعيد', 'التسليم بالموعد أو قبله'], ['quality', 'الجودة', 'تقييم القائد من 5'], ['initiative', 'المبادرة', 'يحددها القائد']].map(([k, l, d]) => `<div class="rule row" style="gap:12px"><span class="num" style="font-size:30px;color:var(--sand);margin:0">${w[k]}%</span><span><b style="font-weight:500;display:block">${l}</b><span style="margin:0">${d}</span></span></div>`).join('')}</div></section>
  <div class="split" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,500px),1fr))">${S.team.stats.map((x) => evalCard(x, true)).join('')}</div>`;
}

// ---------- المحلل ----------
function viewAnalyst() {
  const T = S.team, fc = T.forecast;
  const avgScore = T.stats.length ? Math.round(T.stats.reduce((a, x) => a + x.score, 0) / T.stats.length) : 0;
  const pats = L.patterns(S.data.history, S.data.profiles);
  const behind = T.completion < fc.expected - 5;
  const heavy = T.stats.filter((x) => x.dueSoon.length >= 3).map((x) => x.member.full_name);
  let summary = T.total ? `الفريق أنجز ${T.completion}% من خطة ${L.monthLabel(S.month)}` : 'ما فيه مهام لهالشهر بعد. ارفع الخطة عشان يبدأ التحليل.';
  if (T.total) {
    summary += fc.remaining > 0 && fc.elapsed > 0 ? ` وباقي ${L.nDays(fc.remaining)}. ` : '. ';
    summary += behind ? `الإيقاع أبطأ من المتوقع (${fc.expected}% لهذا الوقت). ` : 'الإيقاع على المسار أو أسرع. ';
    const excused = T.overdue.filter((t) => t.late_reason && t.late_reason !== 'self').length;
    if (T.overdue.length) summary += `المتأخر: ${L.nTasks(T.overdue.length)}${excused ? `، منها ${excused} لسبب خارجي` : ''}. `;
    if (heavy.length) summary += `الضغط يتجمع على ${heavy.join(' و')} الأسبوع الجاي.`;
  }
  const bars = [['المتوقع الآن', fc.expected, 'rgba(216,196,166,.3)'], ['الفعلي', T.completion, 'var(--sand)'], ['توقع نهاية الشهر', fc.pct, 'var(--blue)']];
  return header(`محسوب من بياناتكم مباشرة · ${T.total} مهمة · ${T.stats.length} أعضاء`, 'قراءة المحلل الذكي', `<button class="btn" type="button" data-act="print">${icon('print')}تصدير التقرير</button><button class="btn ai" type="button" data-act="reanalyze">${icon('ai')}حلّل الآن</button>`) + `
  <section class="card ai" style="padding:28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:28px;align-items:center">
    <div style="display:flex;flex-direction:column;gap:12px"><span class="chip blue" style="align-self:flex-start">الملخص التنفيذي</span><p style="margin:0;font-family:var(--display);font-size:24px;line-height:1.75">${esc(summary)}</p></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
      ${[['توقع نهاية الشهر', fc.pct + '%', 'var(--blue)'], ['صحة الفريق', avgScore, 'var(--cream)'], ['تنبيهات مفتوحة', S.ins.length, 'var(--warn)']].map(([l, v, c]) => `<div style="padding:16px;border-radius:16px;background:var(--ink);border:1px solid var(--line)"><div class="muted" style="font-size:12px">${l}</div><div class="num" style="font-size:44px;margin-top:10px;color:${c}">${v}</div></div>`).join('')}
    </div>
  </section>
  <section style="display:flex;flex-direction:column;gap:12px"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="card-t" style="font-size:19px">مؤشر الأداء لكل عضو</h2><span class="muted" style="font-size:13px">الإنجاز · المواعيد · الجودة · المبادرة</span></div>
    <div class="grid-cards">${T.stats.map((x) => { const mw = Math.max(1, ...x.weeks); const rd = L.memberRead(x); return `<a class="card" href="#/team/${esc(x.member.id)}" style="display:flex;flex-direction:column;gap:14px;text-decoration:none;color:var(--cream);padding:18px">
      <div class="row">${av(x.member)}<div class="grow"><div style="font-weight:600">${esc(x.member.full_name)}</div><div class="muted" style="font-size:12px">${esc(x.member.role_title || '')}</div></div></div>
      <div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="num" style="font-size:48px">${x.score}</div><span class="chip ${x.score < 70 ? 'warn' : ''}" style="margin-top:8px">${L.grade(x.score)}</span></div>
        <div class="row" style="gap:4px;align-items:flex-end;height:52px" aria-hidden="true">${x.weeks.map((w, i) => `<span style="width:9px;border-radius:3px;height:${Math.max(4, Math.round(w / mw * 100))}%;background:${i === x.weeks.length - 1 ? esc(x.member.color) : 'rgba(216,196,166,.25)'}"></span>`).join('')}</div></div>
      <p style="margin:0;font-size:13px;line-height:1.8;padding-top:12px;border-top:1px solid var(--line)"><span class="blue">المحلل: </span>${esc(rd.summary)}</p></a>`; }).join('')}</div>
  </section>
  <div class="split">
    <section class="card"><h2 class="card-t" style="margin-bottom:16px">الإنجاز مقابل الخطة</h2>
      <div class="chart" style="grid-template-columns:repeat(3,minmax(0,1fr));height:220px">${bars.map(([, v, c]) => `<div class="chart-col"><span class="num" style="font-size:22px">${v}%</span><div class="chart-bar" style="height:${Math.max(2, v * 0.85)}%;background:${c}"></div></div>`).join('')}</div>
      <div class="chart-x" style="grid-template-columns:repeat(3,minmax(0,1fr))">${bars.map(([l]) => `<span>${l}</span>`).join('')}</div>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:10px"><div class="card-h" style="margin:0"><h2 class="card-t">التنبيهات والمقترحات</h2><span class="muted" style="font-size:12px">مرتبة حسب الأهمية</span></div>
      ${S.ins.length ? S.ins.map((n, i) => insightCard(n, i)).join('') : '<div class="empty">ما فيه تنبيهات.</div>'}</section>
  </div>
  <div class="split">
    <section class="card"><div class="card-h"><h2 class="card-t">أنماط من آخر 6 أشهر</h2></div>
      ${pats.length ? pats.map((p) => `<div class="list-row" style="align-items:flex-start"><span class="num blue" style="font-size:30px;min-width:70px">${esc(p.stat)}</span><div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:14px;line-height:1.75">${esc(p.text)}</span><span class="muted" style="font-size:13px">← ${esc(p.rec)}</span></div></div>`).join('') : '<div class="empty">تظهر الأنماط بعد ما يتجمع 6 تسليمات أو أكثر.</div>'}</section>
    <section class="card ai"><h2 class="card-t" style="margin-bottom:12px">${icon('ai')}عن المحلل</h2>
      <p style="margin:0;line-height:1.9;font-size:14px">التحليل الحالي محسوب من بيانات المهام والنقاط مباشرة، ومجاني بالكامل. يتحدث كل ما فتحت الصفحة أو ضغطت «حلّل الآن».</p>
      <p class="muted" style="margin:12px 0 0;line-height:1.9;font-size:13px">المرحلة الجاية: ربط OpenAI أو Gemini لقراءة ملفات PDF مباشرة والمحادثة مع المحلل، مع تنبيهات تلقائية على الإيميل والواتساب.</p></section>
  </div>`;
}

// ---------- الإعدادات ----------
function viewSettings() {
  const s = S.settings;
  const allowed = S.data.allowed || [];
  const row = (a, isNew) => `<form data-form="member" class="card" style="display:flex;flex-direction:column;gap:12px;padding:16px">
    <div class="form-grid">
      <label class="field">الإيميل<input class="input" name="email" type="email" dir="ltr" required value="${esc(a.email || '')}"${isNew ? '' : ' readonly'}></label>
      <label class="field">الاسم<input class="input" name="full_name" required value="${esc(a.full_name || '')}"></label>
      <label class="field">المسمى<input class="input" name="role_title" value="${esc(a.role_title || '')}"></label>
      <label class="field">اللون<input class="input" name="color" type="color" value="${esc(a.color || '#d8c4a6')}" style="padding:4px"></label>
    </div>
    <label class="field">كلمات التخصص (يستخدمها المحلل في التوزيع، افصل بفاصلة)<input class="input" name="skills" value="${esc((a.skills || []).join('، '))}"></label>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap">
      <label class="check"><input type="checkbox" name="is_leader"${a.is_leader ? ' checked' : ''}>صلاحيات قائد (يرفع الخطة ويعتمد)</label>
      <span class="actions"><button class="btn sm pri" type="submit">${isNew ? 'إضافة للفريق' : 'حفظ'}</button>${isNew ? '' : `<button class="btn sm danger" type="button" data-act="del-member" data-email="${esc(a.email)}">إزالة</button>`}</span>
    </div></form>`;
  return header('للقائد فقط', 'الإعدادات') + `
  <section class="card"><div class="card-h"><h2 class="card-t">أعضاء الفريق</h2><span class="muted" style="font-size:12px">كل عضو يدخل بإيميله المضاف هنا</span></div>
    <div style="display:flex;flex-direction:column;gap:12px">${allowed.map((a) => row(a, false)).join('')}
    <h3 style="margin:10px 0 0;font-size:15px">إضافة عضو</h3>${row({}, true)}</div></section>
  <section class="card"><div class="card-h"><h2 class="card-t">قواعد النقاط والتقييم</h2></div>
    <form data-form="settings" style="display:flex;flex-direction:column;gap:16px">
      <div class="form-grid">
        <label class="field">مكافأة التسليم المبكر (%)<input class="input" type="number" min="0" max="100" name="earlyBonus" value="${s.earlyBonus}"></label>
        <label class="field">خصم التأخير لكل يوم (%)<input class="input" type="number" min="0" max="100" name="latePenalty" value="${s.latePenalty}"></label>
        <label class="field">مكافأة جودة 5/5 (نقاط)<input class="input" type="number" min="0" name="qualityBonus" value="${s.qualityBonus}"></label>
      </div>
      <div class="form-grid">
        <label class="field">وزن الإنجاز<input class="input" type="number" min="0" max="100" name="w_completion" value="${s.weights.completion}"></label>
        <label class="field">وزن المواعيد<input class="input" type="number" min="0" max="100" name="w_ontime" value="${s.weights.ontime}"></label>
        <label class="field">وزن الجودة<input class="input" type="number" min="0" max="100" name="w_quality" value="${s.weights.quality}"></label>
        <label class="field">وزن المبادرة<input class="input" type="number" min="0" max="100" name="w_initiative" value="${s.weights.initiative}"></label>
      </div>
      <label class="check"><input type="checkbox" name="showLeaderboard"${s.showLeaderboard ? ' checked' : ''}>الموظفين يشوفون ترتيب الفريق ونقاط بعض</label>
      <div class="actions"><button class="btn pri" type="submit">حفظ القواعد</button></div>
    </form></section>
  ${isDemo ? '<section class="card"><div class="card-h"><h2 class="card-t">الوضع التجريبي</h2></div><button class="btn danger" type="button" data-act="reset-demo">إعادة البيانات التجريبية من البداية</button></section>' : ''}`;
}

// ---------- الأحداث ----------
const ACT = {
  async 'demo-login'(el) { await api.demoLogin(el.dataset.id); location.hash = '#/'; await start(); },
  async logout() { await api.signOut(); S.me = null; S.data = null; S.filter = null; S.draft = null; renderLogin(); },
  'auth-mode'() { S.authMode = S.authMode === 'up' ? 'in' : 'up'; renderLogin(); },
  async forgot() {
    const email = root.querySelector('input[name=email]').value.trim();
    if (!email) { toast('اكتب إيميلك أول', true); return; }
    try { await api.resetPassword(email); toast('أرسلنا رابط تغيير كلمة المرور لإيميلك'); } catch (e) { toast(e.message, true); }
  },
  async insight(el) {
    const n = S.ins[Number(el.dataset.i)]; if (!n || !n.action) return;
    const a = n.action;
    if (a.type === 'goto') { location.hash = a.href; return; }
    if (a.type === 'reassign') await run(() => api.updateTask(a.taskId, { assignee_id: a.to }), 'تم نقل المهمة');
    if (a.type === 'bonus') await run(() => api.addAdjustment({ member_id: a.member, month: S.month, points: a.points, reason: a.reason, created_by: S.me.id }), `أُضيفت ${a.points} نقطة`);
  },
  'open-task'(el) { openTask(el.dataset.id); },
  'new-task'() { openTask(null); },
  close() { dlg.close(); },
  q(el) { S.dlgQuality = Number(el.dataset.v); dlg.querySelectorAll('.star').forEach((b) => { const on = Number(b.dataset.v) === S.dlgQuality; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
  async 'approve-task'() {
    const t = S.dlgTask; if (!S.dlgQuality) { toast('اختر تقييم الجودة أول', true); return; }
    dlg.close();
    await run(async () => { await api.setStatus(t.id, 'done'); await api.updateTask(t.id, { quality: S.dlgQuality }); }, 'تم الاعتماد واحتساب النقاط');
  },
  async 'del-task'() { if (!confirm('حذف المهمة نهائياً؟')) return; const id = S.dlgTask.id; dlg.close(); await run(() => api.deleteTask(id), 'تم الحذف'); },
  filter(el) { S.filter = el.dataset.id; render(true); },
  async 'del-goal'(el) { if (!confirm('حذف الهدف؟ المهام تبقى بدون هدف.')) return; await run(() => api.deleteGoal(el.dataset.id), 'تم حذف الهدف'); },
  'draft-cancel'() { S.draft = null; render(); },
  async 'draft-approve'() {
    const d = S.draft; const rows = d.tasks.filter((t) => t.include && t.title.trim());
    if (!rows.length) { toast('ما فيه مهام محددة', true); return; }
    const ok = await run(async () => {
      const goalIds = {};
      S.data.goals.forEach((g) => { goalIds[g.title] = g.id; });
      for (const t of rows) {
        if (t.goal && !goalIds[t.goal]) { const g = await api.addGoal({ month: S.month, title: t.goal, owner_id: t.assignee_id || null }); goalIds[t.goal] = g.id; }
      }
      await api.addTasks(rows.map((t) => ({ month: S.month, title: t.title.trim(), client: t.client || '', assignee_id: t.assignee_id || null, size: t.size, points: Number(t.points) || 0, due_date: t.due_date || null, goal_id: t.goal ? goalIds[t.goal] : null, created_by: S.me.id })));
    }, `تم إرسال ${rows.length} مهمة للفريق`);
    if (ok) { S.draft = null; location.hash = '#/tasks'; }
  },
  async 'del-adj'(el) { if (!confirm('حذف هذه النقاط؟')) return; await run(() => api.deleteAdjustment(el.dataset.id), 'تم الحذف'); },
  print() { window.print(); },
  async reanalyze() { await refresh(); toast('تم تحديث التحليل'); },
  async 'approve-all'() {
    if (!confirm('اعتماد تقييمات كل الفريق ونشرها لهم؟')) return;
    await run(async () => {
      for (const x of S.team.stats) {
        const ev = x.evaluation || {};
        await api.saveEvaluation({ member_id: x.member.id, month: S.month, initiative: ev.initiative != null ? ev.initiative : 50, score: x.score, grade: L.grade(x.score), note: ev.note || L.draftNote(x), approved: true, approved_at: new Date().toISOString() });
      }
    }, 'تم اعتماد كل التقييمات');
  },
  async 'del-member'(el) { if (!confirm('إزالة العضو من الفريق؟ يفقد صلاحية الدخول وتبقى بياناته.')) return; await run(async () => { await api.deleteAllowed(el.dataset.email); const p = S.data.profiles.find((x) => x.email === el.dataset.email); if (p && !isDemo) await api.updateProfile(p.id, { active: false }); }, 'تمت الإزالة'); },
  async 'reset-demo'() { if (!confirm('ترجع البيانات التجريبية من البداية؟')) return; api.resetDemo(); await refresh(); toast('تمت الإعادة'); }
};

const FORMS = {
  async auth(f) {
    const email = f.email.value.trim(), password = f.password.value;
    try {
      if (S.authMode === 'up') { const r = await api.signUp(email, password); if (r.needsConfirm) { toast('أرسلنا رابط تأكيد لإيميلك، افتحه وبعدها سجّل دخول'); S.authMode = 'in'; renderLogin(); return; } }
      else await api.signIn(email, password);
      await start();
    } catch (e) { toast(e.message === 'Invalid login credentials' ? 'الإيميل أو كلمة المرور غلط' : e.message, true); }
  },
  async newpass(f) { try { await api.updatePassword(f.password.value); S.recovery = false; toast('تم تغيير كلمة المرور'); await start(); } catch (e) { toast(e.message, true); } },
  parse(f) {
    const text = f.text.value;
    if (!text.trim()) { toast('الصق نص الخطة أول', true); return; }
    const r = L.parsePlan(text, activeMembers(), S.month, S.data);
    if (!r.tasks.length) { toast('ما لقيت مهام في النص', true); return; }
    S.draft = { text, goals: r.goals, tasks: r.tasks };
    render();
    toast(`لقيت ${r.tasks.length} مهمة و${r.goals.length} أهداف`);
  },
  async goal(f) { const title = f.title.value.trim(); if (!title) return; await run(() => api.addGoal({ month: S.month, title, owner_id: f.owner.value || null }), 'أُضيف الهدف'); },
  async task(f) {
    const t = S.dlgTask;
    const patch = {
      title: f.title.value.trim(), client: f.client.value.trim(), assignee_id: f.assignee_id.value || null, goal_id: f.goal_id.value || null,
      size: f.size.value, points: Number(f.points.value) || 0, due_date: f.due_date.value || null, description: f.description.value.trim(),
      late_reason: f.late_reason.value || null
    };
    if (S.dlgQuality) patch.quality = S.dlgQuality;
    const status = f.status.value;
    dlg.close();
    if (!t.id) { await run(() => api.addTasks([{ ...patch, month: S.month, status, created_by: S.me.id }]), 'أُضيفت المهمة'); return; }
    await run(async () => { await api.updateTask(t.id, patch); if (status !== t.status) await api.setStatus(t.id, status, patch.late_reason); }, 'تم الحفظ');
  },
  async mystatus(f, ev) {
    const to = ev.submitter ? ev.submitter.value : 'review';
    const reason = f.reason ? f.reason.value || null : null;
    dlg.close();
    await run(() => api.setStatus(S.dlgTask.id, to, reason), to === 'review' ? 'تم التسليم للمراجعة' : 'تم التحديث');
  },
  async adjust(f) { await run(() => api.addAdjustment({ member_id: f.dataset.id, month: S.month, points: Number(f.points.value), reason: f.reason.value.trim(), created_by: S.me.id }), 'أُضيفت النقاط'); },
  async eval(f, ev) {
    const mode = ev.submitter ? ev.submitter.value : 'save';
    const x = S.team.stats.find((s) => s.member.id === f.dataset.id);
    const initiative = Math.max(0, Math.min(100, Number(f.initiative.value) || 0));
    const tmp = L.memberStats(x.member, { ...S.data, evaluations: [{ member_id: x.member.id, initiative }] }, S.settings);
    const row = { member_id: x.member.id, month: S.month, initiative, note: f.note.value.trim(), score: tmp.score, grade: L.grade(tmp.score) };
    if (mode === 'approve') { row.approved = true; row.approved_at = new Date().toISOString(); }
    if (mode === 'unapprove') { row.approved = false; row.approved_at = null; }
    await run(() => api.saveEvaluation(row), mode === 'approve' ? 'تم الاعتماد والنشر' : 'تم الحفظ');
  },
  async member(f) {
    const row = {
      email: f.email.value.trim().toLowerCase(), full_name: f.full_name.value.trim(), role_title: f.role_title.value.trim(), color: f.color.value,
      skills: f.skills.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean), is_leader: f.is_leader.checked
    };
    await run(async () => {
      await api.saveAllowed(row);
      const p = S.data.profiles.find((x) => x.email === row.email);
      if (p && !isDemo) await api.updateProfile(p.id, { full_name: row.full_name, role_title: row.role_title, color: row.color, skills: row.skills, is_leader: row.is_leader, active: true });
    }, 'تم الحفظ');
  },
  async settings(f) {
    const n = (k) => Math.max(0, Number(f[k].value) || 0);
    const data = { earlyBonus: n('earlyBonus'), latePenalty: n('latePenalty'), qualityBonus: n('qualityBonus'), showLeaderboard: f.showLeaderboard.checked,
      weights: { completion: n('w_completion'), ontime: n('w_ontime'), quality: n('w_quality'), initiative: n('w_initiative') } };
    await run(() => api.saveSettings(data), 'تم حفظ القواعد');
  }
};

function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
}
function onSubmit(e) {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form];
  if (fn) fn(f, e);
}
async function onChange(e) {
  const el = e.target;
  const k = el.dataset.change;
  if (!k) return;
  if (k === 'month') { S.month = el.value; S.draft = null; await refresh(); }
  if (k === 'size') { const pts = el.form.points; pts.value = L.SIZE_POINTS[el.value]; }
  if (k === 'draft') {
    const t = S.draft.tasks[Number(el.dataset.i)];
    const key = el.dataset.k;
    t[key] = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'size') t.points = L.SIZE_POINTS[el.value];
    if (key === 'assignee_id') t.reason = 'تعديل يدوي';
    if (['include', 'size', 'assignee_id', 'points'].includes(key)) render(true);
  }
}

[root, dlg].forEach((n) => { n.addEventListener('click', onClick); n.addEventListener('submit', onSubmit); n.addEventListener('change', onChange); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

boot();
