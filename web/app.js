(function () {
  const ECAMPUS = 'https://ecampus.ius.edu.ba';
  const CATALOG = window.COURSE_DATA || { courses: {}, staff: {} };
  const I18N = window.I18N;
  const PALETTE_SIZE = 8;
  const FORM_DAYS = [1, 2, 3, 4, 5, 6];

  const params = new URLSearchParams(location.search);
  // ?demo=1 is the live preview on the landing page (about/). It shows a sample timetable and never touches
  // the student's saved data: no localStorage, no Android bridges, no reminders, no service worker.
  const DEMO = params.get('demo') === '1';
  // A ?now=2026-10-19T12:30 query pins the clock, for previewing a moment in a desktop browser.
  // Demo mode without one stops at a Wednesday 10:15 in a normal teaching week, so Today has a class running.
  const pinned = new Date(params.get('now') || (DEMO ? '2026-11-11T10:15' : NaN));
  // The Android app's bridges (storage aside), or none in demo mode.
  const bridge = name => DEMO ? null : window[name];

  // The Android app saves through its own storage so the timetable survives offline and online launches.
  // Demo mode keeps everything in memory for this page view only.
  const demoMemory = new Map();
  const store = DEMO ? {
    get(key) { return demoMemory.has(key) ? demoMemory.get(key) : null; },
    set(key, value) { demoMemory.set(key, String(value)); }
  } : {
    get(key) {
      try { return window.AndroidStore ? window.AndroidStore.getItem(key) : localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try {
        if (window.AndroidStore) window.AndroidStore.setItem(key, value); else localStorage.setItem(key, value);
      } catch (e) { /* nothing else to fall back to */ }
    }
  };

  const DEFAULT_SETTINGS = { theme: 'system', effects: null, before: false, lead: 15, evening: false, eveningTime: '20:00' };
  // Settings shows the themes in these groups. Light and dark are in styles.css, the rest in themes/*.css.
  const THEME_GROUPS = [
    ['themeBasic', ['system', 'light', 'dark']],
    ['themeLive', ['bee', 'cat', 'space', 'aquarium', 'snow', 'arcade']],
    ['themeCalm', ['ocean', 'matcha', 'sunset', 'espresso']],
    ['themeFun', ['cevapi', 'coffee3am', 'panic', 'terminal', 'blueprint', 'chalkboard', 'oldpc', 'comic']]
  ];
  const THEMES = THEME_GROUPS.flatMap(g => g[1]);
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Theme animations: the choice made in Settings wins; with no choice (null) they follow the phone.
  const effectsOn = () => state.settings.effects == null ? !calmQuery.matches : !!state.settings.effects;
  const LEAD_CHOICES = [5, 10, 15, 30, 60];
  const TABS = ['today', 'week', 'quizzes', 'courses'];
  const isLang = lang => typeof lang === 'string' && Object.prototype.hasOwnProperty.call(I18N, lang);

  // Demo mode: a first-year timetable from real sections in courses.js, Monday to Friday.
  // [code, section, type in courses.js, type shown]; the ENS101 tutorial runs in the RC1.2 lab, so it shows as a lab.
  const DEMO_CLASSES = [
    ['CS103', '2', 'lec', 'lec'], ['ENS103', '1', 'lec', 'lec'],
    ['ENS103', '1', 'tut', 'tut'], ['ENS101', '1', 'lec', 'lec'],
    ['MATH101', '1', 'lec', 'lec'], ['ENS101', '5', 'tut', 'lab'],
    ['MATH101', '3', 'tut', 'tut'], ['CS103', '2', 'tut', 'tut'],
    ['TURK111', '2', 'lec', 'lec']
  ];
  if (DEMO) {
    const classes = DEMO_CLASSES.map(([code, sec, from, t], i) => {
      const course = CATALOG.courses[code] || {}, row = (course.sec || []).find(s => s[0] === sec && s[1] === from);
      if (!row) return null;
      const lecturer = t === 'lec' && course.lec && course.lec[0] ? course.lec[0].n : '';
      return Object.assign({ id: `demo${i}`, code, sec, t, d: row[2], s: row[3], e: row[4], room: row[5] }, lecturer ? { who: lecturer } : {});
    }).filter(Boolean);
    store.set('classes', JSON.stringify(classes));
    store.set('settings', JSON.stringify({ theme: THEMES.includes(params.get('theme')) ? params.get('theme') : 'light' }));
    store.set('lang', isLang(params.get('lang')) ? params.get('lang') : 'en');
  }

  const state = {
    lang: I18N[store.get('lang')] ? store.get('lang') : 'en',
    classes: loadClasses(),
    settings: loadSettings(),
    notifyPermission: bridge('AndroidNotify') ? bridge('AndroidNotify').permission() : 'unsupported',
    quiz: (() => {
      const cache = loadQuizCache();
      return {
        list: cache.quizzes,
        fetchedAt: cache.at,
        status: cache.at ? 'cached' : 'idle',
        scope: store.get('quizScope') === 'all' ? 'all' : 'mine',
        scores: loadScores(),
        renderLater: false
      };
    })(),
    grades: loadGrades(),
    gradesCode: null,
    gradesEditing: false,
    tab: 'today',
    day: 1,
    followToday: true,
    editing: null,
    form: { t: 'lec', d: null }
  };

  function loadClasses() {
    try {
      const list = JSON.parse(store.get('classes') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  function loadSettings() {
    try {
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(store.get('settings') || '{}'));
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }
  const saveClasses = () => { store.set('classes', JSON.stringify(state.classes)); syncReminders(); };
  const saveSettings = () => { store.set('settings', JSON.stringify(state.settings)); syncReminders(); };

  // --- Helpers --------------------------------------------------------------------------------

  const $ = id => document.getElementById(id);
  const T = () => I18N[state.lang];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/ı/g, 'i').toLowerCase().replace(/\s+/g, ' ').trim();
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const dur = c => toMin(c.e) - toMin(c.s);
  const dayShort = d => T().daysShort[d % 7];
  const dayLong = d => T().days[d % 7];
  const info = code => CATALOG.courses[code] || null;
  const nameOf = c => (info(c.code) || {}).n || c.name || '';
  // Double diploma courses run with the partner university and have no weekly class hours here.
  const NO_CLASS_TIMES = new Set(['IATA101', 'ITRD101']);
  const timed = () => state.classes.filter(c => c.d);
  const sorted = list => [...list].sort((a, b) => (a.d || 8) - (b.d || 8) || (toMin(a.s) || 0) - (toMin(b.s) || 0));
  const byDay = d => sorted(state.classes.filter(c => c.d === d));
  const classLabel = c => `${c.code}${c.sec ? '.' + c.sec : ''}`;
  const typeTag = c => c.t === 'lec' ? '' : `<span class="tag">${esc(T().types[c.t] || c.t)}</span>`;
  const ecampusUrl = code => { const i = info(code); return i && i.url ? ECAMPUS + i.url : null; };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function colorClass(code) {
    const codes = [...new Set(sorted(state.classes).map(c => c.code))];
    return `k${Math.max(0, codes.indexOf(code)) % PALETTE_SIZE}`;
  }

  function fmtDur(min) {
    const t = T(), h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} ${t.minute}`;
    return m ? `${h} ${t.hour} ${m} ${t.minute}` : `${h} ${t.hour}`;
  }

  function clock() {
    const now = isNaN(pinned) ? new Date() : pinned;
    return { day: now.getDay() || 7, min: now.getHours() * 60 + now.getMinutes() };
  }

  // Monday to Friday, plus the weekend days that have classes.
  function shownDays() {
    const used = new Set(timed().map(c => c.d));
    return [1, 2, 3, 4, 5].concat([6, 7].filter(d => used.has(d)));
  }
  const defaultDay = day => shownDays().includes(day) ? day : 1;

  // Known courses open their eCampus syllabus; others open the editor.
  function classLink(c, cls, inner, style) {
    const url = ecampusUrl(c.code);
    const styleAttr = style ? ` style="${style}"` : '';
    return url
      ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener"${styleAttr}>${inner}</a>`
      : `<button type="button" class="${cls}" data-edit="${esc(c.id)}"${styleAttr}>${inner}</button>`;
  }

  function staffFor(name) {
    const staff = CATALOG.staff || {};
    if (!name) return null;
    if (staff[name]) return Object.assign({ name }, staff[name]);
    const key = norm(name), parts = key.split(' ');
    const hit = Object.keys(staff).find(n => norm(n) === key) || Object.keys(staff).find(n => parts.every(p => norm(n).includes(p)));
    return hit ? Object.assign({ name: hit }, staff[hit]) : null;
  }

  // --- Today ----------------------------------------------------------------------------------

  function findNow() {
    const { day, min } = clock();
    const current = state.classes.find(c => c.d === day && toMin(c.s) <= min && min < toMin(c.e));
    if (current) return { kind: 'now', c: current, left: toMin(current.e) - min, progress: (min - toMin(current.s)) / dur(current) };
    for (let k = 0; k < 8; k++) {
      const d = ((day - 1 + k) % 7) + 1;
      const c = byDay(d).find(x => k > 0 || toMin(x.s) > min);
      if (c) return { kind: 'next', c, k, until: k * 1440 + toMin(c.s) - min };
    }
    return null;
  }

  function renderStatus() {
    const t = T(), found = findNow(), el = $('status');
    el.hidden = !found;
    if (!found) return;
    const c = found.c;
    let sub, extra = '';
    if (found.kind === 'now') {
      sub = `${c.s}–${c.e}${c.room ? ' · ' + esc(c.room) : ''} · ${t.left(fmtDur(found.left))}`;
      extra = `<span class="bar"><i style="width:${Math.round(found.progress * 100)}%"></i></span>`;
    } else {
      const when = found.k === 0 ? t.todayWord : found.k === 1 ? t.tomorrow : dayLong(c.d);
      sub = `${when} ${c.s}${c.room ? ' · ' + esc(c.room) : ''}${found.until < 1440 ? ' · ' + t.inTime(fmtDur(found.until)) : ''}`;
    }
    el.className = `status ${colorClass(c.code)}`;
    el.innerHTML = `<span class="lbl">${found.kind === 'now' ? t.now : t.next}</span>
      <span class="top"><span class="code">${esc(classLabel(c))}</span>${typeTag(c)}</span>
      <span class="name">${esc(nameOf(c))}</span>
      <span class="sub">${sub}</span>${extra}`;
  }

  function renderChips() {
    const { day } = clock(), days = shownDays();
    const chips = $('chips');
    chips.style.gridTemplateColumns = `repeat(${days.length}, minmax(0, 1fr))`;
    chips.innerHTML = days.map(d => `
      <button type="button" class="chip${d === day ? ' is-today' : ''}" data-day="${d}" aria-pressed="${d === state.day}">
        ${dayShort(d)}
        <span class="dots">${byDay(d).map(c => `<i class="${colorClass(c.code)}"></i>`).join('')}</span>
      </button>`).join('');
  }

  function renderTimeline() {
    const t = T(), { day, min } = clock(), d = state.day, list = byDay(d);
    const first = list[0], last = list.reduce((m, c) => !m || toMin(c.e) > toMin(m.e) ? c : m, null);
    $('dayTitle').innerHTML = `${dayLong(d)} <span>${first ? `${first.s}–${last.e}` : ''}</span>`;
    const hint = $('dayHint');
    hint.hidden = !(state.followToday && !shownDays().includes(day));
    hint.textContent = t.weekendHint;
    if (!list.length) {
      $('timeline').innerHTML = `<li class="empty">${t.noClasses}</li>`;
      return;
    }
    $('timeline').innerHTML = list.map((c, i) => {
      const gap = i ? toMin(c.s) - toMin(list[i - 1].e) : 0;
      const past = d === day && min >= toMin(c.e);
      const live = d === day && min >= toMin(c.s) && !past;
      const meta = [c.room, c.who].filter(Boolean).map(esc).join(' · ');
      const inner = `<span class="top"><span class="code">${esc(classLabel(c))}</span>${typeTag(c)}</span>
        <span class="nm">${esc(nameOf(c))}</span>${meta ? `<span class="meta">${meta}</span>` : ''}`;
      return `${gap >= 30 ? `<li class="gap"><span>${t.free} · ${fmtDur(gap)}</span></li>` : ''}
        <li class="item ${c.t === 'lec' ? '' : 'alt'} ${colorClass(c.code)}${past ? ' past' : ''}${live ? ' live' : ''}">
          <div class="time"><b>${c.s}</b><span>${c.e}</span></div>
          ${classLink(c, 'card', inner)}
        </li>`;
    }).join('');
  }

  function renderToday() {
    const empty = !state.classes.length;
    $('emptyCard').hidden = !empty;
    ['chips', 'dayTitle', 'timeline'].forEach(id => { $(id).hidden = empty; });
    if (empty) {
      $('status').hidden = true;
      $('dayHint').hidden = true;
      $('quizSoon').hidden = true;
      return;
    }
    renderStatus();
    renderQuizSoon();
    renderChips();
    renderTimeline();
  }

  // --- Week -----------------------------------------------------------------------------------

  function renderWeek() {
    const t = T(), { day, min } = clock(), days = shownDays();
    const codes = [...new Set(state.classes.map(c => c.code))];
    const ects = codes.reduce((sum, code) => sum + ((info(code) || {}).ects || 0), 0);
    const total = timed().reduce((sum, c) => sum + dur(c), 0);
    $('summary').textContent = state.classes.length ? t.summary(codes.length, ects, fmtDur(total)) : '';

    const start = Math.min(9 * 60, ...timed().map(c => Math.floor(toMin(c.s) / 60) * 60));
    const end = Math.max(17 * 60, ...timed().map(c => Math.ceil(toMin(c.e) / 60) * 60));
    const rows = (end - start) / 10;
    const week = $('week');
    week.style.gridTemplateColumns = `26px repeat(${days.length}, minmax(0, 1fr))`;
    week.style.setProperty('--rows', rows);

    let html = '<div class="corner"></div>';
    days.forEach(d => { html += `<div class="dh${d === day ? ' is-today' : ''}">${dayShort(d)}</div>`; });
    html += '<div class="times">';
    for (let h = start / 60; h <= end / 60; h++) {
      html += `<span class="hr" style="top:calc(var(--slot) * ${(h * 60 - start) / 10})">${String(h).padStart(2, '0')}</span>`;
    }
    html += '</div>';
    days.forEach(d => {
      const list = byDay(d);
      html += `<div class="col${d === day ? ' is-today' : ''}">`;
      if (!list.length) html += `<span class="free">${t.free}</span>`;
      list.forEach(c => {
        const style = `top:calc(var(--slot) * ${(toMin(c.s) - start) / 10}); height:calc(var(--slot) * ${dur(c) / 10} - 2px)`;
        const inner = `<span class="code">${esc(c.code)}</span>${c.room ? `<span class="room">${esc(c.room)}</span>` : ''}`;
        html += classLink(c, `blk ${c.t === 'lec' ? '' : 'alt'} ${colorClass(c.code)}`, inner, style);
      });
      if (d === day && min >= start && min <= end) {
        html += `<span class="now" style="top:calc(var(--slot) * ${(min - start) / 10})"></span>`;
      }
      html += '</div>';
    });
    week.innerHTML = html;
  }

  // --- Courses --------------------------------------------------------------------------------

  const hourList = list => list.map(h => `${dayShort(h[0])} ${h[1]}–${h[2]}`).join(', ');

  function personHtml(p) {
    const t = T();
    const where = [p.office && `${t.office} ${esc(p.office)}`, p.hours && `${t.officeHours}: ${esc(p.hours)}`].filter(Boolean).join(' · ');
    const contact = [
      p.email && `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`,
      p.phone && `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>`
    ].filter(Boolean).join(' · ');
    return `<li>
      <span class="pn">${esc(p.name)}</span>
      ${p.role ? `<span class="pr">${esc(p.role)}</span>` : ''}
      ${where ? `<span class="pd">${where}</span>` : ''}
      ${contact ? `<span class="pd">${contact}</span>` : ''}
    </li>`;
  }

  function peopleFor(code, entries) {
    const t = T(), i = info(code), people = [], seen = new Set();
    if (i) {
      (i.lec || []).forEach(l => {
        const s = staffFor(l.n);
        const hours = i.oh && i.oh.length ? hourList(i.oh) : (s && s.h ? hourList(s.h) : '');
        const office = i.oh && i.oh.length ? i.oh[0][3] : (s && s.o);
        people.push({ name: l.n, role: [l.pos, t.lecturer].filter(Boolean).join(' · '), email: l.email, phone: l.phone || (s && s.p), hours, office });
        seen.add(norm(l.n));
      });
      if (i.asst) people.push({ name: i.asst, role: t.assistants, email: i.asstEmail });
    }
    [...new Set(entries.map(c => c.who).filter(Boolean))].forEach(who => {
      const s = staffFor(who);
      const name = s ? s.name : who;
      if (seen.has(norm(name))) return;
      seen.add(norm(name));
      people.push({ name, role: t.instructor, phone: s && s.p, office: s && s.o, hours: s && s.h ? hourList(s.h) : '' });
    });
    return people;
  }

  function courseCard(code) {
    const t = T(), i = info(code), entries = sorted(state.classes.filter(c => c.code === code));
    const name = i ? i.n : (entries.find(c => c.name) || {}).name || '';
    const url = ecampusUrl(code);
    const rows = entries.map(c => `<li class="entry">
        <span>${!c.d ? esc(t.noTimesShort) : `${esc(t.types[c.t] || c.t)} · ${dayShort(c.d)} ${c.s}–${c.e}${c.room ? ' · ' + esc(c.room) : ''}${c.sec ? ` · ${t.section} ${esc(c.sec)}` : ''}`}</span>
        <button type="button" class="link-btn" data-edit="${esc(c.id)}">${t.edit}</button>
      </li>`).join('');
    const people = peopleFor(code, entries);
    // "Not on eCampus" only once the course has actually been looked up there.
    const looked = CATALOG.fetched && CATALOG.fetched[code];
    const ecampus = url
      ? `<a class="ext" href="${esc(url)}" target="_blank" rel="noopener">eCampus ↗</a>`
      : i ? `<span class="ext muted">${looked ? t.notOnEcampus : t.ecampusPending}</span>` : '';
    return `<li class="course ${colorClass(code)}">
      <div class="ch">
        <span class="sw"></span><span class="code">${esc(code)}</span>
        ${i && i.ects ? `<span class="ects">${i.ects} ${t.ects}</span>` : ''}
        ${ecampus}
      </div>
      ${name ? `<h3>${esc(name)}</h3>` : ''}
      ${i && i.u ? `<p class="unit">${esc(i.u)}</p>` : ''}
      <ul class="entries">${rows}</ul>
      ${gradeRow(code)}
      ${people.length ? `<p class="lbl-sm">${t.instructors}</p><ul class="people">${people.map(personHtml).join('')}</ul>` : ''}
    </li>`;
  }

  function renderCourses() {
    const t = T();
    const codes = [...new Set(sorted(state.classes).map(c => c.code))];
    $('courseList').innerHTML = codes.map(courseCard).join('');
    renderOverall(codes);
    const fmt = value => new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
    const parts = [];
    if (CATALOG.term) parts.push(t.termFrom(CATALOG.term.term, fmt(CATALOG.term.updated)));
    if (CATALOG.generated) parts.push(t.dataFrom(fmt(CATALOG.generated)));
    $('source').textContent = parts.length ? parts.join(' ') : t.noData;
  }

  // --- Grades: kept on this device only, never sent anywhere -----------------------------------
  // Weights come from each course's eCampus syllabus (courses.js "assess": [[name, percent, count], ...]).
  // A student can correct them or, when eCampus has none, enter them; their own list then replaces the syllabus's.
  // Stored under "grades": {code: {items: {itemKey: {got, max}}, comps?: [{id, n, w, c}]}}. An empty max means 100.

  // The "IUS Grading System" table printed on every eCampus syllabus: the lowest score for each letter.
  const IUS_SCALE = [[95, 'A'], [85, 'A-'], [80, 'B+'], [75, 'B'], [70, 'B-'], [65, 'C+'], [55, 'C'], [45, 'E'], [0, 'F']];
  const letterFor = avg => (IUS_SCALE.find(([min]) => avg >= min) || IUS_SCALE[IUS_SCALE.length - 1])[1];
  const MAX_COUNT = 30;
  const sameWeight = (a, b) => Math.abs(a - b) < 0.01;

  function loadGrades() {
    try {
      const grades = JSON.parse(store.get('grades') || '{}');
      return grades && typeof grades === 'object' && !Array.isArray(grades) ? grades : {};
    } catch (e) {
      return {};
    }
  }
  const saveGrades = () => store.set('grades', JSON.stringify(state.grades));
  function gradeEntry(code) {
    const g = state.grades[code] = state.grades[code] || {};
    if (!g.items || typeof g.items !== 'object') g.items = {};
    return g;
  }

  const num = value => { const n = parseFloat(String(value == null ? '' : value).replace(',', '.')); return isFinite(n) ? n : NaN; };
  const fmtNum = (value, min, max) => new Intl.NumberFormat(T().locale, { minimumFractionDigits: min || 0, maximumFractionDigits: max == null ? 1 : max }).format(value);

  // The syllabus's components, with ids from their names so scores stay put if eCampus reorders them.
  function syllabusComponents(code) {
    const assess = (info(code) || {}).assess, seen = new Map();
    return (Array.isArray(assess) ? assess : []).filter(a => Array.isArray(a) && num(a[1]) > 0).map(([n, w, c]) => {
      const base = 's:' + norm(n), k = (seen.get(base) || 0) + 1;
      seen.set(base, k);
      return { id: k > 1 ? `${base}#${k}` : base, n: String(n), w: num(w), c: Math.min(MAX_COUNT, Math.max(1, Math.round(num(c)) || 1)) };
    });
  }
  const ownComponents = code => (state.grades[code] && Array.isArray(state.grades[code].comps) ? state.grades[code].comps : null);
  const components = code => ownComponents(code) || syllabusComponents(code);
  const weightSum = comps => comps.reduce((sum, c) => sum + (num(c.w) || 0), 0);

  // "Quizzes" -> "Quiz", "Assignments" -> "Assignment"; longer names such as "Assignments + Quizzes" stay as they are.
  function singular(name) {
    const n = name.trim();
    if (/\s|[+/&,]/.test(n)) return n;
    return n.replace(/zzes$/i, 'z').replace(/ies$/i, 'y').replace(/([^s])s$/i, '$1');
  }

  // Scores the student already gave on the Quizzes tab fill the first quiz component, oldest quiz first.
  function quizPrefill(code, comps) {
    const comp = comps.find(c => /quiz|kviz/i.test(c.n));
    if (!comp) return {};
    const scores = state.quiz.scores;
    const scored = state.quiz.list
      .filter(q => q && q.course === code && q.date && scores[q.id] && !isNaN(num(scores[q.id].got)))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    const out = {};
    scored.slice(0, comp.c).forEach((q, i) => { out[`${comp.id}.${i + 1}`] = { got: scores[q.id].got, max: scores[q.id].max || '' }; });
    return out;
  }

  function gradeItems(code) {
    const comps = components(code), saved = (state.grades[code] || {}).items || {}, pre = quizPrefill(code, comps);
    const items = [];
    comps.forEach(comp => {
      for (let k = 1; k <= comp.c; k++) {
        const key = `${comp.id}.${k}`, own = saved[key], from = own || pre[key] || {};
        items.push({ key, comp, k, got: from.got || '', max: from.max || '', pre: !own && !!pre[key], w: (num(comp.w) || 0) / comp.c });
      }
    });
    return items;
  }

  // The average of what is entered, weighted by the syllabus and scaled over the weight entered so far.
  function gradeResult(code) {
    const items = gradeItems(code), total = weightSum(components(code));
    let entered = 0, earned = 0;
    items.forEach(it => {
      const got = num(it.got), max = it.max === '' ? 100 : num(it.max);
      if (isNaN(got) || !(max > 0) || !(it.w > 0)) return;
      entered += it.w;
      earned += it.w * got / max;
    });
    return { items, total, entered, earned, avg: entered > 0 ? earned / entered * 100 : null };
  }

  const letterTag = avg => `<span class="letter">${esc(letterFor(avg))}</span>`;

  function gradeRow(code) {
    const t = T(), r = gradeResult(code);
    const avg = r.avg == null ? '<span></span>' : `<span class="g-avg">${t.average} <b>${fmtNum(r.avg, 1, 1)}</b> ${letterTag(r.avg)}</span>`;
    return `<div class="grade-row">${avg}<button type="button" class="link-btn" data-grades="${esc(code)}">${t.myGrades}</button></div>`;
  }

  // Top of Courses: the courses with a score so far, weighted by their ECTS.
  function renderOverall(codes) {
    const t = T(), el = $('gradesOverall');
    if (!el) return; // an older cached index.html
    let sum = 0, ects = 0, n = 0;
    codes.forEach(code => {
      const r = gradeResult(code), e = (info(code) || {}).ects;
      if (r.avg == null || !e) return;
      sum += r.avg * e;
      ects += e;
      n++;
    });
    el.hidden = !n;
    if (!n) return;
    const avg = sum / ects;
    el.innerHTML = `<span class="lbl">${t.overallAvg}</span>
      <span class="g-big"><b>${fmtNum(avg, 1, 1)}</b>${letterTag(avg)}</span>
      <span class="sub">${t.overallNote(n, ects)}</span>`;
  }

  function renderGradeResult() {
    const t = T(), r = gradeResult(state.gradesCode);
    const share = r.total > 0 ? Math.min(100, r.entered / r.total * 100) : 0;
    const earnedBar = r.total > 0 ? Math.min(share, r.earned / r.total * 100) : 0;
    $('gradesResult').innerHTML = r.avg == null
      ? `<span class="g-big"><b class="muted">–</b></span>${r.items.length ? `<span class="g-stats">${t.noScoresYet}</span>` : ''}`
      : `<span class="g-big"><b>${fmtNum(r.avg, 1, 1)}</b>${letterTag(r.avg)}<span class="g-cap">${t.average}</span></span>
        <span class="g-bar" aria-hidden="true"><i style="width:${earnedBar}%"></i><s style="width:${share - earnedBar}%"></s></span>
        <span class="g-stats"><span>${t.gradeEntered(t.pct(fmtNum(share)))}</span><span>${t.gradePoints(fmtNum(r.earned, 1, 1), fmtNum(r.total))}</span></span>`;
  }

  function gradeInput(it, part) {
    const t = T(), value = part === 'got' ? it.got : it.max;
    return `<input class="g-in${it.pre ? ' pre' : ''}" inputmode="decimal" maxlength="6" autocomplete="off" data-grade-key="${esc(it.key)}" data-part="${part}" value="${esc(value)}" placeholder="${part === 'got' ? '–' : '100'}" aria-label="${esc(`${it.label}: ${part === 'got' ? t.score : t.scoreMax}`)}">`;
  }

  function renderGradeItems() {
    const t = T(), code = state.gradesCode, items = gradeItems(code), comps = components(code);
    let html = comps.length ? '' : `<p class="empty">${t.noComps}</p>`;
    comps.forEach(comp => {
      const rows = items.filter(it => it.comp.id === comp.id);
      rows.forEach(it => { it.label = comp.c > 1 ? `${singular(comp.n)} ${it.k}` : comp.n; });
      const weight = t.pct(fmtNum(num(comp.w) || 0, 0, 2));
      const row = (it, sub) => `<div class="g-item">
          <span class="lb">${esc(it.label)}${sub ? `<small>${sub}</small>` : ''}</span>
          ${gradeInput(it, 'got')}<span class="g-of">/</span>${gradeInput(it, 'max')}
        </div>`;
      // One item: a single row with its weight. Several: a heading with the shared weight, then a row each.
      html += comp.c > 1
        ? `<section class="g-group">
          <h3><span class="g-name">${esc(comp.n)}</span> <span class="g-w">${weight} · ${t.eachItem(t.pct(fmtNum((num(comp.w) || 0) / comp.c, 0, 2)))}</span></h3>
          ${rows.map(it => row(it)).join('')}
        </section>`
        : `<section class="g-group">${row(rows[0], weight)}</section>`;
    });
    if (items.some(it => it.pre)) html += `<p class="hint">${t.quizFilled}</p>`;
    if (comps.length) html += `<p class="hint">${ownComponents(code) ? t.ownWeights : t.syllabusWeights} ${t.letterNote}</p>`;
    $('gradesBody').innerHTML = html;
  }

  function totalLine(comps) {
    const t = T(), total = weightSum(comps), ok = sameWeight(total, 100);
    return { cls: ok || !comps.length ? 'hint' : 'warn', text: !comps.length ? '' : ok ? t.weightTotal(t.pct(fmtNum(total, 0, 2))) : t.weightOff(t.pct(fmtNum(total, 0, 2))) };
  }

  function renderCompEditor() {
    const t = T(), code = state.gradesCode, comps = components(code), fromSyllabus = syllabusComponents(code).length > 0;
    const field = (c, f, value, attrs) => `<input class="g-in${f === 'n' ? ' g-name' : ''}" data-comp-id="${esc(c.id)}" data-field="${f}" value="${esc(value)}" ${attrs} autocomplete="off" aria-label="${esc(f === 'n' ? t.compName : f === 'w' ? t.compWeight : t.compCount)}">`;
    let html = `<p class="hint">${fromSyllabus ? t.editHint : t.noAssess}</p>`;
    if (comps.length) {
      html += `<div class="g-comp g-comp-head" aria-hidden="true"><span>${t.compName}</span><span>${t.compWeight}</span><span>${t.compCount}</span><span></span></div>`;
      html += comps.map(c => `<div class="g-comp">
        ${field(c, 'n', c.n, 'maxlength="60"')}
        ${field(c, 'w', c.w, 'inputmode="decimal" maxlength="5"')}
        ${field(c, 'c', c.c, 'inputmode="numeric" maxlength="2"')}
        <button type="button" class="g-del" data-comp-del="${esc(c.id)}" aria-label="${esc(`${t.removeComp}: ${c.n}`)}">×</button>
      </div>`).join('');
    }
    const total = totalLine(comps);
    html += `<p class="${total.cls}" id="gradesTotal"${total.text ? '' : ' hidden'}>${total.text}</p>`;
    html += `<button type="button" class="btn ghost wide" data-comp-add>${t.addComp}</button>`;
    if (ownComponents(code) && fromSyllabus) html += `<button type="button" class="link-btn g-reset" data-comp-reset>${t.resetComps}</button>`;
    $('gradesBody').innerHTML = html;
  }

  function renderGrades() {
    const t = T(), code = state.gradesCode, dialog = $('grades');
    if (!code || !dialog) return;
    const i = info(code);
    dialog.className = `sheet grades ${colorClass(code)}`;
    $('gradesTitle').innerHTML = `<span class="code">${esc(code)}</span> ${esc(t.myGrades)}`;
    $('gradesName').textContent = i ? i.n : '';
    $('gradesName').hidden = !i;
    $('gradesEdit').textContent = state.gradesEditing ? t.doneEditing : t.editComps;
    $('gradesClose').textContent = t.close;
    renderGradeResult();
    if (state.gradesEditing) renderCompEditor(); else renderGradeItems();
  }

  function openGrades(code) {
    state.gradesCode = code;
    // No weights from eCampus and none entered yet: start in the editor.
    state.gradesEditing = !components(code).length;
    renderGrades();
    showDialog($('grades'));
    $('grades').scrollTop = 0;
  }

  // Editing starts from a copy of the syllabus's list, so the student only changes what is wrong.
  function editableComponents(code) {
    const g = gradeEntry(code);
    if (!Array.isArray(g.comps)) g.comps = syllabusComponents(code).map(c => Object.assign({}, c));
    return g.comps;
  }

  // Drops scores whose item no longer exists (a removed component, a lower count).
  function pruneItems(code) {
    const g = state.grades[code];
    if (!g || !g.items) return;
    const keys = new Set(gradeItems(code).map(it => it.key));
    Object.keys(g.items).forEach(k => { if (!keys.has(k)) delete g.items[k]; });
  }

  function onGradeInput(e) {
    const input = e.target, code = state.gradesCode, d = input.dataset;
    if (!code) return;
    if (d.gradeKey) {
      const clean = cleanScore(input.value);
      if (clean !== input.value) input.value = clean;
      const it = gradeItems(code).find(x => x.key === d.gradeKey);
      if (!it) return;
      const g = gradeEntry(code), entry = Object.assign({ got: it.got, max: it.max }, { [d.part]: clean });
      // A cleared row is forgotten, unless it would bring back a score from the Quizzes tab.
      if (entry.got || entry.max || quizPrefill(code, components(code))[it.key]) g.items[it.key] = entry;
      else delete g.items[it.key];
      input.classList.remove('pre');
      saveGrades();
      return renderGradeResult();
    }
    if (d.compId) {
      const comp = editableComponents(code).find(c => c.id === d.compId);
      if (!comp) return;
      if (d.field === 'n') comp.n = input.value.slice(0, 60);
      if (d.field === 'w') {
        const clean = cleanScore(input.value).slice(0, 5);
        if (clean !== input.value) input.value = clean;
        comp.w = Math.min(100, num(clean) || 0);
      }
      if (d.field === 'c') {
        const clean = input.value.replace(/\D/g, '').slice(0, 2);
        if (clean !== input.value) input.value = clean;
        if (clean) comp.c = Math.min(MAX_COUNT, Math.max(1, Number(clean)));
      }
      pruneItems(code);
      saveGrades();
      renderGradeResult();
      const total = totalLine(components(code)), el = $('gradesTotal');
      if (el) { el.className = total.cls; el.textContent = total.text; el.hidden = !total.text; }
    }
  }

  // Buttons inside the grades sheet; true when the click was handled.
  function onGradeButton(el) {
    const code = state.gradesCode, d = el.dataset;
    if (el.id === 'gradesClose') { closeDialog($('grades')); return true; }
    if (!code) return false;
    if (el.id === 'gradesEdit') { state.gradesEditing = !state.gradesEditing; renderGrades(); return true; }
    if ('compAdd' in d) {
      const comps = editableComponents(code);
      comps.push({ id: 'c:' + newId(), n: T().newComp, w: Math.max(0, Math.round((100 - weightSum(comps)) * 100) / 100), c: 1 });
      saveGrades();
      renderGrades();
      const names = $('gradesBody').querySelectorAll('.g-name');
      if (names.length) { names[names.length - 1].focus(); names[names.length - 1].select(); }
      return true;
    }
    if (d.compDel) {
      gradeEntry(code).comps = editableComponents(code).filter(c => c.id !== d.compDel);
      pruneItems(code);
      saveGrades();
      renderGrades();
      return true;
    }
    if ('compReset' in d) {
      delete gradeEntry(code).comps;
      pruneItems(code);
      saveGrades();
      renderGrades();
      return true;
    }
    return false;
  }

  // --- Quizzes --------------------------------------------------------------------------------
  // Students report quizzes to the club portal; only quizzes the club approved come back from the API.

  // The club site's own address: the old vercel.app one redirects, and a redirect fails the browser's cross-site check.
  const QUIZ_API = 'https://iuseng.club/api';
  const QUIZ_FRESH_MS = 2 * 60 * 1000;
  const QUIZ_KEEP_DAYS = 180; // past quizzes stay this long for their scores
  const QUIZ_COURSE = /^[A-Z]{2,5}\d{3}[A-Z]?/;
  const QUIZ_SECTION = /^[0-9A-Za-z]{1,4}$/;

  const nowDate = () => (isNaN(pinned) ? new Date() : new Date(pinned.getTime()));
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateOf = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayNumber = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const daysAway = s => dayNumber(s) - dayNumber(isoDate(nowDate()));
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  function loadQuizCache() {
    try {
      const cache = JSON.parse(store.get('quizCache') || 'null');
      return cache && Array.isArray(cache.quizzes) ? cache : { quizzes: [], at: null };
    } catch (e) {
      return { quizzes: [], at: null };
    }
  }

  async function loadQuizzes(force) {
    const quiz = state.quiz;
    if (quiz.status === 'loading') return;
    if (!force && quiz.status === 'ok' && Date.now() - Date.parse(quiz.fetchedAt) < QUIZ_FRESH_MS) return;
    quiz.status = 'loading';
    renderQuizzes();
    try {
      const response = await fetch(`${QUIZ_API}/quizzes`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const fresh = Array.isArray(data.quizzes) ? data.quizzes : [];
      // The API only returns quizzes from today on. Keep the earlier ones already seen on this device,
      // so a week's quiz stays until Friday and past quizzes can still get a score.
      const freshIds = new Set(fresh.map(q => q.id));
      const today = isoDate(nowDate());
      const kept = quiz.list.filter(q => q && !freshIds.has(q.id) && q.date < today && daysAway(q.date) >= -QUIZ_KEEP_DAYS);
      quiz.list = kept.concat(fresh);
      quiz.fetchedAt = new Date().toISOString();
      quiz.status = 'ok';
      store.set('quizCache', JSON.stringify({ quizzes: quiz.list, at: quiz.fetchedAt }));
    } catch (e) {
      quiz.status = quiz.fetchedAt ? 'offline' : 'error'; // the saved list stays on screen
    }
    renderQuizzes();
    renderQuizSoon();
  }

  // Course code -> sections the student entered (empty set: any section).
  function myCourseSections() {
    const map = new Map();
    state.classes.forEach(c => {
      const code = (c.code.match(QUIZ_COURSE) || [c.code])[0];
      if (!map.has(code)) map.set(code, new Set());
      if (c.sec) map.get(code).add(String(c.sec).toUpperCase());
    });
    return map;
  }

  // A quiz with no time on a Monday stands for its whole week (Monday to Friday): syllabi only name the week.
  const mondayOf = date => { const d = dateOf(date); return isoDate(addDays(d, -((d.getDay() + 6) % 7))); };
  const isWeekQuiz = q => !q.time && dateOf(q.date).getDay() === 1;
  const quizEnd = q => (isWeekQuiz(q) ? isoDate(addDays(dateOf(q.date), 4)) : q.date);

  // "All courses" ignores sections: the same quiz held on different days by different sections becomes one entry for that week.
  function mergeSections(list) {
    const groups = new Map();
    list.forEach(q => {
      const key = [q.course, (q.title || '').trim().toLowerCase(), mondayOf(q.date)].join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(q);
    });
    return [...groups.values()].map(rows => {
      const first = rows[0];
      if (rows.every(r => r.date === first.date && (r.time || '') === (first.time || ''))) return Object.assign({}, first, { section: null });
      const note = (rows.find(r => r.note) || {}).note || null;
      return Object.assign({}, first, { section: null, date: mondayOf(first.date), time: null, note });
    });
  }

  function quizIsMine(q, mine) {
    const sections = mine.get(q.course);
    return !!sections && (!q.section || !sections.size || sections.has(String(q.section).toUpperCase()));
  }

  function visibleQuizzes(scope) {
    const mine = myCourseSections();
    const valid = state.quiz.list.filter(q => q && q.course && q.date);
    return (scope === 'all' ? mergeSections(valid) : valid.filter(q => quizIsMine(q, mine)))
      .filter(q => daysAway(quizEnd(q)) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date)
        || (isWeekQuiz(b) - isWeekQuiz(a))
        || (a.time || '99').localeCompare(b.time || '99'));
  }

  // The student's finished quizzes, newest first, so a score can be added afterwards.
  function pastQuizzes() {
    const mine = myCourseSections();
    return state.quiz.list
      .filter(q => q && q.course && q.date && quizIsMine(q, mine) && daysAway(quizEnd(q)) < 0)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  }

  // --- Scores: kept on this device only, never sent anywhere -----------------------------------

  function loadScores() {
    try {
      const scores = JSON.parse(store.get('quizScores') || '{}');
      return scores && typeof scores === 'object' ? scores : {};
    } catch (e) {
      return {};
    }
  }

  function saveScore(id, part, value) {
    const scores = state.quiz.scores;
    const entry = Object.assign({ got: '', max: '' }, scores[id], { [part]: value });
    if (entry.got || entry.max) scores[id] = entry; else delete scores[id];
    store.set('quizScores', JSON.stringify(scores));
  }

  // "18,5" -> "18.5"; letters and a second dot are dropped.
  const cleanScore = value => value.replace(/,/g, '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 6);

  // The maximum the student used last time for this course, offered as the placeholder.
  function usualMax(course) {
    const scored = state.quiz.list.filter(q => q.course === course).map(q => state.quiz.scores[q.id]).find(s => s && s.max);
    return scored ? scored.max : '';
  }

  function scoreInputs(q) {
    const t = T(), s = state.quiz.scores[q.id] || {};
    const attrs = part => `inputmode="decimal" maxlength="6" autocomplete="off" data-score-id="${esc(q.id)}" data-part="${part}"`;
    return `<span class="score">
      <input ${attrs('got')} value="${esc(s.got || '')}" placeholder="–" aria-label="${esc(t.score)}">
      <span class="score-max">/ <input ${attrs('max')} value="${esc(s.max || '')}" placeholder="${esc(usualMax(q.course))}" aria-label="${esc(t.scoreMax)}"></span>
    </span>`;
  }

  function quizDay(date) {
    const t = T(), away = daysAway(date);
    const label = new Intl.DateTimeFormat(t.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(dateOf(date));
    return { label, relative: away === 0 ? t.todayWord : away === 1 ? t.tomorrow : '' };
  }

  function quizWeek(date) {
    const t = T(), start = dateOf(date), end = addDays(start, 4), away = daysAway(date);
    const format = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long' });
    const range = format.formatRange ? format.formatRange(start, end) : `${format.format(start)} – ${format.format(end)}`;
    return { label: t.weekOf(range), relative: away <= 0 ? t.thisWeek : away <= 7 ? t.nextWeek : '' };
  }

  const quizHeading = q => (isWeekQuiz(q) ? quizWeek(q.date) : quizDay(q.date));

  function stamp(iso) {
    const t = T(), at = new Date(iso);
    const sameDay = isoDate(at) === isoDate(new Date());
    return new Intl.DateTimeFormat(t.locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at);
  }

  // options.score: score inputs in the left column (My courses); options.dated: show the date (past list).
  function quizHtml(q, options) {
    const t = T(), opts = options || {}, name = (info(q.course) || {}).n || '';
    const color = state.classes.some(c => c.code === q.course) ? colorClass(q.course) : '';
    const meta = [];
    let left = `<span class="when${q.time ? '' : ' muted'}">${q.time ? esc(q.time) : isWeekQuiz(q) ? t.weekShort : '–'}</span>`;
    if (opts.score) {
      left = scoreInputs(q);
      if (opts.dated) meta.push(quizHeading(q).label);
      if (q.time) meta.push(q.time);
    }
    if (name) meta.push(name);
    return `<div class="quiz ${color}${opts.score ? ' scored' : ''}">
      ${left}
      <span class="what">
        <span class="top"><span class="code">${esc(q.course)}${q.section ? '.' + esc(q.section) : ''}</span><span class="nm">${esc(q.title || t.quiz)}</span></span>
        ${meta.length ? `<span class="meta">${meta.map(esc).join(' · ')}</span>` : ''}
        ${q.note ? `<span class="meta">${esc(q.note)}</span>` : ''}
      </span>
    </div>`;
  }

  function renderQuizzes() {
    const t = T(), quiz = state.quiz;
    // Never redraw under a student who is typing a score; redraw when they leave the field.
    const active = document.activeElement;
    if (active && active.dataset && active.dataset.scoreId) { quiz.renderLater = true; return; }
    quiz.renderLater = false;
    document.querySelectorAll('[data-quiz-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.quizScope === quiz.scope)));
    $('quizScope').setAttribute('aria-label', t.upcomingQuizzes);
    $('quizStatus').textContent =
      quiz.status === 'loading' && !quiz.fetchedAt ? t.quizLoading
      : quiz.status === 'offline' ? t.quizOffline(stamp(quiz.fetchedAt))
      : quiz.status === 'error' ? t.quizUnavailable
      : quiz.fetchedAt ? t.quizUpdated(stamp(quiz.fetchedAt)) : '';

    const mineScope = quiz.scope === 'mine';
    const list = visibleQuizzes(quiz.scope);
    const past = mineScope ? pastQuizzes() : [];
    let html = '';
    if (!list.length) {
      const message = quiz.status === 'error' || (quiz.status === 'loading' && !quiz.fetchedAt) ? ''
        : !mineScope ? t.noQuizzesAll
        : state.classes.length ? t.noQuizzesMine : t.noClassesForQuizzes;
      html += message ? `<p class="empty">${message}</p>` : '';
    }
    // One heading per day, and one per week for the quizzes that only name a week.
    const groups = [];
    list.forEach(q => {
      const key = (isWeekQuiz(q) ? 'week ' : 'day ') + q.date;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(q); else groups.push({ key, heading: quizHeading(q), items: [q] });
    });
    html += groups.map(({ heading, items }) => `<section class="quiz-day">
        <h3>${esc(heading.relative || heading.label)}${heading.relative ? ` <span>${esc(heading.label)}</span>` : ''}</h3>
        ${items.map(q => quizHtml(q, { score: mineScope })).join('')}
      </section>`).join('');
    if (past.length) {
      html += `<section class="quiz-day past">
        <h3>${t.pastQuizzes}</h3>
        ${past.map(q => quizHtml(q, { score: true, dated: true })).join('')}
      </section>`;
    }
    if (mineScope && (list.length || past.length)) html += `<p class="hint">${t.scoreHint}</p>`;
    $('quizList').innerHTML = html;
  }

  // Today screen: the student's quizzes in the next seven days, and this week's quizzes all week.
  function renderQuizSoon() {
    const t = T(), el = $('quizSoon');
    const soon = visibleQuizzes('mine').filter(q => daysAway(q.date) <= 7);
    el.hidden = !soon.length || !state.classes.length;
    if (el.hidden) return;
    const when = q => {
      if (isWeekQuiz(q)) { const week = quizWeek(q.date); return week.relative || week.label; }
      return quizDay(q.date).relative || new Intl.DateTimeFormat(t.locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(dateOf(q.date));
    };
    el.innerHTML = `<span class="lbl">${t.upcomingQuizzes}</span>
      ${soon.slice(0, 3).map(q => `<span class="row"><b>${esc(q.course)}</b> ${esc(q.title || t.quiz)} · ${esc(when(q))}${q.time ? ' ' + esc(q.time) : ''}</span>`).join('')}
      <span class="more">${t.seeAll} →</span>`;
  }

  function deviceId() {
    let id = store.get('deviceId');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id || '')) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      store.set('deviceId', id);
    }
    return id;
  }

  function onReportCourse() {
    const code = $('qCourse').value;
    $('qOtherWrap').hidden = !!code;
    // The lecture section first, otherwise any section the student entered for this course.
    const withSection = state.classes.filter(c => c.code === code && c.sec);
    const pick = withSection.find(c => c.t === 'lec') || withSection[0];
    $('qSection').value = pick ? pick.sec : '';
  }

  function openReport() {
    const t = T(), today = nowDate();
    const codes = [...new Set(sorted(state.classes).map(c => c.code))];
    $('qCourse').innerHTML = codes.map(c => `<option value="${esc(c)}">${esc(c)}${info(c) ? ' · ' + esc(info(c).n) : ''}</option>`).join('')
      + `<option value="">${t.otherCourse}</option>`;
    $('qCourse').value = codes[0] || '';
    ['qOther', 'qTitle', 'qTime', 'qNote', 'qWebsite', 'qDate'].forEach(id => { $(id).value = ''; });
    $('qName').value = store.get('reporterName') || '';
    $('qDate').min = isoDate(addDays(today, -1));
    $('qDate').max = isoDate(addDays(today, 150));
    $('qError').hidden = true;
    $('qSend').disabled = false;
    $('qSend').textContent = t.send;
    onReportCourse();
    showDialog($('report'));
  }

  function reportError(message) {
    $('qError').textContent = message;
    $('qError').hidden = !message;
  }

  async function sendReport() {
    const t = T();
    const course = (($('qCourse').value || $('qOther').value).toUpperCase().replace(/\s+/g, '').match(QUIZ_COURSE) || [''])[0];
    const section = $('qSection').value.trim();
    const date = $('qDate').value;
    const away = date ? daysAway(date) : NaN;
    const error = !course ? t.errQuizCourse
      : section && !QUIZ_SECTION.test(section) ? t.errQuizSection
      : !(away >= -1 && away <= 150) ? t.errQuizDate : '';
    reportError(error);
    if (error) return;
    // Demo mode shows the form but sends nothing.
    if (DEMO) { closeDialog($('report')); return toast(t.demoReport); }

    const body = {
      course,
      section: section || null,
      title: $('qTitle').value.trim() || null,
      date,
      time: $('qTime').value || null,
      note: $('qNote').value.trim() || null,
      name: $('qName').value.trim() || null,
      device: deviceId(),
      website: $('qWebsite').value
    };
    store.set('reporterName', body.name || '');
    $('qSend').disabled = true;
    $('qSend').textContent = t.sending;
    let problem = '';
    try {
      const response = await fetch(`${QUIZ_API}/quiz-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        problem = response.status === 429 ? t.errRate
          : data.error === 'date_out_of_range' ? t.errQuizDate
          : response.status === 503 ? t.errNotReady
          : t.errInvalid;
      }
    } catch (e) {
      problem = t.errNetwork;
    }
    $('qSend').disabled = false;
    $('qSend').textContent = t.send;
    if (problem) return reportError(problem);
    closeDialog($('report'));
    toast(t.reportSent);
  }

  let toastTimer = 0;
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // --- Editor ---------------------------------------------------------------------------------

  function showDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }

  // "cs 103.2" -> CS103 + section 2, unless the full text is itself a course code (e.g. ENS208-6).
  function readCode() {
    const raw = $('fCode').value.toUpperCase().replace(/\s+/g, '');
    if (info(raw)) return { code: raw, sec: '' };
    const match = raw.match(/^([A-Z]+\d+[A-Z]?)[.\-](\w+)$/);
    return match ? { code: match[1], sec: match[2] } : { code: raw, sec: '' };
  }

  function renderSegments() {
    const t = T();
    $('fType').innerHTML = ['lec', 'tut', 'lab'].map(v => `<button type="button" data-type="${v}" aria-pressed="${state.form.t === v}">${t.types[v]}</button>`).join('');
    $('fDay').innerHTML = FORM_DAYS.map(d => `<button type="button" data-fday="${d}" aria-pressed="${state.form.d === d}">${dayShort(d)}</button>`).join('');
  }

  function onCodeInput(suggest) {
    const t = T(), { code } = readCode(), i = info(code);
    const query = $('fCode').value.toUpperCase().replace(/\s+/g, ''), queryName = norm($('fCode').value);
    const list = $('codeSuggest');
    let hits = [];
    if (query.length >= 2 && !i) {
      const all = Object.entries(CATALOG.courses);
      hits = all.filter(([c]) => c.startsWith(query))
        .concat(queryName.length >= 3 ? all.filter(([c, v]) => !c.startsWith(query) && norm(v.n).includes(queryName)) : [])
        .slice(0, 6);
    }
    list.innerHTML = hits.map(([c, v]) => `<li><button type="button" data-pick="${esc(c)}"><b>${esc(c)}</b> ${esc(v.n)}</button></li>`).join('');
    list.hidden = !suggest || !hits.length;
    // Only call a code unknown once nothing in the list starts with it.
    const unknown = !i && code.length >= 4 && !hits.some(([c]) => c.startsWith(query)) && Object.keys(CATALOG.courses).length > 0;
    $('fCourseName').textContent = i ? `${i.n}${i.ects ? ` · ${i.ects} ${t.ects}` : ''}` : (unknown ? t.unknownCourse : '');
    $('fCourseName').classList.toggle('muted', !i);
    const noTimes = NO_CLASS_TIMES.has(code);
    // Optional: an older cached index.html has neither element, and the editor must still open.
    if ($('timeFields')) $('timeFields').hidden = noTimes;
    if ($('fNoTimes')) $('fNoTimes').hidden = !noTimes;
    $('fWarn').hidden = $('fWarn').hidden || noTimes;
    $('fNameWrap').hidden = !unknown;
    const sections = i && i.sec ? i.sec : [];
    $('sectionPicker').hidden = !sections.length;
    $('sectionList').innerHTML = sections.map((s, index) => `
      <button type="button" class="sec-btn" data-sec="${index}">
        ${esc(t.types[s[1]] || s[1])} · ${t.section} ${esc(s[0])} · ${dayShort(s[2])} ${s[3]}–${s[4]}${s[5] ? ' · ' + esc(s[5]) : ''}
      </button>`).join('');
  }

  function pickSection(index) {
    const { code } = readCode(), s = info(code).sec[index];
    state.form.t = ['lec', 'tut', 'lab'].includes(s[1]) ? s[1] : 'lec';
    state.form.d = FORM_DAYS.includes(s[2]) ? s[2] : state.form.d;
    $('fStart').value = s[3];
    $('fEnd').value = s[4];
    $('fRoom').value = s[5] || '';
    $('fSection').value = s[0];
    document.querySelectorAll('.sec-btn').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.sec) === index)));
    renderSegments();
    updateWarning();
  }

  function updateWarning() {
    const s = $('fStart').value, e = $('fEnd').value, warn = $('fWarn');
    if (!state.form.d || !s || !e || toMin(e) <= toMin(s)) { warn.hidden = true; return; }
    const clashes = state.classes.filter(c => c.id !== state.editing && c.d === state.form.d && toMin(c.s) < toMin(e) && toMin(s) < toMin(c.e));
    warn.hidden = !clashes.length;
    warn.textContent = clashes.length ? T().overlap(clashes.map(c => `${classLabel(c)} (${c.s}–${c.e})`).join(', ')) : '';
  }

  function openEditor(id) {
    const t = T(), c = id ? state.classes.find(x => x.id === id) : null;
    state.editing = c ? c.id : null;
    state.form = { t: c ? c.t : 'lec', d: c ? c.d : (state.tab === 'today' && state.classes.length ? state.day : null) };
    $('editorTitle').textContent = c ? t.editClass : t.newClass;
    $('fCode').value = c ? c.code : '';
    $('fName').value = c && c.name ? c.name : '';
    $('fStart').value = c ? c.s : '';
    $('fEnd').value = c ? c.e : '';
    $('fRoom').value = c && c.room ? c.room : '';
    $('fSection').value = c && c.sec ? c.sec : '';
    $('fWho').value = c && c.who ? c.who : '';
    const del = $('fDelete');
    del.hidden = !c;
    del.textContent = t.delete;
    del.dataset.armed = '';
    $('fError').hidden = true;
    renderSegments();
    onCodeInput(false);
    updateWarning();
    showDialog($('editor'));
    if (!c) setTimeout(() => $('fCode').focus(), 60);
  }

  function saveEditor() {
    const t = T(), { code, sec } = readCode(), s = $('fStart').value, e = $('fEnd').value;
    const noTimes = NO_CLASS_TIMES.has(code);
    const error = !code ? t.errCode : noTimes ? '' : !state.form.d ? t.errDay : (!s || !e || toMin(e) <= toMin(s)) ? t.errTime : '';
    $('fError').textContent = error;
    $('fError').hidden = !error;
    if (error) return;
    const entry = {
      id: state.editing || newId(),
      code,
      sec: $('fSection').value.trim() || sec,
      t: state.form.t,
      d: state.form.d,
      s,
      e,
      room: $('fRoom').value.trim(),
      who: $('fWho').value.trim(),
      name: info(code) ? '' : $('fName').value.trim()
    };
    if (noTimes) ['t', 'd', 's', 'e', 'room', 'sec'].forEach(k => delete entry[k]);
    Object.keys(entry).forEach(k => { if (entry[k] === '' || entry[k] == null) delete entry[k]; });
    const index = state.classes.findIndex(c => c.id === entry.id);
    const first = index < 0 && !state.classes.length;
    if (index >= 0) state.classes[index] = entry; else state.classes.push(entry);
    saveClasses();
    closeDialog($('editor'));
    renderAll();
    // The empty Today card held the only Add button; after the first class, open Courses, where the next one is added.
    if (first) setTab('courses');
  }

  function deleteFromEditor() {
    const del = $('fDelete');
    if (!del.dataset.armed) {
      del.dataset.armed = '1';
      del.textContent = T().deleteConfirm;
      return;
    }
    state.classes = state.classes.filter(c => c.id !== state.editing);
    saveClasses();
    closeDialog($('editor'));
    renderAll();
  }

  // --- Settings and reminders -------------------------------------------------------------------

  // Weekly notifications for the Android app: {day: 1-7, min: minutes after midnight, title, body}.
  function reminderList() {
    const t = T(), s = state.settings, list = [];
    if (s.before) {
      timed().forEach(c => {
        let day = c.d, min = toMin(c.s) - s.lead;
        if (min < 0) { min += 1440; day = day === 1 ? 7 : day - 1; }
        list.push({
          day, min,
          title: t.reminderTitle(classLabel(c), c.t === 'lec' ? '' : t.types[c.t], s.lead),
          body: [nameOf(c), `${c.s}–${c.e}`, c.room].filter(Boolean).join(' · ')
        });
      });
    }
    if (s.evening) {
      [1, 2, 3, 4, 5, 6, 7].forEach(d => {
        const classes = byDay(d);
        if (!classes.length) return;
        list.push({
          day: d === 1 ? 7 : d - 1,
          min: toMin(s.eveningTime),
          title: t.tomorrowTitle(classes.length),
          body: classes.map(c => `${c.s} ${classLabel(c)}${c.t === 'lec' ? '' : ' ' + t.types[c.t]}`).join(', ')
        });
      });
    }
    return list;
  }

  function syncReminders() {
    if (!bridge('AndroidNotify')) return;
    try { bridge('AndroidNotify').schedule(JSON.stringify(reminderList())); } catch (e) { /* older app without reminders */ }
  }

  // "system" follows the phone; every other theme sets data-theme on <html>. The Android app also recolours its bars.
  function applyTheme() {
    const theme = THEMES.includes(state.settings.theme) ? state.settings.theme : 'system', root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme; else root.dataset.theme = theme;
    if (effectsOn()) delete root.dataset.fx; else root.dataset.fx = 'off';
    const style = getComputedStyle(root), surface = style.getPropertyValue('--surface').trim();
    const dark = style.colorScheme === 'dark';
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => { meta.content = surface || (dark ? '#151E29' : '#FFFFFF'); });
    if (bridge('AndroidUi')) {
      // The app only knows system, light and dark, so the other themes tell it which of the two they are closest to.
      try { bridge('AndroidUi').setTheme(theme === 'system' ? 'system' : dark ? 'dark' : 'light'); } catch (e) { /* older app: the page still switches */ }
    }
  }

  // A small picture of the app, coloured by the theme named in data-preview.
  const themeMock = (id, half) => `<span class="theme-sw${half ? ' half' : ''}" data-preview="${id}">
      <span class="sw-head"><i></i><b>Aa</b></span>
      <span class="sw-body">
        <span class="sw-card" style="--c:var(--p0)"><b>CS103</b><s></s></span>
        <span class="sw-card" style="--c:var(--p1)"><b>MATH</b><s></s></span>
        <span class="sw-dots">${[2, 3, 4, 5, 6, 7].map(n => `<i style="--c:var(--p${n})"></i>`).join('')}</span>
      </span>
    </span>`;

  function renderThemePicker() {
    const t = T(), current = THEMES.includes(state.settings.theme) ? state.settings.theme : 'system';
    $('themeGroup').innerHTML = THEME_GROUPS.map(([label, ids]) => `<p class="theme-group">${esc(t[label])}</p>
      <div class="theme-row">${ids.map(id => `<button type="button" class="theme-opt" role="radio" data-theme-choice="${id}" aria-checked="${id === current}">
        <span class="theme-frame">${id === 'system' ? themeMock('light', true) + themeMock('dark', true) : themeMock(id)}</span>
        <span class="theme-name">${esc(t.themes[id])}</span>
      </button>`).join('')}</div>`).join('');
  }

  function renderSettings() {
    const t = T(), s = state.settings;
    const native = !!bridge('AndroidNotify'), oldApp = !native && !!bridge('AndroidStore');
    renderThemePicker();
    $('themeGroup').setAttribute('aria-label', t.theme);
    $('setLead').innerHTML = LEAD_CHOICES.map(m => `<option value="${m}"${m === s.lead ? ' selected' : ''}>${t.minutes(m)}</option>`).join('');
    if ($('setEffects')) $('setEffects').checked = effectsOn(); // absent in an older cached page
    $('setBefore').checked = s.before;
    $('setEvening').checked = s.evening;
    $('setEveningTime').value = s.eveningTime;
    ['setBefore', 'setEvening', 'setLead', 'setEveningTime'].forEach(id => { $(id).disabled = !native; });
    $('setLead').closest('.field').classList.toggle('off', !native || !s.before);
    $('setEveningTime').closest('.field').classList.toggle('off', !native || !s.evening);
    const note = $('notifyNote');
    note.hidden = native;
    note.innerHTML = native ? '' : `${oldApp ? t.notifyUpdate : t.notifyWebOnly} <a href="https://github.com/HasanKaan28/class-schedule/releases/latest/download/class-schedule.apk">${t.getApp}</a>`;
    $('permNote').hidden = !(native && (s.before || s.evening) && state.notifyPermission !== 'granted');
  }

  function onSettingChange(e) {
    const s = state.settings, id = e.target.id;
    if (id === 'setEffects') { s.effects = e.target.checked; store.set('settings', JSON.stringify(s)); return applyTheme(); }
    if (id === 'setBefore') s.before = e.target.checked;
    if (id === 'setEvening') s.evening = e.target.checked;
    if (id === 'setLead') s.lead = Number(e.target.value);
    if (id === 'setEveningTime' && e.target.value) s.eveningTime = e.target.value;
    saveSettings();
    if ((id === 'setBefore' || id === 'setEvening') && e.target.checked && state.notifyPermission !== 'granted') {
      bridge('AndroidNotify').requestPermission();
    }
    renderSettings();
  }

  // --- Shell ----------------------------------------------------------------------------------

  function renderAll() {
    if (state.followToday) state.day = defaultDay(clock().day);
    renderToday();
    renderWeek();
    renderCourses();
    renderQuizzes();
  }

  function setLang(lang) {
    state.lang = lang;
    store.set('lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T()[el.dataset.i18n]; });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('langGroup').setAttribute('aria-label', T().language);
    $('openSettings').setAttribute('aria-label', T().settings);
    if ($('siteLink')) $('siteLink').setAttribute('aria-label', T().siteLink); // absent in an older cached page
    if ($('editor').open) { renderSegments(); onCodeInput(false); }
    if ($('grades') && $('grades').open) renderGrades();
    renderSettings();
    renderAll();
    syncReminders(); // notification texts follow the language
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${tab}`; });
    $('main').scrollTop = 0;
    if (tab === 'quizzes') loadQuizzes(false);
  }

  document.addEventListener('click', e => {
    if (e.target.classList.contains('sheet')) return closeDialog(e.target); // tap on the backdrop
    const el = e.target.closest('button');
    if (!el) return;
    const d = el.dataset;
    if (d.grades) return openGrades(d.grades);
    if (el.closest('#grades') && onGradeButton(el)) return;
    if ('openSettings' in d) { renderSettings(); return showDialog($('settings')); }
    if (el.id === 'settingsClose') return closeDialog($('settings'));
    if (el.id === 'openNotifySettings') return bridge('AndroidNotify') && bridge('AndroidNotify').openSettings();
    if (d.themeChoice && THEMES.includes(d.themeChoice)) {
      state.settings.theme = d.themeChoice;
      store.set('settings', JSON.stringify(state.settings));
      applyTheme();
      document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeChoice === d.themeChoice)));
      return;
    }
    if (d.lang) return setLang(d.lang);
    if (d.tab) return setTab(d.tab);
    if (d.goto) return setTab(d.goto);
    if ('report' in d) return openReport();
    if (d.quizScope) {
      state.quiz.scope = d.quizScope === 'all' ? 'all' : 'mine';
      store.set('quizScope', state.quiz.scope);
      return renderQuizzes();
    }
    if (el.id === 'qCancel') return closeDialog($('report'));
    if (d.day) {
      state.day = Number(d.day);
      state.followToday = state.day === defaultDay(clock().day);
      renderChips();
      return renderTimeline();
    }
    if ('add' in d) return openEditor(null);
    if (d.edit) return openEditor(d.edit);
    if (d.pick) {
      $('fCode').value = d.pick;
      return onCodeInput(false);
    }
    if (d.sec) return pickSection(Number(d.sec));
    if (d.type) { state.form.t = d.type; return renderSegments(); }
    if (d.fday) { state.form.d = Number(d.fday); renderSegments(); return updateWarning(); }
    if (el.id === 'fCancel') return closeDialog($('editor'));
    if (el.id === 'fDelete') return deleteFromEditor();
  });

  $('editorForm').addEventListener('submit', e => { e.preventDefault(); saveEditor(); });
  $('reportForm').addEventListener('submit', e => { e.preventDefault(); sendReport(); });
  $('qCourse').addEventListener('change', onReportCourse);
  $('quizList').addEventListener('input', e => {
    const input = e.target;
    if (!input.dataset.scoreId) return;
    const clean = cleanScore(input.value);
    if (clean !== input.value) input.value = clean;
    saveScore(input.dataset.scoreId, input.dataset.part, clean);
  });
  $('quizList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.scoreId) e.target.blur(); });
  $('quizList').addEventListener('focusout', e => {
    if (e.target.dataset.scoreId && state.quiz.renderLater) setTimeout(renderQuizzes, 0);
  });
  if ($('grades')) {
    $('grades').addEventListener('input', onGradeInput);
    $('grades').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });
    $('grades').addEventListener('close', () => { state.gradesCode = null; renderCourses(); });
  }
  $('fCode').addEventListener('input', () => onCodeInput(true));
  ['fStart', 'fEnd'].forEach(id => $(id).addEventListener('input', updateWarning));
  ['setEffects', 'setBefore', 'setEvening', 'setLead', 'setEveningTime'].forEach(id => $(id) && $(id).addEventListener('change', onSettingChange));
  darkQuery.addEventListener('change', () => { if (state.settings.theme === 'system') applyTheme(); });
  calmQuery.addEventListener('change', applyTheme);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderToday(); renderWeek(); loadQuizzes(false); syncReminders(); } });
  setInterval(() => { if (state.followToday) state.day = defaultDay(clock().day); renderToday(); renderWeek(); }, 30000);

  // Called by the Android app: the back button, and the notification permission after a prompt or a settings visit.
  window.app = {
    back() {
      const open = ['editor', 'settings', 'report', 'grades'].map($).find(dialog => dialog && dialog.open);
      if (open) { closeDialog(open); return true; }
      if (state.tab !== 'today') { setTab('today'); return true; }
      return false;
    },
    onNotifyPermission(permission) {
      state.notifyPermission = permission;
      renderSettings();
    }
  };

  $('staffList').innerHTML = Object.keys(CATALOG.staff || {}).map(n => `<option value="${esc(n)}">`).join('');
  applyTheme();
  setLang(state.lang);
  setTab(DEMO && TABS.includes(params.get('tab')) ? params.get('tab') : 'today');
  loadQuizzes(false);

  // Demo mode: the landing page that embeds the preview switches its theme, language and tab with postMessage.
  if (DEMO) {
    window.addEventListener('message', e => {
      const m = e.data;
      if (e.origin !== location.origin || !m || m.type !== 'class-schedule-demo') return;
      if (THEMES.includes(m.theme)) {
        state.settings.theme = m.theme;
        saveSettings();
        applyTheme();
        renderThemePicker();
      }
      if (isLang(m.lang)) setLang(m.lang);
      if (TABS.includes(m.tab)) setTab(m.tab);
    });
  }

  // Demo mode registers no service worker: the preview stays a plain page view.
  if (!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* the app still works without offline caching */ });
    // A new version: reload once so the page, script and styles all come from it. Not while a form is open.
    const hadWorker = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadWorker || reloaded || document.querySelector('dialog[open]')) return;
      reloaded = true;
      location.reload();
    });
    // The Android app can stay open for days, so look for a new version whenever it comes back to the front.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => { /* offline */ });
    });
  }
})();
