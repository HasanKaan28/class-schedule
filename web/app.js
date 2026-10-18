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

  const state = {
    lang: store.get('lang') === 'tr' ? 'tr' : 'en',
    classes: loadClasses(),
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
  const saveClasses = () => store.set('classes', JSON.stringify(state.classes));

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
      return;
    }
    renderStatus();
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

  // --- Shell ----------------------------------------------------------------------------------

  function renderAll() {
    if (state.followToday) state.day = defaultDay(clock().day);
    renderToday();
    renderWeek();
    renderCourses();
  }

  function setLang(lang) {
    state.lang = lang;
    store.set('lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T()[el.dataset.i18n]; });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('langGroup').setAttribute('aria-label', T().language);
    if ($('editor').open) { renderSegments(); onCodeInput(false); }
    renderAll();
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${tab}`; });
    $('main').scrollTop = 0;
  }

  document.addEventListener('click', e => {
    if (e.target.id === 'editor') return closeDialog($('editor')); // tap on the backdrop
    const el = e.target.closest('button');
    if (!el) return;
    const d = el.dataset;
    if (d.lang) return setLang(d.lang);
    if (d.tab) return setTab(d.tab);
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
  $('fCode').addEventListener('input', () => onCodeInput(true));
  ['fStart', 'fEnd'].forEach(id => $(id).addEventListener('input', updateWarning));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderToday(); renderWeek(); } });
  setInterval(() => { if (state.followToday) state.day = defaultDay(clock().day); renderToday(); renderWeek(); }, 30000);

  // Called by the Android back button. Returns true when the page handled it.
  window.app = {
    back() {
      if ($('editor').open) { closeDialog($('editor')); return true; }
      if (state.tab !== 'today') { setTab('today'); return true; }
      return false;
    }
  };

  $('staffList').innerHTML = Object.keys(CATALOG.staff || {}).map(n => `<option value="${esc(n)}">`).join('');
  setLang(state.lang);
  setTab('today');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* the app still works without offline caching */ });
  }
})();
