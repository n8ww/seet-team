// حسابات النقاط والتقييم والتحليل الذكي (بدون أي خدمة مدفوعة)

export const SIZE_POINTS = { S: 10, M: 20, L: 30 };
export const SIZE_LABEL = { S: 'صغيرة', M: 'متوسطة', L: 'كبيرة' };
export const STATUSES = [
  { id: 'new', label: 'جديدة', dot: 'rgba(216,196,166,.45)' },
  { id: 'doing', label: 'قيد التنفيذ', dot: '#a9c7e8' },
  { id: 'review', label: 'بانتظار المراجعة', dot: '#f0b48a' },
  { id: 'done', label: 'مكتملة', dot: '#d8c4a6' }
];
export const LATE_REASONS = { self: 'من الموظف', client: 'بانتظار العميل', vendor: 'بانتظار مورد', other: 'سبب آخر' };

export const DEFAULT_SETTINGS = {
  weights: { completion: 40, ontime: 25, quality: 25, initiative: 10 },
  showTeam: true
};
// وزن الحجم لحساب ضغط العمل فقط
export const SIZE_WEIGHT = { S: 1, M: 2, L: 3 };

export const settingsOf = (s) => ({ ...DEFAULT_SETTINGS, ...(s || {}), weights: { ...DEFAULT_SETTINGS.weights, ...((s && s.weights) || {}) } });

// ---------- التواريخ ----------
const pad = (n) => String(n).padStart(2, '0');
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const monthOf = (dateStr) => dateStr.slice(0, 7);
export const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5); // a - b
export const daysInMonth = (month) => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const shiftMonth = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const monthLabel = (month) => { const [y, m] = month.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const dayLabel = (dateStr) => {
  if (!dateStr) return 'بدون موعد';
  const diff = daysBetween(dateStr, todayStr());
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'بكرة';
  if (diff > 1 && diff < 7) return WEEKDAYS[new Date(dateStr + 'T12:00:00').getDay()];
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

// صيغ العدد
export const nTasks = (n) => n === 1 ? 'مهمة واحدة' : n === 2 ? 'مهمتين' : n >= 3 && n <= 10 ? `${n} مهام` : `${n} مهمة`;
export const nDays = (n) => n === 1 ? 'يوم' : n === 2 ? 'يومين' : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوم`;

// ---------- المؤشرات ----------
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

export function memberStats(m, data, s) {
  const today = todayStr();
  const mine = data.tasks.filter((t) => t.assignee_id === m.id);
  const done = mine.filter((t) => t.status === 'done');
  const withDue = done.filter((t) => t.due_date && (t.submitted_at || t.done_at));
  const onTime = withDue.filter((t) => daysBetween(t.submitted_at || t.done_at, t.due_date) <= 0 || (t.late_reason && t.late_reason !== 'self'));
  const rated = done.filter((t) => t.quality);
  const qualityAvg = rated.length ? rated.reduce((a, t) => a + t.quality, 0) / rated.length : 0;
  const open = mine.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const dueSoon = open.filter((t) => t.due_date && t.due_date >= today && daysBetween(t.due_date, today) <= 7);
  const ev = data.evaluations.find((e) => e.member_id === m.id);
  const initiative = ev && ev.initiative != null ? ev.initiative : 50;
  const parts = {
    completion: pct(done.length, mine.length),
    ontime: withDue.length ? pct(onTime.length, withDue.length) : (done.length ? 100 : 0),
    quality: Math.round(qualityAvg / 5 * 100),
    initiative
  };
  const w = s.weights;
  const wsum = w.completion + w.ontime + w.quality + w.initiative || 1;
  const score = mine.length ? Math.round((parts.completion * w.completion + parts.ontime * w.ontime + parts.quality * w.quality + parts.initiative * w.initiative) / wsum) : 0;
  // المهام المنجزة كل أسبوع من الشهر
  const weeks = [0, 0, 0, 0, 0];
  done.forEach((t) => {
    const d = t.submitted_at || t.done_at;
    if (d && monthOf(d) === data.month) weeks[Math.min(4, Math.floor((Number(d.slice(8, 10)) - 1) / 7))] += 1;
  });
  return {
    member: m, tasks: mine, done, open, overdue, dueSoon,
    total: mine.length, doneCount: done.length,
    openLoad: open.reduce((a, t) => a + (SIZE_WEIGHT[t.size] || 2), 0),
    qualityAvg, parts, score, weeks: weeks.slice(0, Math.ceil(daysInMonth(data.month) / 7)), evaluation: ev
  };
}

export const grade = (score) => score >= 90 ? 'ممتاز' : score >= 80 ? 'جيد جداً' : score >= 70 ? 'جيد' : score >= 50 ? 'مقبول' : 'يحتاج دعم';

export function teamStats(data, s) {
  const members = data.profiles.filter((p) => p.active !== false);
  const stats = members.map((m) => memberStats(m, data, s));
  const total = data.tasks.length;
  const done = data.tasks.filter((t) => t.status === 'done').length;
  const allDone = stats.flatMap((x) => x.done);
  const withDue = allDone.filter((t) => t.due_date && (t.submitted_at || t.done_at));
  const onTime = withDue.filter((t) => daysBetween(t.submitted_at || t.done_at, t.due_date) <= 0 || (t.late_reason && t.late_reason !== 'self'));
  const rated = allDone.filter((t) => t.quality);
  return {
    stats,
    total, done,
    completion: pct(done, total),
    ontime: withDue.length ? pct(onTime.length, withDue.length) : 0,
    quality: rated.length ? (rated.reduce((a, t) => a + t.quality, 0) / rated.length) : 0,
    overdue: data.tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < todayStr()),
    review: data.tasks.filter((t) => t.status === 'review'),
    forecast: forecast(data)
  };
}

export function forecast(data) {
  const total = data.tasks.length;
  const done = data.tasks.filter((t) => t.status === 'done').length;
  const today = todayStr();
  const days = daysInMonth(data.month);
  let elapsed;
  if (monthOf(today) > data.month) elapsed = days;
  else if (monthOf(today) < data.month) elapsed = 0;
  else elapsed = Number(today.slice(8, 10));
  const expected = Math.round(elapsed / days * 100);
  if (!total) return { pct: 0, expected, elapsed, days, remaining: days - elapsed };
  let projected = done;
  if (elapsed > 0 && elapsed < days) projected = Math.min(total, done + done / elapsed * (days - elapsed));
  return { pct: Math.round(projected / total * 100), expected, elapsed, days, remaining: days - elapsed };
}

export function goalProgress(data) {
  return data.goals.map((g) => {
    const ts = data.tasks.filter((t) => t.goal_id === g.id);
    const d = ts.filter((t) => t.status === 'done').length;
    return { ...g, total: ts.length, done: d, pct: pct(d, ts.length) };
  });
}

// ---------- المحلل الذكي ----------
const first = (name) => (name || '').split(' ')[0];

export function insights(data, s, team) {
  const out = [];
  const today = todayStr();
  const st = team.stats;
  const nameOf = (id) => (data.profiles.find((p) => p.id === id) || {}).full_name || 'غير محدد';

  // ضغط عمل
  const avgLoad = st.length ? st.reduce((a, x) => a + x.openLoad, 0) / st.length : 0;
  const lightest = [...st].sort((a, b) => a.openLoad - b.openLoad)[0];
  st.forEach((x) => {
    if ((x.dueSoon.length >= 3 || (avgLoad > 0 && x.openLoad > avgLoad * 1.5)) && lightest && lightest.member.id !== x.member.id) {
      const move = [...x.dueSoon, ...x.open].find((t) => t.status === 'new') || x.dueSoon[0];
      out.push({
        id: 'load-' + x.member.id, level: 2, tag: 'ضغط عمل',
        text: `لدى ${x.member.full_name} ${nTasks(x.dueSoon.length)} تسليمها خلال 7 أيام، ومجموع المفتوح ${nTasks(x.open.length)}.` + (move ? ` أقترح نقل «${move.title}» إلى ${lightest.member.full_name} (أخف حمل حالياً).` : ''),
        action: move ? { type: 'reassign', taskId: move.id, to: lightest.member.id, label: 'انقل المهمة' } : null
      });
    }
  });

  // مهام متأخرة
  team.overdue.forEach((t) => {
    const d = daysBetween(today, t.due_date);
    const why = t.late_reason ? ` السبب المسجّل: ${LATE_REASONS[t.late_reason]}.` : ' ما فيه سبب مسجّل.';
    out.push({ id: 'late-' + t.id, level: 3, tag: 'تأخير', text: `«${t.title}» متأخرة ${nDays(d)} عند ${nameOf(t.assignee_id)}.${why}`, action: null, taskId: t.id });
  });

  // مراجعات معلقة
  if (team.review.length) {
    out.push({ id: 'review', level: 2, tag: 'بانتظارك', text: `${nTasks(team.review.length)} بانتظار مراجعتك واعتمادها.`, action: { type: 'goto', href: '#/tasks', label: 'راجعها' } });
  }

  // التزام كامل
  st.forEach((x) => {
    if (x.doneCount >= 3 && x.parts.ontime === 100) {
      out.push({ id: 'streak-' + x.member.id, level: 1, tag: 'التزام كامل', text: `${x.member.full_name}: كل التسليمات بالموعد هالشهر (${nTasks(x.doneCount)}).`, action: null });
    }
  });

  // أهداف متأخرة
  const fc = team.forecast;
  const behind = goalProgress(data).filter((g) => g.total >= 2 && g.pct < fc.expected - 20);
  if (behind.length) out.push({ id: 'goals', level: 2, tag: 'أهداف متأخرة', text: `المتوقع لهذا الوقت ${fc.expected}%، وهذي الأهداف أقل: ${behind.map((g) => `${g.title} (${g.pct}%)`).join('، ')}.`, action: null });

  // مهام بدون مسؤول
  const orphan = data.tasks.filter((t) => !t.assignee_id);
  if (orphan.length) out.push({ id: 'orphan', level: 2, tag: 'بدون مسؤول', text: `${nTasks(orphan.length)} بدون مسؤول.`, action: { type: 'goto', href: '#/tasks', label: 'وزّعها' } });

  return out.sort((a, b) => b.level - a.level);
}

export function patterns(history, profiles) {
  const out = [];
  const delivered = history.filter((t) => t.status === 'done' && t.due_date && (t.submitted_at || t.done_at));
  if (delivered.length < 6) return out;
  const isLate = (t) => daysBetween(t.submitted_at || t.done_at, t.due_date) > 0;
  const lateAll = delivered.filter(isLate).length / delivered.length;
  // أيام الأسبوع
  const byDay = {};
  delivered.forEach((t) => { const d = new Date(t.due_date + 'T12:00:00').getDay(); (byDay[d] = byDay[d] || []).push(t); });
  let worst = null;
  Object.entries(byDay).forEach(([d, ts]) => {
    if (ts.length < 3) return;
    const r = ts.filter(isLate).length / ts.length;
    if (r > lateAll * 1.4 && r >= 0.3 && (!worst || r > worst.r)) worst = { d: Number(d), r };
  });
  if (worst) out.push({ stat: `${(lateAll ? worst.r / lateAll : 0).toFixed(1)}×`, text: `التسليمات المستحقة يوم ${WEEKDAYS[worst.d]} تتأخر أكثر من باقي الأيام.`, rec: `خلّ مواعيد التسليم في أيام ثانية.` });
  // العملاء
  const byClient = {};
  delivered.forEach((t) => { if (!t.client) return; (byClient[t.client] = byClient[t.client] || []).push(t); });
  const clientLate = Object.entries(byClient).map(([c, ts]) => ({ c, n: ts.length, late: ts.filter((t) => isLate(t) && t.late_reason === 'client').length })).filter((x) => x.late >= 2).sort((a, b) => b.late - a.late)[0];
  if (clientLate) out.push({ stat: `${clientLate.late}`, text: `مهام تأخرت بسبب انتظار العميل «${clientLate.c}».`, rec: 'اطلب ملفات وموافقات العميل قبل بدء المهمة.' });
  // نسبة الالتزام العامة
  out.push({ stat: `${Math.round((1 - lateAll) * 100)}%`, text: `نسبة التسليم بالموعد على كل المهام المسجلة (${delivered.length} مهمة).`, rec: lateAll > 0.2 ? 'أضف وقت احتياطي 15% لمواعيد المهام الكبيرة.' : 'مستوى ممتاز، حافظوا عليه.' });
  // الأكثر تسليماً مبكراً
  const early = {};
  delivered.forEach((t) => { if (daysBetween(t.submitted_at || t.done_at, t.due_date) < 0) early[t.assignee_id] = (early[t.assignee_id] || 0) + 1; });
  const top = Object.entries(early).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) { const p = profiles.find((x) => x.id === top[0]); if (p) out.push({ stat: `${top[1]}`, text: `تسليمات مبكرة من ${p.full_name}، الأعلى في الفريق.`, rec: 'ترشيح لمهام أكبر أو مسؤولية إضافية.' }); }
  return out;
}

export function memberRead(x) {
  const labels = { completion: 'إنجاز المهام', ontime: 'الالتزام بالمواعيد', quality: 'جودة التسليم', initiative: 'المبادرة' };
  const entries = Object.entries(x.parts).filter(([k]) => k !== 'initiative' || x.evaluation);
  if (!x.total) return { summary: 'ما فيه مهام مسندة هالشهر.', strength: '—', grow: '—' };
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [bk, bv] = sorted[0];
  const [wk, wv] = sorted[sorted.length - 1];
  const excused = x.done.filter((t) => t.late_reason && t.late_reason !== 'self').length;
  let summary = `المنجز ${x.doneCount} من ${x.total} مهام، ومؤشر الأداء ${x.score} (${grade(x.score)}).`;
  if (x.overdue.length) summary += ` المتأخر حالياً: ${nTasks(x.overdue.length)}.`;
  if (excused) summary += ` ${nTasks(excused)} تأخرت لسبب خارجي (عميل أو مورد).`;
  if (x.dueSoon.length >= 3) summary += ` الحمل عالي الأسبوع الجاي (${nTasks(x.dueSoon.length)}).`;
  return {
    summary,
    strength: `${labels[bk]} (${bv}%)`,
    grow: wv >= 85 ? 'المستوى متوازن، التحدي القادم مهام أكبر.' : `${labels[wk]} (${wv}%)`
  };
}

export function draftNote(x) {
  const r = memberRead(x);
  if (!x.total) return 'لم تُسند مهام في هذا الشهر.';
  return `المنجز ${x.doneCount} من ${x.total} مهام. أبرز نقطة قوة: ${r.strength}. فرصة التطوير: ${r.grow}`;
}

// ---------- تحليل الخطة وتوزيعها ----------
const SIZE_WORDS = { L: ['كبيرة', 'كبير', 'ضخمة', 'L'], S: ['صغيرة', 'صغير', 'بسيطة', 'S'], M: ['متوسطة', 'متوسط', 'M'] };

function findDate(line, month) {
  let m = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = line.match(/(\d{1,2})\s*[/\\-]\s*(\d{1,2})/);
  if (m) return `${month.slice(0, 4)}-${pad(m[2])}-${pad(m[1])}`;
  m = line.match(/(?:يوم|بتاريخ|قبل|موعد|تسليم)\s*(\d{1,2})/);
  if (m) return `${month}-${pad(m[1])}`;
  return null;
}

export const norm = (x) => String(x || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
function matchPos(nl, k) {
  const nk = norm(k).trim();
  if (!nk) return -1;
  let i = nl.indexOf(nk);
  if (i < 0 && nk.length > 4) i = nl.indexOf(nk.slice(0, -1));
  return i;
}

export function parsePlan(text, members, month, data) {
  const knownClients = [...new Set([...(data.history || []), ...data.tasks].map((t) => t.client).filter((c) => c && c.length > 1))];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const goals = [];
  const tasks = [];
  let goal = null;
  const load = {};
  members.forEach((m) => { load[m.id] = data.tasks.filter((t) => t.assignee_id === m.id && t.status !== 'done').reduce((a, t) => a + (SIZE_WEIGHT[t.size] || 2), 0); });
  const lastDay = `${month}-${pad(daysInMonth(month) - 2)}`;

  lines.forEach((raw) => {
    const isHeading = /^#+\s*/.test(raw) || (/[:：]$/.test(raw) && !raw.includes('|')) || /^(هدف|الهدف)\s*[:\-–]/.test(raw);
    if (isHeading) {
      goal = raw.replace(/^#+\s*/, '').replace(/^(هدف|الهدف)\s*[:\-–]\s*/, '').replace(/[:：]$/, '').trim();
      if (goal) goals.push(goal);
      return;
    }
    let line = raw.replace(/^([-*•·▪]|\d+[.)-])\s*/, '');
    let title = line, client = '', who = null, size = null, due = null, reason = '';
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      title = parts[0]; client = parts[1] || '';
      const rest = parts.slice(2).join(' ');
      who = members.find((m) => rest.includes(m.full_name)) || members.find((m) => rest.includes(first(m.full_name)));
      size = Object.keys(SIZE_WORDS).find((k) => SIZE_WORDS[k].some((w) => rest.includes(w)));
      due = findDate(rest, month);
      if (who) reason = 'محدد في الخطة';
    } else {
      const byName = members.find((m) => line.includes(m.full_name)) || members.find((m) => new RegExp(`(^|\\s|ل|-)${first(m.full_name)}(\\s|$|،|,)`).test(line));
      if (byName) { who = byName; reason = 'مذكور بالاسم'; }
      size = Object.keys(SIZE_WORDS).find((k) => SIZE_WORDS[k].some((w) => new RegExp(`(^|\\s)${w}(\\s|$|،|,)`).test(line)));
      due = findDate(line, month);
      const c = line.match(/(?:للعميل|لعميل|عميل)\s*[«"]?([^\s«»",،|]+)/);
      if (c) client = c[1];
    }
    if (!who) {
      const nl = norm(line);
      let best = null, bestKey = null;
      members.forEach((m) => {
        const hits = (m.skills || []).map((k) => ({ k, pos: matchPos(nl, k) })).filter((h) => h.pos >= 0);
        if (!hits.length) return;
        const key = [hits.length, -Math.min(...hits.map((h) => h.pos)), -(load[m.id] || 0)];
        if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) {
          best = m; bestKey = key; best._hits = hits.sort((a, b) => a.pos - b.pos).map((h) => h.k);
        }
      });
      if (best) { who = best; reason = `تخصص: ${best._hits.slice(0, 2).join('، ')}`; delete best._hits; }
      else {
        who = [...members].sort((a, b) => load[a.id] - load[b.id])[0];
        if (who) reason = 'أخف حمل حالياً';
      }
    }
    if (!client) { const kc = knownClients.find((c) => norm(line).includes(norm(c))); if (kc) client = kc; }
    if (!line.includes('|')) {
      title = title
        .replace(/(?:قبل|بتاريخ|موعد(?:ها)?|تسليم(?:ها)?|يوم)\s*\d{1,2}(\s*[/\\-]\s*\d{1,2})?/g, '')
        .replace(/\d{1,2}\s*[/\\-]\s*\d{1,2}/g, '')
        .replace(/(^|\s)(كبيرة|كبير|صغيرة|صغير|متوسطة|متوسط|ضخمة|بسيطة)(?=\s|$|،|,)/g, ' ')
        .replace(/(?:للعميل|لعميل)\s*\S+/g, '')
        .replace(/\s{2,}/g, ' ').replace(/[\s،,\-–]+$/, '').trim() || line;
    }
    if (!size) size = /حملة|هوية|نظام|موقع|جلسة|إطلاق/.test(line) ? 'L' : /تقرير|تعديل|نشر|رد/.test(line) ? 'S' : 'M';
    const points = SIZE_POINTS[size];
    if (who) load[who.id] = (load[who.id] || 0) + SIZE_WEIGHT[size];
    tasks.push({ title: title.trim(), client, assignee_id: who ? who.id : null, size, points, due_date: due || lastDay, goal, reason, include: true });
  });
  return { goals, tasks, load };
}
