// طبقة البيانات: Supabase إذا انضبطت الإعدادات، وإلا وضع تجريبي محفوظ في المتصفح
import { CONFIG } from './config.js?v=1792499954';
import { todayStr, addDays, monthOf, shiftMonth, SIZE_POINTS } from './logic.js?v=1792499954';

export const isDemo = !(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
let sb = null;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// ================= Supabase =================
const remote = {
  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  },
  onAuth(cb) { sb.auth.onAuthStateChange((event) => cb(event)); },
  async me() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.rpc('claim_access');
    if (error || !data || !data.id) return { denied: true, email: session.user.email };
    return data;
  },
  async signIn(email, password) { check(await sb.auth.signInWithPassword({ email, password })); },
  async signUp(email, password) {
    const data = check(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
    return { needsConfirm: !data.session };
  },
  async resetPassword(email) { check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
  async updatePassword(password) { check(await sb.auth.updateUser({ password })); },
  async signOut() { await sb.auth.signOut(); },
  async load(month, me) {
    const [profiles, tasks, goals, adjustments, evaluations, settings, history, departments] = await Promise.all([
      sb.from('profiles').select('*').order('created_at'),
      sb.from('tasks').select('*').eq('month', month).order('due_date', { nullsFirst: false }),
      sb.from('goals').select('*').eq('month', month).order('created_at'),
      sb.from('adjustments').select('*').eq('month', month).order('created_at', { ascending: false }),
      sb.from('evaluations').select('*').eq('month', month),
      sb.from('settings').select('data').eq('id', 1).maybeSingle(),
      sb.from('tasks').select('id,month,client,assignee_id,status,due_date,submitted_at,done_at,late_reason').gte('month', shiftMonth(month, -5)).lte('month', month),
      sb.from('departments').select('*').order('sort')
    ]);
    let allowed = [];
    if (me.role === 'admin') allowed = check(await sb.from('allowed_members').select('*').order('full_name'));
    return {
      month,
      profiles: check(profiles), tasks: check(tasks), goals: check(goals), adjustments: check(adjustments),
      evaluations: check(evaluations), settings: (check(settings) || {}).data || {}, history: check(history), allowed,
      departments: check(departments)
    };
  },
  async addTasks(rows) { return check(await sb.from('tasks').insert(rows).select()); },
  async updateTask(id, patch) { check(await sb.from('tasks').update(patch).eq('id', id)); },
  async deleteTask(id) { check(await sb.from('tasks').delete().eq('id', id)); },
  async setStatus(id, status, reason) { check(await sb.rpc('set_task_status', { p_task: id, p_status: status, p_reason: reason || null })); },
  async addGoal(row) { return check(await sb.from('goals').insert(row).select().single()); },
  async deleteGoal(id) { check(await sb.from('goals').delete().eq('id', id)); },
  async addAdjustment(row) { check(await sb.from('adjustments').insert(row)); },
  async deleteAdjustment(id) { check(await sb.from('adjustments').delete().eq('id', id)); },
  async saveEvaluation(row) { check(await sb.from('evaluations').upsert(row, { onConflict: 'member_id,month' })); },
  async saveSettings(data) { check(await sb.from('settings').update({ data }).eq('id', 1)); },
  async updateProfile(id, patch) { check(await sb.from('profiles').update(patch).eq('id', id)); },
  async saveAllowed(row) { check(await sb.from('allowed_members').upsert(row)); },
  async deleteAllowed(email) { check(await sb.from('allowed_members').delete().eq('email', email)); },
  async saveDepartment(row) { if (row.id) check(await sb.from('departments').update({ name: row.name, color: row.color }).eq('id', row.id)); else check(await sb.from('departments').insert({ name: row.name, color: row.color, sort: row.sort || 99 })); },
  async deleteDepartment(id) { check(await sb.from('departments').delete().eq('id', id)); }
};

// ================= الوضع التجريبي =================
const KEY = 'seet-team-demo-v2';
const ME_KEY = 'seet-team-demo-me';
let db = null;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* التخزين غير متاح */ } };

function seed() {
  const today = todayStr();
  const month = monthOf(today);
  const prev = shiftMonth(month, -1);
  const departments = [
    { id: 'd-ds', name: 'التصميم', color: '#d8c4a6', sort: 1 },
    { id: 'd-mk', name: 'التسويق والكيترينق', color: '#a9c7e8', sort: 2 },
    { id: 'd-it', name: 'تقنية المعلومات', color: '#b9cfc4', sort: 3 }
  ];
  const P = [
    { id: 'm-am', email: 'abdulmalek@demo', full_name: 'عبدالملك', role_title: 'تقنية المعلومات', color: '#b9cfc4', role: 'admin', department_id: 'd-it', skills: ['موقع', 'نظام', 'تقنية', 'برمجة', 'ربط', 'أتمتة'] },
    { id: 'm-rb', email: 'rahaf.b@demo', full_name: 'رهف باوزير', role_title: 'قائدة الفريق · التصميم', color: '#d8c4a6', role: 'leader', department_id: 'd-ds', skills: ['تصميم', 'هوية', 'شعار', 'بوست', 'سوشال', 'بنر', 'مطبوعات'] },
    { id: 'm-rs', email: 'rahaf.s@demo', full_name: 'رهف الشهري', role_title: 'مسؤولة التسويق والكيترينق', color: '#efe7dc', role: 'head', department_id: 'd-mk', skills: ['تسويق', 'كيترينق', 'فعالية', 'موردين', 'عرض سعر', 'خطة محتوى'] },
    { id: 'm-mr', email: 'maram@demo', full_name: 'مرام', role_title: 'ميديا باير · تسويق', color: '#a9c7e8', role: 'member', department_id: 'd-mk', skills: ['إعلان', 'حملة', 'ميديا', 'سناب', 'تيك توك', 'ميتا', 'تقرير أداء'] },
    { id: 'm-zh', email: 'zahra@demo', full_name: 'زهرا', role_title: 'تصوير · تسويق', color: '#c9a27e', role: 'member', department_id: 'd-mk', skills: ['تصوير', 'فيديو', 'ريلز', 'مونتاج', 'جلسة'] }
  ].map((p) => ({ ...p, active: true }));
  const goals = [
    { id: 'g1', month, title: 'هويات وتصاميم العملاء', owner_id: 'm-rb' },
    { id: 'g2', month, title: 'الحملات الإعلانية المدفوعة', owner_id: 'm-mr' },
    { id: 'g3', month, title: 'المحتوى والتصوير', owner_id: 'm-zh' },
    { id: 'g4', month, title: 'الكيترينق والفعاليات', owner_id: 'm-rs' },
    { id: 'g5', month, title: 'الأنظمة والمواقع', owner_id: 'm-am' }
  ];
  const d = (n) => addDays(today, n);
  // [عنوان, عميل, مسؤول, هدف, حجم, موعد, حالة, تسليم, جودة, سبب تأخير]
  const rows = [
    ['هوية حملة الخريف', 'وِكاد', 'm-rb', 'g1', 'L', -12, 'done', -13, 5],
    ['تصاميم سوشال الأسبوع 2', 'أونا', 'm-rb', 'g1', 'M', -8, 'done', -8, 4],
    ['تصاميم حملة اليوم العالمي للقهوة', 'وِكاد', 'm-rb', 'g1', 'L', 1, 'doing'],
    ['تصاميم سوشال الأسبوع 4', 'أونا', 'm-rb', 'g1', 'M', 6, 'new'],
    ['بروفايل الشركة المطبوع', 'صيت', 'm-rb', 'g1', 'M', 9, 'new'],
    ['تقرير أداء إعلانات سبتمبر', 'وِكاد', 'm-mr', 'g2', 'S', -14, 'done', -15, 4],
    ['حملة ميتا لمنتج الموسم', 'أونا', 'm-mr', 'g2', 'L', -6, 'done', -7, 5],
    ['إطلاق حملة سناب شات', 'أونا', 'm-mr', 'g2', 'M', 2, 'doing'],
    ['إعداد جمهور إعلانات الشتاء', 'وِكاد', 'm-mr', 'g2', 'S', 3, 'new'],
    ['حملة تيك توك للافتتاح', 'وِكاد', 'm-mr', 'g2', 'L', 5, 'new'],
    ['تصوير فريق العمل', 'وِكاد', 'm-zh', 'g3', 'M', -10, 'done', -11, 5],
    ['4 ريلز لمنتج جديد', 'أونا', 'm-zh', 'g3', 'M', -3, 'done', -4, 4],
    ['جلسة تصوير منيو الشتاء', 'وِكاد', 'm-zh', 'g3', 'L', 3, 'doing'],
    ['ريلز أسبوعية', 'أونا', 'm-zh', 'g3', 'M', 0, 'review', 0],
    ['خطة محتوى نوفمبر', 'صيت', 'm-rs', 'g4', 'M', -1, 'review', -1],
    ['تنسيق كيترينق معرض', 'عميل فعاليات', 'm-rs', 'g4', 'M', -9, 'done', -7, 4, 'vendor'],
    ['عرض كيترينق لحفل شركة', 'عميل فعاليات', 'm-rs', 'g4', 'M', 4, 'new'],
    ['تأكيد موردين فعالية نهاية الشهر', 'عميل فعاليات', 'm-rs', 'g4', 'S', 8, 'new'],
    ['لوحة متابعة الأداء', 'صيت', 'm-am', 'g5', 'L', -5, 'done', -5, 4],
    ['تحديث لوحة حجوزات وِكاد', 'وِكاد', 'm-am', 'g5', 'M', -2, 'doing', null, null, 'client'],
    ['نسخ احتياطي لملفات العملاء', 'صيت', 'm-am', 'g5', 'S', 7, 'new'],
    ['ربط الحجوزات بالدفع الإلكتروني', 'وِكاد', 'm-am', 'g5', 'L', 10, 'new']
  ];
  const tasks = rows.map(([title, client, a, g, size, due, status, sub, quality, late]) => ({
    id: uid(), month, title, client, assignee_id: a, goal_id: g, size, points: SIZE_POINTS[size], due_date: d(due), status,
    submitted_at: sub != null ? d(sub) : null, done_at: status === 'done' ? d(sub != null ? sub : due) : null,
    quality: quality || null, late_reason: late || null, description: ''
  }));
  // الشهر السابق للأنماط
  const pm = (n) => `${prev}-${String(n).padStart(2, '0')}`;
  const past = [
    ['m-rb', 'وِكاد', 5, 4], ['m-rb', 'أونا', 12, 12], ['m-mr', 'وِكاد', 9, 11, 'client'], ['m-mr', 'أونا', 16, 16], ['m-zh', 'وِكاد', 7, 6],
    ['m-zh', 'أونا', 21, 20], ['m-rs', 'صيت', 14, 15], ['m-am', 'وِكاد', 10, 13, 'client'], ['m-am', 'وِكاد', 24, 26, 'client'], ['m-rb', 'وِكاد', 23, 22]
  ].map(([a, client, due, sub, late]) => ({ id: uid(), month: prev, title: 'مهمة سابقة', client, assignee_id: a, size: 'M', points: 20, due_date: pm(due), status: 'done', submitted_at: pm(sub), done_at: pm(sub), quality: 4, late_reason: late || null }));
  return {
    profiles: P, goals, tasks: [...tasks, ...past],
    adjustments: [{ id: uid(), member_id: 'm-mr', month, points: 10, reason: 'فكرة حملة مقترحة اعتمدها العميل', created_at: new Date().toISOString() }],
    evaluations: [], settings: {},
    departments,
    allowed: P.map(({ email, full_name, role_title, color, skills, role, department_id }) => ({ email, full_name, role_title, color, skills, role, department_id }))
  };
}

const local = {
  async init() {
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db) { db = seed(); save(); }
  },
  onAuth() {},
  async me() {
    let id = null;
    try { id = localStorage.getItem(ME_KEY); } catch (e) { /* */ }
    return db.profiles.find((p) => p.id === id) || null;
  },
  demoUsers() { return db.profiles; },
  async demoLogin(id) { try { localStorage.setItem(ME_KEY, id); } catch (e) { /* */ } },
  async signOut() { try { localStorage.removeItem(ME_KEY); } catch (e) { /* */ } },
  resetDemo() { db = seed(); save(); },
  async load(month) {
    const clone = (x) => JSON.parse(JSON.stringify(x));
    return clone({
      month,
      profiles: db.profiles,
      tasks: db.tasks.filter((t) => t.month === month),
      goals: db.goals.filter((g) => g.month === month),
      adjustments: db.adjustments.filter((a) => a.month === month),
      evaluations: db.evaluations.filter((e) => e.month === month),
      settings: db.settings,
      history: db.tasks.filter((t) => t.month <= month),
      allowed: db.allowed,
      departments: db.departments
    });
  },
  async addTasks(rows) { const out = rows.map((r) => ({ id: uid(), status: 'new', quality: null, late_reason: null, submitted_at: null, done_at: null, description: '', ...r })); db.tasks.push(...out); save(); return out; },
  async updateTask(id, patch) { const t = db.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); save(); },
  async deleteTask(id) { db.tasks = db.tasks.filter((x) => x.id !== id); save(); },
  async setStatus(id, status, reason) {
    const t = db.tasks.find((x) => x.id === id); if (!t) return;
    const today = todayStr();
    t.status = status;
    t.submitted_at = ['review', 'done'].includes(status) ? (t.submitted_at || today) : null;
    t.done_at = status === 'done' ? (t.done_at || today) : null;
    if (reason) t.late_reason = reason;
    save();
  },
  async addGoal(row) { const g = { id: uid(), ...row }; db.goals.push(g); save(); return g; },
  async deleteGoal(id) { db.goals = db.goals.filter((g) => g.id !== id); db.tasks.forEach((t) => { if (t.goal_id === id) t.goal_id = null; }); save(); },
  async addAdjustment(row) { db.adjustments.unshift({ id: uid(), created_at: new Date().toISOString(), ...row }); save(); },
  async deleteAdjustment(id) { db.adjustments = db.adjustments.filter((a) => a.id !== id); save(); },
  async saveEvaluation(row) {
    const i = db.evaluations.findIndex((e) => e.member_id === row.member_id && e.month === row.month);
    if (i >= 0) db.evaluations[i] = { ...db.evaluations[i], ...row }; else db.evaluations.push({ id: uid(), ...row });
    save();
  },
  async saveSettings(data) { db.settings = data; save(); },
  async updateProfile(id, patch) { const p = db.profiles.find((x) => x.id === id); if (p) Object.assign(p, patch); save(); },
  async saveAllowed(row) {
    const i = db.allowed.findIndex((a) => a.email === row.email);
    if (i >= 0) db.allowed[i] = row; else db.allowed.push(row);
    const p = db.profiles.find((x) => x.email === row.email);
    if (p) Object.assign(p, row); else db.profiles.push({ id: uid(), active: true, ...row });
    save();
  },
  async deleteAllowed(email) { db.allowed = db.allowed.filter((a) => a.email !== email); const p = db.profiles.find((x) => x.email === email); if (p) p.active = false; save(); },
  async saveDepartment(row) { if (row.id) { const d = db.departments.find((x) => x.id === row.id); if (d) Object.assign(d, { name: row.name, color: row.color }); } else db.departments.push({ id: uid(), name: row.name, color: row.color, sort: db.departments.length + 1 }); save(); },
  async deleteDepartment(id) { db.departments = db.departments.filter((d) => d.id !== id); db.profiles.forEach((p) => { if (p.department_id === id) p.department_id = null; }); db.allowed.forEach((p) => { if (p.department_id === id) p.department_id = null; }); save(); }
};

export const api = isDemo ? local : remote;
