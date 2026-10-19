(function () {
  const ECAMPUS = 'https://ecampus.ius.edu.ba';
  const CATALOG = window.COURSE_DATA || { courses: {}, staff: {} };
  const I18N = window.I18N;
  const PALETTE_SIZE = 8;
  const FORM_DAYS = [1, 2, 3, 4, 5, 6];

  // A ?now=2026-10-19T12:30 query pins the clock, for previewing a moment in a desktop browser.
  const pinned = new Date(new URLSearchParams(location.search).get('now') || NaN);

  // The Android app saves through its own storage so the timetable survives offline and online launches.
  const store = {
    get(key) {
      try { return window.AndroidStore ? window.AndroidStore.getItem(key) : localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try {
        if (window.AndroidStore) window.AndroidStore.setItem(key, value); else localStorage.setItem(key, value);
      } catch (e) { /* nothing else to fall back to */ }
    }
  };

  const DEFAULT_SETTINGS = { theme: 'system', before: false, lead: 15, evening: false, eveningTime: '20:00' };
  const THEMES = ['system', 'light', 'dark'];
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const LEAD_CHOICES = [5, 10, 15, 30, 60];

  const state = {
    lang: I18N[store.get('lang')] ? store.get('lang') : 'en',
    classes: loadClasses(),
    settings: loadSettings(),
    notifyPermission: window.AndroidNotify ? window.AndroidNotify.permission() : 'unsupported',
    quiz: (() => {
      const cache = loadQuizCache();
      return { list: cache.quizzes, fetchedAt: cache.at, status: cache.at ? 'cached' : 'idle', scope: store.get('quizScope') === 'all' ? 'all' : 'mine' };
    })(),
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
  const sorted = list => [...list].sort((a, b) => a.d - b.d || toMin(a.s) - toMin(b.s));
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
    const used = new Set(state.classes.map(c => c.d));
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
    const total = state.classes.reduce((sum, c) => sum + dur(c), 0);
    $('summary').textContent = state.classes.length ? t.summary(codes.length, ects, fmtDur(total)) : '';

    const start = Math.min(9 * 60, ...state.classes.map(c => Math.floor(toMin(c.s) / 60) * 60));
    const end = Math.max(17 * 60, ...state.classes.map(c => Math.ceil(toMin(c.e) / 60) * 60));
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
        <span>${esc(t.types[c.t] || c.t)} · ${dayShort(c.d)} ${c.s}–${c.e}${c.room ? ' · ' + esc(c.room) : ''}${c.sec ? ` · ${t.section} ${esc(c.sec)}` : ''}</span>
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
      ${people.length ? `<p class="lbl-sm">${t.instructors}</p><ul class="people">${people.map(personHtml).join('')}</ul>` : ''}
    </li>`;
  }

  function renderCourses() {
    const t = T();
    const codes = [...new Set(sorted(state.classes).map(c => c.code))];
    $('courseList').innerHTML = codes.map(courseCard).join('');
    const fmt = value => new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
    const parts = [];
    if (CATALOG.term) parts.push(t.termFrom(CATALOG.term.term, fmt(CATALOG.term.updated)));
    if (CATALOG.generated) parts.push(t.dataFrom(fmt(CATALOG.generated)));
    $('source').textContent = parts.length ? parts.join(' ') : t.noData;
  }

  // --- Quizzes --------------------------------------------------------------------------------
  // Students report quizzes to the club portal; only quizzes the club approved come back from the API.

  const QUIZ_API = 'https://iusengclub.vercel.app/api';
  const QUIZ_FRESH_MS = 2 * 60 * 1000;
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
      quiz.list = Array.isArray(data.quizzes) ? data.quizzes : [];
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

  function visibleQuizzes(scope) {
    const mine = myCourseSections();
    const forMe = q => {
      const sections = mine.get(q.course);
      return !!sections && (!q.section || !sections.size || sections.has(String(q.section).toUpperCase()));
    };
    return state.quiz.list
      .filter(q => q && q.course && q.date && daysAway(q.date) >= 0)
      .filter(q => scope === 'all' || forMe(q))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'));
  }

  function quizDay(date) {
    const t = T(), away = daysAway(date);
    const label = new Intl.DateTimeFormat(t.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(dateOf(date));
    return { label, relative: away === 0 ? t.todayWord : away === 1 ? t.tomorrow : '' };
  }

  function stamp(iso) {
    const t = T(), at = new Date(iso);
    const sameDay = isoDate(at) === isoDate(new Date());
    return new Intl.DateTimeFormat(t.locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at);
  }

  function quizHtml(q) {
    const t = T(), name = (info(q.course) || {}).n || '';
    const color = state.classes.some(c => c.code === q.course) ? colorClass(q.course) : '';
    const details = [name, q.section ? '' : t.allSections].filter(Boolean).map(esc).join(' · ');
    return `<div class="quiz ${color}">
      <span class="when${q.time ? '' : ' muted'}">${q.time ? esc(q.time) : '–'}</span>
      <span class="what">
        <span class="top"><span class="code">${esc(q.course)}${q.section ? '.' + esc(q.section) : ''}</span><span class="nm">${esc(q.title || t.quiz)}</span></span>
        ${details ? `<span class="meta">${details}</span>` : ''}
        ${q.note ? `<span class="meta">${esc(q.note)}</span>` : ''}
      </span>
    </div>`;
  }

  function renderQuizzes() {
    const t = T(), quiz = state.quiz;
    document.querySelectorAll('[data-quiz-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.quizScope === quiz.scope)));
    $('quizScope').setAttribute('aria-label', t.upcomingQuizzes);
    $('quizStatus').textContent =
      quiz.status === 'loading' && !quiz.fetchedAt ? t.quizLoading
      : quiz.status === 'offline' ? t.quizOffline(stamp(quiz.fetchedAt))
      : quiz.status === 'error' ? t.quizUnavailable
      : quiz.fetchedAt ? t.quizUpdated(stamp(quiz.fetchedAt)) : '';

    const list = visibleQuizzes(quiz.scope);
    if (!list.length) {
      const message = quiz.status === 'error' || (quiz.status === 'loading' && !quiz.fetchedAt) ? ''
        : quiz.scope === 'all' ? t.noQuizzesAll
        : state.classes.length ? t.noQuizzesMine : t.noClassesForQuizzes;
      $('quizList').innerHTML = message ? `<p class="empty">${message}</p>` : '';
      return;
    }
    const days = [];
    list.forEach(q => {
      const last = days[days.length - 1];
      if (last && last.date === q.date) last.items.push(q); else days.push({ date: q.date, items: [q] });
    });
    $('quizList').innerHTML = days.map(day => {
      const { label, relative } = quizDay(day.date);
      return `<section class="quiz-day">
        <h3>${esc(relative || label)}${relative ? ` <span>${esc(label)}</span>` : ''}</h3>
        ${day.items.map(quizHtml).join('')}
      </section>`;
    }).join('');
  }

  // Today screen: the student's quizzes in the next seven days.
  function renderQuizSoon() {
    const t = T(), el = $('quizSoon');
    const soon = visibleQuizzes('mine').filter(q => daysAway(q.date) <= 7);
    el.hidden = !soon.length || !state.classes.length;
    if (el.hidden) return;
    const when = q => quizDay(q.date).relative || new Intl.DateTimeFormat(t.locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(dateOf(q.date));
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
    const error = !code ? t.errCode : !state.form.d ? t.errDay : (!s || !e || toMin(e) <= toMin(s)) ? t.errTime : '';
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
    Object.keys(entry).forEach(k => { if (entry[k] === '') delete entry[k]; });
    const index = state.classes.findIndex(c => c.id === entry.id);
    if (index >= 0) state.classes[index] = entry; else state.classes.push(entry);
    saveClasses();
    closeDialog($('editor'));
    renderAll();
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
      state.classes.forEach(c => {
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
    if (!window.AndroidNotify) return;
    try { window.AndroidNotify.schedule(JSON.stringify(reminderList())); } catch (e) { /* older app without reminders */ }
  }

  // "system" follows the phone; "light" and "dark" override it. The Android app also recolours its status bar.
  function applyTheme() {
    const theme = state.settings.theme, root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme; else delete root.dataset.theme;
    const dark = theme === 'dark' || (theme !== 'light' && darkQuery.matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => { meta.content = dark ? '#151E29' : '#FFFFFF'; });
    if (window.AndroidUi) {
      try { window.AndroidUi.setTheme(theme); } catch (e) { /* older app: the page still switches */ }
    }
  }

  function renderSettings() {
    const t = T(), s = state.settings;
    const native = !!window.AndroidNotify, oldApp = !native && !!window.AndroidStore;
    document.querySelectorAll('[data-theme-choice]').forEach(b => {
      b.textContent = t.themes[b.dataset.themeChoice];
      b.setAttribute('aria-pressed', String(b.dataset.themeChoice === s.theme));
    });
    $('themeGroup').setAttribute('aria-label', t.theme);
    $('setLead').innerHTML = LEAD_CHOICES.map(m => `<option value="${m}"${m === s.lead ? ' selected' : ''}>${t.minutes(m)}</option>`).join('');
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
    if (id === 'setBefore') s.before = e.target.checked;
    if (id === 'setEvening') s.evening = e.target.checked;
    if (id === 'setLead') s.lead = Number(e.target.value);
    if (id === 'setEveningTime' && e.target.value) s.eveningTime = e.target.value;
    saveSettings();
    if ((id === 'setBefore' || id === 'setEvening') && e.target.checked && state.notifyPermission !== 'granted') {
      window.AndroidNotify.requestPermission();
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
    if ($('editor').open) { renderSegments(); onCodeInput(false); }
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
    if ('openSettings' in d) { renderSettings(); return showDialog($('settings')); }
    if (el.id === 'settingsClose') return closeDialog($('settings'));
    if (el.id === 'openNotifySettings') return window.AndroidNotify && window.AndroidNotify.openSettings();
    if (d.themeChoice && THEMES.includes(d.themeChoice)) {
      state.settings.theme = d.themeChoice;
      store.set('settings', JSON.stringify(state.settings));
      applyTheme();
      return renderSettings();
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
  $('fCode').addEventListener('input', () => onCodeInput(true));
  ['fStart', 'fEnd'].forEach(id => $(id).addEventListener('input', updateWarning));
  ['setBefore', 'setEvening', 'setLead', 'setEveningTime'].forEach(id => $(id).addEventListener('change', onSettingChange));
  darkQuery.addEventListener('change', () => { if (state.settings.theme === 'system') applyTheme(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderToday(); renderWeek(); loadQuizzes(false); } });
  setInterval(() => { if (state.followToday) state.day = defaultDay(clock().day); renderToday(); renderWeek(); }, 30000);

  // Called by the Android app: the back button, and the notification permission after a prompt or a settings visit.
  window.app = {
    back() {
      const open = ['editor', 'settings', 'report'].map($).find(dialog => dialog.open);
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
  setTab('today');
  loadQuizzes(false);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* the app still works without offline caching */ });
  }
})();
