(function () {
  const DATA = window.SCHEDULE;
  const I18N = window.I18N;
  const WEEKDAYS = [1, 2, 3, 4, 5];
  const START = 9 * 60, END = 19 * 60;

  // A ?now=2026-10-19T12:30 query pins the clock, for previewing a moment in a desktop browser.
  const pinned = new Date(new URLSearchParams(location.search).get('now') || NaN);

  const state = { lang: loadLang(), tab: 'today', day: 1, followToday: true };

  function loadLang() {
    try { return localStorage.getItem('lang') === 'tr' ? 'tr' : 'en'; } catch (e) { return 'en'; }
  }
  function saveLang(lang) {
    try { localStorage.setItem('lang', lang); } catch (e) { /* the choice just won't persist */ }
  }

  const $ = id => document.getElementById(id);
  const T = () => I18N[state.lang];
  const loc = text => (text && typeof text === 'object') ? (text[state.lang] || text.en) : text;
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const dur = ev => toMin(ev.e) - toMin(ev.s);
  const course = ev => DATA.courses[ev.c];
  const byDay = d => DATA.events.filter(ev => ev.d === d).sort((a, b) => toMin(a.s) - toMin(b.s));
  const evCode = ev => ev.t === 'tut' ? `${course(ev).code.split('.')[0]}.${ev.sec}` : course(ev).code;
  const evIndex = ev => DATA.events.indexOf(ev);
  const tag = ev => ev.t === 'tut' ? `<span class="tag">${T().tutorial}</span>` : '';
  const span = evs => evs.length ? `${evs[0].s}–${evs.reduce((m, ev) => toMin(ev.e) > toMin(m) ? ev.e : m, evs[0].e)}` : '';

  function fmtDur(min) {
    const t = T(), h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} ${t.minute}`;
    return m ? `${h} ${t.hour} ${m} ${t.minute}` : `${h} ${t.hour}`;
  }

  function clock() {
    const now = isNaN(pinned) ? new Date() : pinned;
    return { day: now.getDay(), min: now.getHours() * 60 + now.getMinutes() };
  }

  // On weekends the day view jumps to Monday.
  const defaultDay = day => WEEKDAYS.includes(day) ? day : 1;

  function findNow() {
    const { day, min } = clock();
    const current = DATA.events.find(ev => ev.d === day && toMin(ev.s) <= min && min < toMin(ev.e));
    if (current) {
      return { kind: 'now', ev: current, left: toMin(current.e) - min, progress: (min - toMin(current.s)) / dur(current) };
    }
    for (let k = 0; k < 8; k++) {
      const ev = byDay((day + k) % 7).find(e => k > 0 || toMin(e.s) > min);
      if (ev) return { kind: 'next', ev, k, until: k * 1440 + toMin(ev.s) - min };
    }
    return null;
  }

  function renderStatus() {
    const t = T(), info = findNow(), el = $('status');
    el.hidden = !info;
    if (!info) return;
    const ev = info.ev;
    el.className = `status c-${ev.c}`;
    let sub, extra = '';
    if (info.kind === 'now') {
      sub = `${ev.s}–${ev.e} · ${ev.room} · ${t.left(fmtDur(info.left))}`;
      extra = `<span class="bar"><i style="width:${Math.round(info.progress * 100)}%"></i></span>`;
    } else {
      const when = info.k === 0 ? t.todayWord : info.k === 1 ? t.tomorrow : t.days[ev.d];
      sub = `${when} ${ev.s} · ${ev.room}${info.until < 1440 ? ' · ' + t.inTime(fmtDur(info.until)) : ''}`;
    }
    el.innerHTML = `<span class="lbl">${info.kind === 'now' ? t.now : t.next}</span>
      <span class="top"><span class="code">${evCode(ev)}</span>${tag(ev)}</span>
      <span class="name">${course(ev).name}</span>
      <span class="sub">${sub}</span>${extra}`;
  }

  function renderChips() {
    const t = T(), { day } = clock();
    $('chips').innerHTML = WEEKDAYS.map(d => `
      <button type="button" class="chip${d === day ? ' is-today' : ''}" data-day="${d}" aria-pressed="${d === state.day}">
        ${t.daysShort[d]}
        <span class="dots">${byDay(d).map(ev => `<i class="c-${ev.c}"></i>`).join('')}</span>
      </button>`).join('');
  }

  function renderTimeline() {
    const t = T(), { day, min } = clock(), d = state.day, evs = byDay(d);
    $('dayTitle').innerHTML = `${t.days[d]} <span>${span(evs)}</span>`;
    const hint = $('dayHint');
    hint.hidden = !(state.followToday && !WEEKDAYS.includes(day));
    hint.textContent = t.weekendHint;
    if (!evs.length) {
      $('timeline').innerHTML = `<li class="empty">${t.noClasses}</li>`;
      return;
    }
    $('timeline').innerHTML = evs.map((ev, i) => {
      const gap = i ? toMin(ev.s) - toMin(evs[i - 1].e) : 0;
      const past = d === day && min >= toMin(ev.e);
      const live = d === day && min >= toMin(ev.s) && !past;
      return `${gap >= 30 ? `<li class="gap"><span>${t.free} · ${fmtDur(gap)}</span></li>` : ''}
        <li class="item ${ev.t} c-${ev.c}${past ? ' past' : ''}${live ? ' live' : ''}">
          <div class="time"><b>${ev.s}</b><span>${ev.e}</span></div>
          <button type="button" class="card" data-ev="${evIndex(ev)}">
            <span class="top"><span class="code">${evCode(ev)}</span>${tag(ev)}</span>
            <span class="nm">${course(ev).name}</span>
            <span class="meta">${ev.room}${ev.who ? ' · ' + ev.who : ''}</span>
          </button>
        </li>`;
    }).join('');
  }

  function renderWeek() {
    const t = T(), { day, min } = clock();
    const courses = Object.values(DATA.courses);
    $('summary').textContent = t.summary(
      courses.length,
      courses.reduce((sum, c) => sum + c.ects, 0),
      DATA.events.filter(ev => ev.t === 'tut').length,
      fmtDur(DATA.events.reduce((sum, ev) => sum + dur(ev), 0))
    );
    let html = '<div class="corner"></div>';
    WEEKDAYS.forEach(d => { html += `<div class="dh${d === day ? ' is-today' : ''}">${t.daysShort[d]}</div>`; });
    html += '<div class="times">';
    for (let h = START / 60; h <= END / 60; h++) {
      html += `<span class="hr" style="top:calc(var(--slot) * ${(h * 60 - START) / 10})">${String(h).padStart(2, '0')}</span>`;
    }
    html += '</div>';
    WEEKDAYS.forEach(d => {
      const evs = byDay(d);
      html += `<div class="col${d === day ? ' is-today' : ''}">`;
      if (!evs.length) html += `<span class="free">${t.free}</span>`;
      evs.forEach(ev => {
        html += `<button type="button" class="blk ${ev.t} c-${ev.c}" data-ev="${evIndex(ev)}"
          style="top:calc(var(--slot) * ${(toMin(ev.s) - START) / 10}); height:calc(var(--slot) * ${dur(ev) / 10} - 2px)">
          <span class="code">${course(ev).code.split('.')[0]}</span><span class="room">${ev.room}</span>
        </button>`;
      });
      if (d === day && min >= START && min <= END) {
        html += `<span class="now" style="top:calc(var(--slot) * ${(min - START) / 10})"></span>`;
      }
      html += '</div>';
    });
    $('week').innerHTML = html;
  }

  function slotText(ev) {
    const t = T();
    return `${t.daysShort[ev.d]} ${ev.s}–${ev.e} · ${ev.room}${ev.sec ? ` · ${t.section} ${ev.sec}` : ''}`;
  }

  function personHtml(p) {
    const t = T();
    const role = [p.title, p.duty && t.duty[p.duty]].filter(Boolean).join(' · ');
    const hours = p.oh ? `${t.officeHours}: ${p.oh.map(([d, s, e]) => `${t.daysShort[d]} ${s}–${e}`).join(', ')}` : (p.ohNote ? t.ohNote[p.ohNote] : '');
    const where = [p.office && `${t.office} ${p.office}`, hours].filter(Boolean).join(' · ');
    return `<li>
      <span class="pn">${p.name}</span>
      ${role ? `<span class="pr">${role}</span>` : ''}
      ${where ? `<span class="pd">${where}</span>` : ''}
      ${p.email ? `<span class="pd"><a href="mailto:${p.email}">${p.email}</a></span>` : ''}
    </li>`;
  }

  function renderCourses() {
    const t = T();
    $('courseList').innerHTML = Object.entries(DATA.courses).map(([key, c]) => {
      const lectures = DATA.events.filter(ev => ev.c === key && ev.t === 'lec');
      const tutorials = DATA.events.filter(ev => ev.c === key && ev.t === 'tut');
      return `<li class="course c-${key}">
        <div class="ch"><span class="sw"></span><span class="code">${c.code}</span><span class="ects">${c.ects} ${t.ects}</span></div>
        <h3>${c.name}</h3>
        <dl class="slots">
          <dt>${t.lecture}</dt><dd>${lectures.map(slotText).join('<br>')}</dd>
          <dt>${t.tutorial}</dt><dd>${tutorials.length ? tutorials.map(slotText).join('<br>') : `<span class="muted">${loc(c.noTutorial) || '–'}</span>`}</dd>
        </dl>
        <p class="lbl-sm">${t.instructors}</p>
        <ul class="people">${c.people.map(personHtml).join('')}</ul>
        ${c.coordinator ? `<p class="coord">${t.coordinator}: ${c.coordinator}</p>` : ''}
        ${c.note ? `<p class="cnote">${loc(c.note)}</p>` : ''}
      </li>`;
    }).join('');
  }

  function openSheet(index) {
    const t = T(), ev = DATA.events[index], c = course(ev);
    $('sheetBody').innerHTML = `
      <div class="sheet-head c-${ev.c}"><span class="sw"></span><span class="code">${evCode(ev)}</span>${tag(ev)}</div>
      <h3>${c.name}</h3>
      <dl class="slots">
        <dt>${t.when}</dt><dd>${t.days[ev.d]} ${ev.s}–${ev.e} (${fmtDur(dur(ev))})</dd>
        <dt>${t.room}</dt><dd>${ev.room}</dd>
        ${ev.who ? `<dt>${t.instructors}</dt><dd>${ev.who}</dd>` : ''}
      </dl>
      ${c.note ? `<p class="cnote c-${ev.c}">${loc(c.note)}</p>` : ''}`;
    const sheet = $('sheet');
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
  }

  function closeSheet() {
    const sheet = $('sheet');
    if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
  }

  function renderLive() {
    if (state.followToday) state.day = defaultDay(clock().day);
    renderStatus();
    renderChips();
    renderTimeline();
    renderWeek();
  }

  function setLang(lang) {
    state.lang = lang;
    saveLang(lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T()[el.dataset.i18n]; });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('langGroup').setAttribute('aria-label', T().language);
    renderLive();
    renderCourses();
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${tab}`; });
    $('main').scrollTop = 0;
  }

  document.addEventListener('click', e => {
    const target = e.target;
    const langBtn = target.closest('[data-lang]');
    if (langBtn) return setLang(langBtn.dataset.lang);
    const tabBtn = target.closest('[data-tab]');
    if (tabBtn) return setTab(tabBtn.dataset.tab);
    const chip = target.closest('[data-day]');
    if (chip) {
      state.day = Number(chip.dataset.day);
      state.followToday = state.day === defaultDay(clock().day);
      renderChips();
      return renderTimeline();
    }
    const evBtn = target.closest('[data-ev]');
    if (evBtn) return openSheet(Number(evBtn.dataset.ev));
    if (target.id === 'sheetClose' || target.id === 'sheet') closeSheet();
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderLive(); });
  setInterval(renderLive, 30000);

  // Called by the Android back button. Returns true when the app handled it.
  window.app = {
    back() {
      if ($('sheet').open) { closeSheet(); return true; }
      if (state.tab !== 'today') { setTab('today'); return true; }
      return false;
    }
  };

  setLang(state.lang);
  setTab('today');
})();
