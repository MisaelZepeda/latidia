/* Latidia — aplicación principal */
(function () {
  'use strict';
  const { DB, pad, dateKey, timeKey, at, uid, dosesForDate, bpCategory } = MS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => dateKey(new Date());
  const addDays = (ds, n) => { const d = at(ds); d.setDate(d.getDate() + n); return dateKey(d); };
  const vitalTime = v => at(v.date, v.time);
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;

  // Presentaciones: u1/u2 = unidad de la cantidad por toma (singular/plural)
  const PRESENTATIONS = {
    tableta: { label: 'Tableta', u1: 'tableta', u2: 'tabletas' },
    capsula: { label: 'Cápsula', u1: 'cápsula', u2: 'cápsulas' },
    pastilla: { label: 'Pastilla', u1: 'pastilla', u2: 'pastillas' },
    gragea: { label: 'Gragea', u1: 'gragea', u2: 'grageas' },
    jarabe: { label: 'Jarabe', u1: 'ml', u2: 'ml', liquid: true },
    suspension: { label: 'Suspensión', u1: 'ml', u2: 'ml', liquid: true },
    solucion: { label: 'Solución oral', u1: 'ml', u2: 'ml', liquid: true },
    gotas: { label: 'Gotas', u1: 'gota', u2: 'gotas' },
    inyeccion: { label: 'Inyección', u1: 'ml', u2: 'ml', liquid: true },
    sobre: { label: 'Sobre / polvo', u1: 'sobre', u2: 'sobres' },
    inhalador: { label: 'Inhalador', u1: 'disparo', u2: 'disparos' },
    parche: { label: 'Parche', u1: 'parche', u2: 'parches' },
    crema: { label: 'Crema / pomada', u1: 'aplicación', u2: 'aplicaciones' },
    supositorio: { label: 'Supositorio', u1: 'supositorio', u2: 'supositorios' },
    ovulo: { label: 'Óvulo', u1: 'óvulo', u2: 'óvulos' },
    otro: { label: 'Otro', u1: 'dosis', u2: 'dosis' }
  };
  const STRENGTH_UNITS = ['mg', 'g', 'mcg', 'ml', 'UI', 'mg/ml', 'mg/5 ml', 'UI/ml', 'mEq/ml', '%'];
  const SOLID = ['tableta', 'capsula', 'pastilla', 'gragea'];
  const PILL_SHAPES = { redonda: 'Redonda', ovalada: 'Ovalada', oblonga: 'Alargada', triangular: 'Triangular', cuadrada: 'Cuadrada', rombo: 'Rombo' };
  const PILL_COLORS = [['#ffffff', 'Blanco'], ['#f3e9d2', 'Crema'], ['#fde047', 'Amarillo'], ['#fb923c', 'Naranja'], ['#f9a8d4', 'Rosa'], ['#ef4444', 'Rojo'],
    ['#a78bfa', 'Morado'], ['#93c5fd', 'Azul claro'], ['#2563eb', 'Azul'], ['#4ade80', 'Verde'], ['#a16207', 'Café'], ['#9ca3af', 'Gris'], ['#1f2937', 'Negro']];
  const colorName = c => (PILL_COLORS.find(x => x[0] === c) || [, ''])[1];

  // Dibujo de la pastilla (forma + color) o ícono según la presentación
  function pillSVG(look, form, size = 28) {
    const c1 = (look && look.color) || '#ffffff';
    const line = 'stroke="rgba(15,23,42,.35)" stroke-width="1.2"';
    const shine = '<ellipse cx="11" cy="11" rx="4" ry="2.2" fill="#fff" opacity=".45" transform="rotate(-30 11 11)"/>';
    const shape = form === 'capsula' ? 'capsula' : (look && look.shape) || 'redonda';
    let body;
    if (shape === 'capsula') {
      const c2 = (look && look.color2) || c1;
      body = `<g transform="rotate(-35 16 16)"><rect x="3" y="10" width="26" height="12" rx="6" fill="${c2}" ${line}/>
        <path d="M9 10H16V22H9A6 6 0 0 1 9 10Z" fill="${c1}" ${line}/><line x1="16" y1="10" x2="16" y2="22" ${line}/>
        <ellipse cx="9" cy="13.2" rx="3.5" ry="1.2" fill="#fff" opacity=".45"/></g>`;
      return `<svg class="pill-svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
    }
    const shapes = {
      redonda: `<circle cx="16" cy="16" r="11.5" fill="${c1}" ${line}/>`,
      ovalada: `<ellipse cx="16" cy="16" rx="13" ry="9" fill="${c1}" ${line}/>`,
      oblonga: `<rect x="3" y="10" width="26" height="12" rx="6" fill="${c1}" ${line}/>`,
      triangular: `<path d="M16 4.5 28 26H4Z" fill="${c1}" ${line} stroke-linejoin="round"/>`,
      cuadrada: `<rect x="5.5" y="5.5" width="21" height="21" rx="4" fill="${c1}" ${line}/>`,
      rombo: `<path d="M16 3 29 16 16 29 3 16Z" fill="${c1}" ${line} stroke-linejoin="round"/>`
    };
    const score = look && look.scored ? (shape === 'triangular' ? '<line x1="16" y1="9" x2="16" y2="25" stroke="rgba(15,23,42,.3)" stroke-width="1.2"/>' : '<line x1="16" y1="6" x2="16" y2="26" stroke="rgba(15,23,42,.3)" stroke-width="1.2"/>') : '';
    return `<svg class="pill-svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${shapes[shape] || shapes.redonda}${score}${shine}</svg>`;
  }
  const FORM_ICON = { jarabe: 'bottle', suspension: 'bottle', solucion: 'bottle', inyeccion: 'syringe', gotas: 'droplet', inhalador: 'inhaler' };
  // Ícono de un medicamento para las listas
  function medIc(m, extra = '') {
    if (m && (SOLID.includes(m.form) || (m.look && m.look.color))) {
      return `<div class="item-ic med-ic" ${extra} title="${esc(medLookText(m))}">${pillSVG(m.look, m.form, 30)}</div>`;
    }
    return `<div class="item-ic" style="background:var(--primary-soft);color:var(--primary)" ${extra}>${icon(FORM_ICON[m && m.form] || 'pill')}</div>`;
  }
  function medLookText(m) {
    const l = m.look || {};
    const P = PRESENTATIONS[m.form];
    return [P && P.label, m.form !== 'capsula' && l.shape && PILL_SHAPES[l.shape].toLowerCase(), l.color && colorName(l.color).toLowerCase() + (l.color2 && l.color2 !== l.color ? ' y ' + colorName(l.color2).toLowerCase() : ''),
      l.scored && 'ranurada', l.imprint && `grabado «${l.imprint}»`, l.brand].filter(Boolean).join(', ');
  }
  const EVERY_OPTS = [[4, 'Cada 4 horas'], [6, 'Cada 6 horas'], [8, 'Cada 8 horas'], [12, 'Cada 12 horas'], [24, 'Una vez al día (24 h)'], [48, 'Cada 48 horas'], [72, 'Cada 72 horas'], [168, 'Una vez a la semana']];
  const fmtQty = q => {
    const n = Number(q), w = Math.floor(n), f = Math.round((n - w) * 100) / 100;
    const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[f];
    return fr ? (w ? w + ' ' : '') + fr : String(n).replace('.', ',');
  };
  // "1 tableta · 50 mg", "5 ml de jarabe · 250 mg/5 ml"; si no hay datos estructurados usa el texto original
  function doseLabel(m) {
    const P = PRESENTATIONS[m.form];
    const parts = [];
    if (m.qty) parts.push(`${fmtQty(m.qty)} ${P ? (Number(m.qty) <= 1 ? P.u1 : P.u2) : ''}${P && P.liquid ? ' de ' + P.label.toLowerCase() : ''}`.trim());
    else if (P) parts.push(P.label);
    if (m.strength) parts.push(`${String(m.strength).replace('.', ',')} ${m.unit || ''}`.trim());
    return parts.length ? parts.join(' · ') : (m.dose || '');
  }
  function schedLabel(m) {
    if (MS.isInterval(m)) {
      const e = Number(m.every);
      const txt = e === 24 ? 'Una vez al día' : e === 168 ? 'Una vez a la semana' : `Cada ${e} h`;
      return `${txt} · 1.ª toma ${m.firstTime || '08:00'}${m.start ? ' del ' + fmtDate(m.start, { day: 'numeric', month: 'short' }) : ''}`;
    }
    const days = !m.days || m.days.length === 7 || !m.days.length ? 'todos los días' : m.days.slice().sort().map(d => DOW[d]).join(', ');
    return `${(m.times || []).join(' · ')} — ${days}`;
  }

  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DOW1 = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const fmtDate = (ds, opts) => at(ds).toLocaleDateString('es', opts || { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLong = ds => at(ds).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function relDay(ds) {
    const t = today();
    if (ds === t) return 'Hoy';
    if (ds === addDays(t, 1)) return 'Mañana';
    if (ds === addDays(t, -1)) return 'Ayer';
    return cap(fmtDate(ds));
  }

  const APPT_TYPES = {
    consulta: { label: 'Consulta', icon: 'stethoscope', color: 'var(--primary)' },
    examen: { label: 'Examen', icon: 'flask', color: 'var(--pulse)' },
    otro: { label: 'Otro', icon: 'calendar', color: 'var(--warn)' }
  };

  // ---------- Estado ----------
  const state = {
    settings: {}, vitals: [], meds: [], intakes: [], appts: [],
    reg: null, installEvt: null,
    vitalsRange: 30, medDay: today(), 
    calMonth: null, calSel: today(),
    report: null
  };
  const DEFAULT_SETTINGS = { name: '', doctor: '', notify: true, notifyMeds: true, notifyAppts: true, notifyBP: true, bpTimes: ['08:00', '20:00'] };

  async function load() {
    const [settings, vitals, meds, intakes, appts, labs, water] = await Promise.all([
      DB.getKV('settings', {}), DB.all('vitals'), DB.all('meds'), DB.all('intakes'), DB.all('appts'), DB.all('labs'), DB.all('water')
    ]);
    state.water = water.sort((a, b) => a.at.localeCompare(b.at));
    state.habits = (await DB.all('habits')).sort((a, b) => a.at.localeCompare(b.at));
    state.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    applyTextSize();
    if (!settings.bpTimes) await DB.setKV('settings', state.settings); // el service worker lee estos valores
    state.vitals = vitals.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    state.meds = meds.sort((a, b) => a.name.localeCompare(b.name));
    state.intakes = intakes;
    state.appts = appts.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    state.labs = labs.sort((a, b) => b.date.localeCompare(a.date));
    if (typeof started !== 'undefined' && started && Cloud.user) schedulePushSync();
  }
  const saveSettings = () => DB.setKV('settings', state.settings);
  function applyTextSize() {
    const t = state.settings.textSize;
    if (t && t !== 'normal') document.documentElement.dataset.text = t; else delete document.documentElement.dataset.text;
  }
  const intakeMap = () => new Map(state.intakes.map(i => [i.id, i]));

  // ---------- UI helpers ----------
  const haptic = (ms = 12) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };
  function toast(msg, ic, action) {
    if (ic === 'check' || ic === 'droplet') haptic();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (ic ? icon(ic) : '') + `<span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'toast-action'; b.textContent = action.label;
      b.onclick = () => { el.remove(); action.fn(); };
      el.appendChild(b);
      el.style.pointerEvents = 'auto';
    }
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), action ? 6000 : 2800);
  }

  function modal({ title, body, submit = 'Guardar', cancel = 'Cancelar', danger = false, onSubmit, onOpen }) {
    const dlg = $('#modal'), old = $('#modalForm');
    const form = old.cloneNode(false); // formulario nuevo: sin listeners de modales anteriores
    old.replaceWith(form);
    delete form.dataset.panel;
    form.innerHTML = `
      <div class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${cancel ? `<button type="button" class="btn ghost" data-close>${cancel}</button>` : ''}
      <button type="submit" class="btn ${danger ? 'danger' : ''}">${submit}</button></div>`;
    form.onsubmit = async e => {
      e.preventDefault();
      try { if ((await onSubmit(form)) !== false) dlg.close(); }
      catch (err) { console.error(err); toast(err.message || 'Error'); }
    };
    $$('[data-close]', form).forEach(b => b.onclick = () => dlg.close());
    dlg.showModal();
    if (onOpen) onOpen(form);
    return form;
  }
  (function sheetDrag() {
    const dlg = $('#modal');
    let y0 = 0, dy = 0, drag = false;
    dlg.addEventListener('touchstart', e => {
      if (innerWidth > 600 || !e.target.closest('.modal-head')) return;
      y0 = e.touches[0].clientY; dy = 0; drag = true; dlg.style.transition = 'none';
    }, { passive: true });
    dlg.addEventListener('touchmove', e => {
      if (!drag) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      dlg.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    const end = () => {
      if (!drag) return;
      drag = false; dlg.style.transition = 'transform .2s';
      if (dy > 110) { dlg.style.transform = 'translateY(100%)'; setTimeout(() => { dlg.close(); dlg.style.transform = ''; dlg.style.transition = ''; }, 180); }
      else { dlg.style.transform = ''; setTimeout(() => { dlg.style.transition = ''; }, 200); }
    };
    dlg.addEventListener('touchend', end); dlg.addEventListener('touchcancel', end);
  })();
  const confirmDlg = (title, text, submit = 'Eliminar') => new Promise(res => {
    let done = false;
    const finish = v => { if (!done) { done = true; res(v); } };
    modal({ title, body: `<p>${text}</p>`, submit, danger: true, onSubmit: () => finish(true) });
    $$('#modalForm [data-close]').forEach(b => b.addEventListener('click', () => finish(false)));
    $('#modal').addEventListener('close', () => finish(false), { once: true });
  });

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const emptyState = (ic, text, btn) => `<div class="empty">${icon(ic)}<div>${text}</div>${btn || ''}</div>`;
  const statIc = (ic, color) => `<div class="stat-ic" style="background:color-mix(in srgb, ${color} 15%, transparent);color:${color}">${icon(ic)}</div>`;
  const catChip = c => c ? `<span class="chip" style="color:${c.color};background:color-mix(in srgb, ${c.color} 14%, transparent)"><span class="dot"></span>${c.label}</span>` : '';

  function timesEditor(times, name = 'times') {
    return `<div class="times" data-times="${name}">${(times.length ? times : ['08:00']).map(t => timeChip(t, name)).join('')}
      <button type="button" class="btn outline small" data-addtime="${name}">${icon('plus')} Hora</button></div>`;
  }
  const timeChip = (t, name) => `<div class="t"><input type="time" name="${name}" value="${esc(t)}" required>
    <button type="button" class="icon-btn danger" data-rmtime aria-label="Quitar hora">${icon('x')}</button></div>`;
  function bindTimes(root, onChange) {
    root.addEventListener('click', e => {
      const add = e.target.closest('[data-addtime]');
      if (add) {
        add.insertAdjacentHTML('beforebegin', timeChip('12:00', add.dataset.addtime));
        onChange && onChange();
      }
      const rm = e.target.closest('[data-rmtime]');
      if (rm) {
        const box = rm.closest('.times');
        if ($$('.t', box).length > (onChange ? 0 : 1)) { rm.closest('.t').remove(); onChange && onChange(); }
      }
    });
    if (onChange) root.addEventListener('change', e => { if (e.target.matches('.times input')) onChange(); });
  }
  const readTimes = (root, name) => [...new Set($$(`input[name="${name}"]`, root).map(i => i.value).filter(Boolean))].sort();

  // ---------- Router ----------
  const ROUTES = [
    { id: 'inicio', label: 'Inicio', title: 'Inicio', icon: 'home', render: renderHome, fab: () => vitalForm() },
    { id: 'signos', label: 'Signos', title: 'Signos vitales', icon: 'activity', render: renderVitals, fab: () => vitalForm() },
    { id: 'medicamentos', label: 'Medicinas', title: 'Medicamentos', icon: 'pill', render: renderMeds, fab: () => medForm() },
    { id: 'agenda', label: 'Agenda', title: 'Agenda médica', icon: 'calendar', render: renderAgenda, fab: () => apptForm(null, state.calSel) },
    { id: 'resumen', label: 'Resumen', title: 'Resumen', icon: 'chat', render: renderSummary, after: () => summaryAfter(), group: 'mas', sub: 'Tu semana y lo que llevarás a la consulta' },
    { id: 'habitos', label: 'Hábitos', title: 'Hábitos', icon: 'flame', render: renderHabits, group: 'mas', sub: 'Sal, café y rachas' },
    { id: 'analisis', label: 'Análisis', title: 'Análisis de laboratorio', icon: 'flask', render: renderLabs, after: () => labsAfter(), fab: () => labChooser(), group: 'mas', sub: 'Resultados de laboratorio' },
    { id: 'reportes', label: 'Reportes', title: 'Reportes', icon: 'report', render: renderReports, group: 'mas', sub: 'PDF y Excel por fechas' },
    { id: 'ajustes', label: 'Ajustes', title: 'Ajustes', icon: 'settings', render: renderSettings, group: 'mas', sub: 'Cuenta, notificaciones y respaldo' },
    { id: 'mas', label: 'Más', title: 'Más', icon: 'grid', render: renderMore, side: false }
  ];
  // En el celular la barra inferior muestra 5 accesos; el resto vive en «Más»
  function renderMore() {
    return `<div class="card"><div class="list">${ROUTES.filter(r => r.group === 'mas').map(r => `
      <a class="item more-link" href="#/${r.id}"><div class="item-ic" style="background:var(--primary-soft);color:var(--primary)">${icon(r.icon)}</div>
        <div class="item-body"><div class="item-title">${r.label}</div><div class="item-sub">${r.sub}</div></div>${icon('right')}</a>`).join('')}</div></div>`;
  }
  const routeById = id => ROUTES.find(r => r.id === id);
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { route: ROUTES.find(r => r.id === path) || ROUTES[0], params: new URLSearchParams(qs || '') };
  }
  function buildNav() {
    const link = r => `<a href="#/${r.id}" data-route="${r.id}">${icon(r.icon)}<span>${r.label}</span></a>`;
    $('#nav').innerHTML = ROUTES.filter(r => r.side !== false).map(link).join('');
    $('#bottomNav').innerHTML = ROUTES.filter(r => !r.group).map(link).join('');
  }
  let currentRoute = null;
  function render() {
    const { route, params } = parseHash();
    const changed = currentRoute !== route.id;
    currentRoute = route.id;
    $('#pageTitle').textContent = route.title;
    const back = $('#backBtn');
    if (!back.innerHTML) back.innerHTML = icon('left');
    back.hidden = route.group !== 'mas';
    document.body.classList.toggle('in-group', !!route.group);
    document.title = `${route.title} · Latidia`;
    $$('#nav [data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route.id));
    $$('#bottomNav [data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === (route.group || route.id)));
    const view = $('#view');
    view.innerHTML = route.render();
    if (changed) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); clearTimeout(render.enterT); render.enterT = setTimeout(() => view.classList.remove('enter'), 900); }
    view.insertAdjacentHTML('beforeend', `<button class="fab" data-act="fab" aria-label="Registro rápido">${icon('plus')}</button>`);
    if (route.after) route.after();
    bindSwipes(view);
    if (route.id === 'inicio') bindCollapse(view);
    if (changed) window.scrollTo(0, 0);
    refreshNotifCenter();
    if (params.get('nuevo') && route.fab) {
      history.replaceState(null, '', '#/' + route.id);
      route.fab();
    }
    updateHeaderButtons();
  }

  // ======================================================
  //  INICIO
  // ======================================================
  function renderHome() {
    const s = state.settings;
    const last = state.vitals.find(v => v.sys && v.dia);
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
    const weekAgo = addDays(today(), -7);
    const week = state.vitals.filter(v => v.date > weekAgo);
    const wBP = week.filter(v => v.sys && v.dia), wP = week.filter(v => v.pulse);
    const doses = dosesForDate(state.meds, today());
    const im = intakeMap();
    const takenN = doses.filter(d => im.get(d.key)?.status === 'taken').length;
    const skippedN = doses.filter(d => im.get(d.key)?.status === 'skipped').length;
    const pendingToday = doses.filter(d => !im.has(d.key));
    const nowKey = today() + 'T' + timeKey(new Date());
    const upcoming = state.appts.filter(a => !a.done && (a.date + 'T' + (a.time || '23:59')) >= nowKey);
    const next = upcoming[0];

    const banners = [];
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      banners.push(`<div class="banner">${icon('bell')}<div class="item-body"><b>Activa las notificaciones</b><div class="small muted">Para recibir recordatorios de medicamentos, citas y tomas de presión.</div></div><button class="btn small" data-act="enable-notif">Activar</button></div>`);
    }
    for (const { m, st } of lowStockMeds()) {
      banners.push(`<div class="banner warn">${icon('pill')}<div class="item-body"><b>Se te está acabando ${esc(m.name)}</b><div class="small muted">Te alcanza para ${st.days <= 0 ? 'hoy' : `unos ${st.days} día${st.days === 1 ? '' : 's'}`}. Pide tu receta o resurte.</div></div><button class="btn small" data-act="med-refill" data-id="${m.id}">Resurtí</button></div>`);
    }
    if (!isStandalone() && state.installEvt) {
      banners.push(`<div class="banner">${icon('install')}<div class="item-body"><b>Instala Latidia</b><div class="small muted">Acceso rápido y notificaciones en tu celular o computadora.</div></div><button class="btn small" data-act="install">Instalar</button></div>`);
    }

    const cat = last && bpCategory(last.sys, last.dia);
    const W = {
      presion: () => `<div class="card hero">
          <div class="row between"><span class="row" style="gap:8px">${icon('heart')}<b>Última presión</b></span>
          ${last ? `<span class="chip">${relDay(last.date)} · ${last.time}</span>` : ''}</div>
          ${last ? `
            <div class="big num" style="margin:14px 0 6px">${last.sys}/${last.dia} <small>mmHg</small></div>
            <div class="row">${last.pulse ? `<span class="chip">${icon('pulse')} ${last.pulse} lpm</span>` : ''}<span class="chip"><span class="dot" style="color:${cat.color}"></span>${cat.label}</span></div>`
            : `<div style="margin:18px 0" class="muted">Aún no tienes registros. Registra tu primera toma.</div>`}
          <div style="margin-top:16px;position:relative;z-index:1"><button class="btn" style="background:#fff;color:#1d4ed8" data-act="new-vital">${icon('plus')} Registrar toma</button></div>
        </div>`,
      resumen: () => `<div class="grid stats">
          <div class="card stat">${statIc('trend', 'var(--sys)')}<div><div class="label">Promedio 7 días</div><div class="value num">${wBP.length ? `${avg(wBP.map(v => v.sys))}/${avg(wBP.map(v => v.dia))}` : '—'}</div></div></div>
          <div class="card stat">${statIc('pulse', 'var(--pulse)')}<div><div class="label">Pulso promedio</div><div class="value num">${wP.length ? avg(wP.map(v => v.pulse)) : '—'} <small>lpm</small></div></div></div>
          <div class="card stat">${statIc('pill', 'var(--primary)')}<div><div class="label">Dosis de hoy</div><div class="value num">${takenN}/${doses.length}</div></div></div>
          <div class="card stat">${statIc('calendar', 'var(--warn)')}<div style="min-width:0"><div class="label">Próxima cita</div><div class="value" style="font-size:1rem">${next ? relDay(next.date) + (next.time ? ' ' + next.time : '') : '—'}</div></div></div>
        </div>`,
      agua: () => waterCard(),
      medicamentos: () => `<div class="card">
          <div class="card-head"><h3>${icon('pill')} Medicamentos de hoy</h3><a href="#/medicamentos" class="small">Ver todo</a></div>
          ${doses.length ? `<div class="progress" style="margin-bottom:6px"><div style="width:${Math.round(takenN * 100 / doses.length)}%"></div></div>
            <div class="small muted" style="margin-bottom:4px">${takenN} de ${doses.length} tomada${doses.length === 1 ? '' : 's'}${skippedN ? ` · ${skippedN} omitida${skippedN === 1 ? '' : 's'}` : ''}${takenN + skippedN ? ` · <a href="#/medicamentos" data-act="meds-today">Ver o modificar</a>` : ''}</div>
            ${pendingToday.length ? `<div class="list">${doseGroups(pendingToday, im)}</div>`
              : `<div class="empty" style="padding:18px 8px">${icon('check')}<div><b>¡Listo!</b> Registraste todas tus dosis de hoy.</div></div>`}`
            : emptyState('pill', 'No hay dosis programadas hoy', `<button class="btn ghost small" style="margin-top:10px" data-act="new-med">${icon('plus')} Agregar medicamento</button>`)}
        </div>`,
      citas: () => `<div class="card">
          <div class="card-head"><h3>${icon('calendar')} Próximas citas y exámenes</h3><a href="#/agenda" class="small">Agenda</a></div>
          ${upcoming.length ? `<div class="list">${upcoming.slice(0, 4).map(apptItem).join('')}</div>`
            : emptyState('calendar', 'Sin citas próximas', `<button class="btn ghost small" style="margin-top:10px" data-act="new-appt">${icon('plus')} Agendar</button>`)}
        </div>`,
      habitos: () => habitsCard(),
      tendencia: () => `<div class="card">
          <div class="card-head"><h3>${icon('activity')} Tendencia (14 días)</h3><a href="#/reportes" class="small">Reporte completo</a></div>
          <div data-chart="home"></div>
        </div>`
    };
    W.ahora = () => nowCard();
    const shown = homeLayout().filter(w => w.on);
    const due = doses.filter(d => at(today(), d.time) <= new Date());
    const dueTaken = due.filter(d => im.get(d.key)?.status === 'taken').length;
    const status = !doses.length ? '' : !due.length ? `Hoy tienes ${doses.length} dosis programada${doses.length === 1 ? '' : 's'}.`
      : dueTaken === due.length ? `Vas muy bien hoy: ${takenN} de ${doses.length} dosis ✅` : `Llevas ${takenN} de ${doses.length} dosis de hoy.`;
    if (state.loading) return homeSkeleton(greet);
    return `
    <div class="stack-v">
      <div><div class="muted">${cap(fmtLong(today()))}</div><h2 style="font-size:1.5rem">${greet}${s.name ? ', ' + esc(s.name.split(' ')[0]) : ''} 👋</h2>
        ${status ? `<div class="greet-status">${status}</div>` : ''}</div>
      ${banners.join('')}
      <div class="home-grid">${shown.map(w => `<section class="hw${HOME_WIDGETS[w.id].wide ? ' wide' : ''}" data-w="${w.id}">${W[w.id]()}</section>`).join('')}</div>
      ${shown.length ? '' : `<div class="card">${emptyState('grid', 'Ocultaste todas las secciones de Inicio.')}</div>`}
      <div style="text-align:center"><button class="btn ghost small" data-act="home-layout">${icon('grid')} Personalizar inicio</button></div>
    </div>`;
  }

  // Dosis pendientes agrupadas por hora; con 2 o más a la misma hora, botón "Tomar todas"
  function doseGroups(list, im) {
    const now = new Date(), groups = new Map();
    for (const d of list) { if (!groups.has(d.time)) groups.set(d.time, []); groups.get(d.time).push(d); }
    return [...groups.entries()].map(([t, ds]) => {
      const soon = at(today(), t) <= new Date(now.getTime() + 30 * 60000);
      return (ds.length > 1 && soon ? `<div class="dose-group"><span>${t} · ${ds.length} medicamentos</span><button class="btn small" data-act="dose-all" data-keys="${ds.map(d => d.key).join(',')}">${icon('check')} Tomar todas</button></div>` : '')
        + ds.map(d => doseItem(d, im)).join('');
    }).join('');
  }
  async function markDoses(keys, status = 'taken') {
    const before = medsDayOk(today());
    for (const k of keys) await MS.markTaken(k, status);
    await load(); render();
    toast(`${keys.length} dosis marcada${keys.length === 1 ? '' : 's'} como ${status === 'taken' ? 'tomadas' : 'omitidas'}`, 'check', {
      label: 'Deshacer', fn: async () => { for (const k of keys) await DB.del('intakes', k); await load(); render(); }
    });
    celebrateDoses(before);
  }
  function celebrateDoses(before) {
    if (before !== true && medsDayOk(today()) === true && dosesForDate(state.meds, today()).every(d => intakeMap().get(d.key)?.status === 'taken'))
      setTimeout(() => { toast('🎉 ¡Tomaste todas tus dosis de hoy!'); haptic([15, 60, 15]); }, 900);
  }
  // "Ahora": solo lo que toca en este momento, con su acción
  function nowCard() {
    const now = new Date(), d = today(), im = intakeMap(), lines = [];
    const doses = dosesForDate(state.meds, d);
    const due = doses.filter(x => !im.has(x.key) && at(d, x.time) <= new Date(now.getTime() + 15 * 60000));
    if (due.length) {
      lines.push({ ic: 'pill', color: 'var(--warn)', html: `<b>${due.length} dosis por tomar</b><div class="small muted">${[...new Set(due.map(x => x.time))].join(', ')} · ${esc(due.slice(0, 3).map(x => x.med.name).join(', '))}${due.length > 3 ? '…' : ''}</div>`,
        btn: due.length > 1 ? `<button class="btn small" data-act="dose-all" data-keys="${due.map(x => x.key).join(',')}">Tomar todas</button>` : `<button class="btn small" data-act="dose" data-key="${due[0].key}">Tomada</button>` });
    } else {
      const next = doses.filter(x => !im.has(x.key) && at(d, x.time) > now)[0];
      if (next) {
        const mins = Math.round((at(d, next.time) - now) / 60000);
        lines.push({ ic: 'clock', color: 'var(--primary)', html: `<b>Próxima dosis: ${next.time}</b><div class="small muted">${esc(next.med.name)} · en ${mins < 60 ? mins + ' min' : Math.round(mins / 60) + ' h'}</div>` });
      }
    }
    if (state.settings.notifyBP !== false) {
      const passed = (state.settings.bpTimes || []).filter(t => at(d, t) <= now);
      const last = passed[passed.length - 1];
      if (last) {
        const since = timeKey(new Date(at(d, last).getTime() - 60 * 60000));
        const done = state.vitals.some(v => v.date === d && v.sys && v.time >= since);
        if (!done) lines.push({ ic: 'heart', color: 'var(--sys)', html: `<b>Toca medir tu presión</b><div class="small muted">Programada a las ${last}</div>`, btn: `<button class="btn small" data-act="new-vital">Registrar</button>` });
      }
    }
    if (state.water.length || state.settings.waterMin) {
      const { min } = waterGoal(), tot = waterSum(d);
      if (tot < min) lines.push({ ic: 'droplet', color: '#0ea5e9', html: `<b>Agua: ${liters(tot)} de ${liters(min)}</b><div class="small muted">Te faltan ${liters(min - tot)}</div>`, btn: `<button class="btn ghost small" data-act="water-add" data-ml="250">+250 ml</button>` });
    }
    const appt = state.appts.find(a => !a.done && (a.date === d || a.date === addDays(d, 1)) && (a.date + 'T' + (a.time || '23:59')) >= d + 'T' + timeKey(now));
    if (appt) lines.push({ ic: (APPT_TYPES[appt.type] || APPT_TYPES.otro).icon, color: 'var(--warn)', html: `<b>${appt.date === d ? 'Hoy' : 'Mañana'}${appt.time ? ' ' + appt.time : ''}: ${esc(appt.title)}</b>${appt.place ? `<div class="small muted">${esc(appt.place)}</div>` : ''}` });
    return `<div class="card now-card">
      <div class="card-head"><h3>${icon('clock')} Ahora</h3><span class="small muted">${timeKey(now)}</span></div>
      ${lines.length ? `<div class="list">${lines.map(l => `<div class="item"><div class="item-ic" style="background:color-mix(in srgb, ${l.color} 15%, transparent);color:${l.color}">${icon(l.ic)}</div>
        <div class="item-body">${l.html}</div>${l.btn || ''}</div>`).join('')}</div>`
        : `<div class="now-ok">${icon('check')}<div><b>Todo al día</b><div class="small muted">No tienes nada pendiente en este momento.</div></div></div>`}
    </div>`;
  }
  // Mientras llegan los datos de la nube en un dispositivo nuevo
  function homeSkeleton(greet) {
    const box = h => `<div class="card skel" style="height:${h}px"></div>`;
    return `<div class="stack-v"><div><div class="muted">${cap(fmtLong(today()))}</div><h2 style="font-size:1.5rem">${greet} 👋</h2>
      <div class="greet-status">Cargando tus datos…</div></div>${box(150)}${box(190)}<div class="grid cols-2">${box(220)}${box(220)}</div></div>`;
  }

  // Plegar secciones de Inicio (se recuerda en Ajustes)
  function bindCollapse(view) {
    const folded = new Set(state.settings.homeCollapsed || []);
    for (const hw of $$('.hw', view)) {
      const head = $('.card-head', hw);
      if (!head || hw.dataset.w === 'ahora') continue;
      hw.classList.toggle('folded', folded.has(hw.dataset.w));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'icon-btn fold-btn';
      b.setAttribute('aria-label', 'Plegar o desplegar'); b.innerHTML = icon('down');
      b.onclick = async e => {
        e.stopPropagation();
        const on = hw.classList.toggle('folded');
        const list = new Set(state.settings.homeCollapsed || []);
        on ? list.add(hw.dataset.w) : list.delete(hw.dataset.w);
        state.settings.homeCollapsed = [...list];
        await saveSettings();
      };
      head.appendChild(b);
    }
  }

  // Deslizar una dosis: derecha = tomada, izquierda = omitir
  function bindSwipes(view) {
    for (const el of $$('.item.dose', view)) {
      if (el.classList.contains('taken') || el.classList.contains('skipped')) continue;
      const key = $('[data-key]', el)?.dataset.key;
      if (!key) continue;
      let x0 = 0, y0 = 0, dx = 0, active = false, locked = false;
      el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; active = true; locked = false; }, { passive: true });
      el.addEventListener('touchmove', e => {
        if (!active) return;
        const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
        if (!locked) { if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { active = false; return; } if (Math.abs(mx) > 10) locked = true; else return; }
        dx = Math.max(-140, Math.min(140, mx));
        el.style.transform = `translateX(${dx}px)`;
        el.classList.toggle('sw-right', dx > 30); el.classList.toggle('sw-left', dx < -30);
        el.classList.toggle('sw-ready', Math.abs(dx) > 90);
      }, { passive: true });
      const end = () => {
        if (!active) return;
        active = false;
        const go = Math.abs(dx) > 90 ? (dx > 0 ? 'taken' : 'skipped') : null;
        el.style.transition = 'transform .2s'; el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; el.classList.remove('sw-right', 'sw-left', 'sw-ready'); }, 200);
        if (go) { haptic(); markDose(key, go); }
      };
      el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    }
  }

  // Botón "+": registro rápido desde cualquier pantalla
  function quickMenu() {
    const route = parseHash().route;
    const im = intakeMap(), now = new Date();
    const due = dosesForDate(state.meds, today()).filter(x => !im.has(x.key) && at(today(), x.time) <= new Date(now.getTime() + 60 * 60000));
    const items = [
      ['vital', 'heart', 'var(--sys)', 'Presión', 'Registrar toma'],
      ['dose', 'pill', 'var(--primary)', 'Dosis', due.length ? `${due.length} por tomar` : 'Marcar tomada'],
      ['water', 'droplet', '#0ea5e9', 'Agua', '+250 ml'],
      ['water-more', 'droplet', '#0284c7', 'Agua', 'Otra cantidad'],
      ['coffee', 'coffee', 'var(--pulse)', 'Café', '+1 taza'],
      ['salt', 'alert', 'var(--warn)', 'Comida salada', '+1'],
      ['appt', 'calendar', 'var(--warn)', 'Cita', 'Agendar'],
      ['med', 'pill', 'var(--ok)', 'Medicamento', 'Agregar nuevo'],
      ['lab', 'flask', 'var(--pulse)', 'Análisis', 'Resultados'],
      ['question', 'chat', 'var(--primary)', 'Pregunta', 'Para el médico']
    ];
    const first = { signos: 'vital', medicamentos: 'med', agenda: 'appt', analisis: 'lab', habitos: 'coffee', resumen: 'question' }[route.id];
    if (first) items.sort((a, b) => (b[0] === first) - (a[0] === first));
    modal({
      title: 'Registro rápido', submit: 'Cerrar', cancel: null,
      body: `<div class="quick-grid">${items.map(([k, ic, color, l, sub]) => `<button type="button" class="quick-item" data-q="${k}">
          <span class="quick-ic" style="background:color-mix(in srgb, ${color} 15%, transparent);color:${color}">${icon(ic)}</span><b>${l}</b><small>${sub}</small></button>`).join('')}</div>`,
      onOpen: f => f.addEventListener('click', e => {
        const b = e.target.closest('[data-q]');
        if (!b) return;
        $('#modal').close();
        const k = b.dataset.q;
        setTimeout(() => ({
          vital: () => vitalForm(), dose: () => doseSheet(), water: () => addWater(250), 'water-more': () => actions['water-custom'](),
          coffee: () => addHabit('coffee', 1), salt: () => addHabit('salt', 1), appt: () => apptForm(null, today()),
          med: () => medForm(), lab: () => labChooser(), question: () => questionForm()
        })[k](), 0);
      }),
      onSubmit: () => {}
    });
  }
  // Dosis de hoy para marcar desde cualquier pantalla
  function doseSheet() {
    const im = intakeMap(), now = new Date();
    const list = dosesForDate(state.meds, today()).filter(x => !im.has(x.key));
    const due = list.filter(x => at(today(), x.time) <= new Date(now.getTime() + 60 * 60000));
    modal({
      title: 'Marcar dosis', submit: 'Cerrar', cancel: null,
      body: list.length ? `${due.length > 1 ? `<button type="button" class="btn block" data-all>${icon('check')} Tomar las ${due.length} de ahora</button>` : ''}
        <div class="list">${list.map(d => `<div class="item"><div class="item-body"><div class="item-title row" style="gap:6px;flex-wrap:nowrap">${SOLID.includes(d.med.form) || (d.med.look && d.med.look.color) ? pillSVG(d.med.look, d.med.form, 18) : ''}${esc(d.med.name)}</div>
          <div class="item-sub">${d.time}${doseLabel(d.med) ? ' · ' + esc(doseLabel(d.med)) : ''}${at(today(), d.time) < now ? ' · <span style="color:var(--warn)">Pendiente</span>' : ''}</div></div>
          <button type="button" class="icon-btn" data-k="${d.key}" data-s="skipped" aria-label="Omitir">${icon('skip')}</button>
          <button type="button" class="btn small" data-k="${d.key}" data-s="taken">${icon('check')} Tomada</button></div>`).join('')}</div>`
        : `<div class="empty">${icon('check')}<div>No tienes dosis pendientes hoy.</div></div>`,
      onOpen: f => f.addEventListener('click', e => {
        const b = e.target.closest('[data-k]'), all = e.target.closest('[data-all]');
        if (!b && !all) return;
        $('#modal').close();
        if (all) markDoses(due.map(d => d.key)); else markDose(b.dataset.k, b.dataset.s);
      }),
      onSubmit: () => {}
    });
  }
  function questionForm() {
    modal({
      title: 'Pregunta para el médico',
      body: `<label class="field"><span>¿Qué quieres preguntar en tu próxima consulta?</span><textarea name="q" rows="3" maxlength="200" required placeholder="Ej. ¿Puedo tomar ibuprofeno?"></textarea></label>`,
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        state.settings.questions = (state.settings.questions || []).concat({ id: uid(), text: f.q.value.trim(), created: today() });
        await saveSettings(); render(); toast('Pregunta guardada en Resumen', 'check');
      }
    });
  }

  // Secciones de Inicio: el orden y cuáles se muestran se guardan en Ajustes (se sincroniza)
  const HOME_WIDGETS = {
    ahora: { label: 'Ahora (lo que toca en este momento)', icon: 'clock' },
    presion: { label: 'Última presión', icon: 'heart' },
    resumen: { label: 'Resumen (promedios, dosis y próxima cita)', icon: 'trend' },
    agua: { label: 'Agua de hoy', icon: 'droplet' },
    medicamentos: { label: 'Medicamentos de hoy', icon: 'pill' },
    citas: { label: 'Próximas citas y exámenes', icon: 'calendar' },
    tendencia: { label: 'Tendencia de presión (14 días)', icon: 'activity', wide: true },
    habitos: { label: 'Hábitos de hoy (sal, café y rachas)', icon: 'flame' }
  };
  function homeLayout() {
    const order = (state.settings.homeOrder || []).filter(id => HOME_WIDGETS[id]);
    for (const id of Object.keys(HOME_WIDGETS)) if (!order.includes(id)) id === 'ahora' ? order.unshift(id) : order.push(id); // nuevas al final ("Ahora" arriba)
    const hidden = new Set(state.settings.homeHidden || []);
    return order.map(id => ({ id, on: !hidden.has(id) }));
  }
  function homeLayoutForm() {
    const row = w => `<div class="lay-row" data-id="${w.id}">
        <label class="check" style="flex:1;min-width:0"><input type="checkbox" ${w.on ? 'checked' : ''}> ${icon(HOME_WIDGETS[w.id].icon)} <span>${HOME_WIDGETS[w.id].label}</span></label>
        <button type="button" class="icon-btn" data-move="-1" aria-label="Subir">${icon('up')}</button>
        <button type="button" class="icon-btn" data-move="1" aria-label="Bajar">${icon('down')}</button>
      </div>`;
    modal({
      title: 'Personalizar inicio',
      body: `<p class="small muted" style="margin-top:0">Marca las secciones que quieres ver y ordénalas con las flechas.</p>
        <div class="lay-list">${homeLayout().map(row).join('')}</div>
        <button type="button" class="btn ghost small" data-reset style="margin-top:10px">Restablecer orden original</button>`,
      onOpen: f => {
        f.addEventListener('click', e => {
          const mv = e.target.closest('[data-move]');
          if (mv) {
            const r = mv.closest('.lay-row');
            if (mv.dataset.move === '-1' && r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling);
            if (mv.dataset.move === '1' && r.nextElementSibling) r.parentNode.insertBefore(r.nextElementSibling, r);
            mv.focus();
          }
          if (e.target.closest('[data-reset]')) {
            const list = $('.lay-list', f);
            for (const id of Object.keys(HOME_WIDGETS)) { const r = $(`.lay-row[data-id="${id}"]`, list); list.appendChild(r); $('input', r).checked = true; }
          }
        });
      },
      onSubmit: async f => {
        const rows = $$('.lay-row', f);
        state.settings.homeOrder = rows.map(r => r.dataset.id);
        state.settings.homeHidden = rows.filter(r => !$('input', r).checked).map(r => r.dataset.id);
        await saveSettings(); render(); toast('Inicio actualizado', 'check');
      }
    });
  }
  routeById('inicio').after = () => drawBPChart($('[data-chart="home"]'), state.vitals.filter(v => v.date > addDays(today(), -14)), 220);

  function drawBPChart(el, vitals, height) {
    if (!el) return;
    const bp = vitals.filter(v => v.sys && v.dia);
    const pul = vitals.filter(v => v.pulse);
    const series = [
      { name: 'Sistólica', color: 'var(--sys)', points: bp.map(v => ({ x: vitalTime(v), y: v.sys, id: v.id })) },
      { name: 'Diastólica', color: 'var(--dia)', points: bp.map(v => ({ x: vitalTime(v), y: v.dia, id: v.id })) },
      { name: 'Pulso', color: 'var(--pulse)', dashed: true, points: pul.map(v => ({ x: vitalTime(v), y: v.pulse, id: v.id })) }
    ];
    const g = state.settings.bpGoal, all = bp.map(vitalTime);
    if (g && all.length) {
      const x0 = new Date(Math.min(...all)), x1 = new Date(Math.max(...all));
      series.push({ name: `Meta ${g.sys}/${g.dia}`, color: 'var(--ok)', dashed: true, noDots: true, points: [{ x: x0, y: g.sys }, { x: x1, y: g.sys }] });
      series.push({ name: '', color: 'var(--ok)', dashed: true, noDots: true, noLegend: true, points: [{ x: x0, y: g.dia }, { x: x1, y: g.dia }] });
    }
    el.innerHTML = Charts.lineChart({
      width: el.clientWidth, height, label: 'Presión arterial y pulso',
      bands: bp.length ? [{ from: 90, to: 120, color: 'var(--bp-normal)' }] : [], series
    });
    el.onclick = e => {
      const c = e.target.closest('[data-id]');
      if (!c) return;
      const v = state.vitals.find(x => x.id === c.dataset.id);
      if (v) vitalPopover(v, e.clientX, e.clientY);
    };
  }
  // Detalle de una toma al tocar la gráfica o el calendario
  function vitalPopover(v, x, y, list) {
    $$('.pop').forEach(p => p.remove());
    const items = list || [v];
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.innerHTML = `<div class="pop-head"><b>${cap(fmtDate(items[0].date, { weekday: 'long', day: 'numeric', month: 'short' }))}</b><button class="icon-btn" data-pop-close aria-label="Cerrar">${icon('x')}</button></div>
      ${items.map(it => { const c = bpCategory(it.sys, it.dia); return `<div class="pop-row"><div><span class="bp-val">${it.sys ? it.sys + '/' + it.dia : '—'}</span> <span class="small muted">${it.time}${it.pulse ? ' · ' + it.pulse + ' lpm' : ''}</span>
        <div>${catChip(c)}${(it.tags || []).map(t => ` <span class="chip tag">${tagLabel(t)}</span>`).join('')}</div>${it.notes ? `<div class="small muted">${esc(it.notes)}</div>` : ''}</div>
        <button class="btn ghost small" data-pop-edit="${it.id}">${icon('edit')}</button></div>`; }).join('')}`;
    document.body.appendChild(pop);
    const r = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px';
    pop.style.top = (y + r.height + 16 > innerHeight ? Math.max(8, y - r.height - 12) : y + 12) + 'px';
    pop.addEventListener('click', e => {
      if (e.target.closest('[data-pop-close]')) pop.remove();
      const ed = e.target.closest('[data-pop-edit]');
      if (ed) { pop.remove(); vitalForm(state.vitals.find(z => z.id === ed.dataset.popEdit)); }
    });
    setTimeout(() => document.addEventListener('click', function off(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', off); } }), 0);
  }
  // Porcentaje de tomas dentro de la meta personal
  function goalStat(list) {
    const g = state.settings.bpGoal;
    const bp = list.filter(v => v.sys && v.dia);
    if (!g || !bp.length) return '';
    const ok = bp.filter(v => v.sys < g.sys && v.dia < g.dia).length, pct = Math.round(ok * 100 / bp.length);
    return `<div class="goal-stat"><div class="progress" style="flex:1"><div style="width:${pct}%;background:var(--ok)"></div></div><span class="small"><b>${pct}%</b> de tus tomas por debajo de ${g.sys}/${g.dia}</span></div>`;
  }
  function bpGoalForm() {
    const g = state.settings.bpGoal || {};
    modal({
      title: 'Mi meta de presión',
      body: `<p class="small muted" style="margin-top:0">La que te indique tu médico. Para muchas personas con hipertensión es menos de 130/80.</p>
        <div class="fields"><label class="field"><span>Sistólica menor a</span><input type="number" name="sys" inputmode="numeric" min="90" max="200" value="${g.sys || 130}" required></label>
        <label class="field"><span>Diastólica menor a</span><input type="number" name="dia" inputmode="numeric" min="50" max="120" value="${g.dia || 80}" required></label></div>
        ${state.settings.bpGoal ? '<button type="button" class="btn ghost small" data-clear>Quitar meta</button>' : ''}`,
      onOpen: f => { const c = $('[data-clear]', f); if (c) c.onclick = async () => { delete state.settings.bpGoal; await saveSettings(); $('#modal').close(); render(); }; },
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        state.settings.bpGoal = { sys: +f.sys.value, dia: +f.dia.value };
        await saveSettings(); render(); toast('Meta guardada', 'check');
      }
    });
  }
  // Calendario de las últimas 5 semanas: color de la categoría promedio de cada día
  function calendarCard() {
    const end = today(), d0 = at(addDays(end, -34));
    const start = addDays(dateKey(d0), -((d0.getDay() + 6) % 7)); // desde lunes
    const cells = [];
    for (let ds = start; ds <= end; ds = addDays(ds, 1)) {
      const day = state.vitals.filter(v => v.date === ds && v.sys && v.dia);
      const c = day.length ? bpCategory(avg(day.map(v => v.sys)), avg(day.map(v => v.dia))) : null;
      cells.push(`<button type="button" class="cal-day ${c ? 'has' : ''} ${ds === end ? 'today' : ''}" ${day.length ? `data-cal="${ds}"` : 'disabled'} style="${c ? `background:color-mix(in srgb, ${c.color} 75%, transparent);` : ''}" title="${esc(fmtDate(ds))}${c ? ': ' + c.label : ''}">${at(ds).getDate()}</button>`);
    }
    const legend = [['var(--bp-normal)', 'Normal'], ['var(--bp-elev)', 'Elevada'], ['var(--bp-h1)', 'HTA 1'], ['var(--bp-h2)', 'HTA 2'], ['var(--bp-low)', 'Baja']];
    return `<div class="card"><div class="card-head"><h3>${icon('calendar')} Calendario</h3><span class="small muted">5 semanas</span></div>
      <div class="cal-heat">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span class="cal-dow">${x}</span>`).join('')}${cells.join('')}</div>
      <div class="legend" style="margin-top:8px">${legend.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>`;
  }

  // ======================================================
  //  AGUA (seguimiento personal; no aparece en los reportes)
  // ======================================================
  const waterGoal = () => {
    const min = +state.settings.waterMin || 2500, max = Math.max(+state.settings.waterMax || 3000, min);
    return { min, max };
  };
  const waterOn = date => state.water.filter(w => w.date === date);
  const waterSum = date => waterOn(date).reduce((t, w) => t + (+w.ml || 0), 0);
  const liters = ml => (ml / 1000).toLocaleString('es', { minimumFractionDigits: ml % 1000 ? 1 : 0, maximumFractionDigits: 2 }) + ' L';

  function waterCard() {
    const { min, max } = waterGoal();
    const d = today(), total = waterSum(d), list = waterOn(d);
    const scale = Math.max(max, total);
    const pct = Math.min(100, total * 100 / scale);
    const status = total >= max ? `🎉 Llegaste a ${liters(max)}. ¡Excelente!`
      : total >= min ? `✅ Meta cumplida · puedes llegar hasta ${liters(max)}`
      : `Te faltan ${liters(min - total)} para tu meta`;
    // Últimos 7 días
    const days = Array.from({ length: 7 }, (_, i) => addDays(d, i - 6));
    const top = Math.max(max, ...days.map(waterSum));
    const bars = days.map(x => {
      const v = waterSum(x), h = Math.round(v * 100 / top);
      const c = v >= min ? 'var(--ok)' : v ? 'var(--primary-2)' : 'var(--surface-2)';
      return `<div class="wbar" title="${esc(fmtDate(x, { weekday: 'long', day: 'numeric' }))}: ${liters(v)}">
        <div class="wbar-track"><div style="height:${Math.max(h, v ? 4 : 0)}%;background:${c}"></div><i style="bottom:${min * 100 / top}%"></i></div>
        <span>${cap(fmtDate(x, { weekday: 'narrow' }))}</span></div>`;
    }).join('');
    return `<div class="card water-card">
      <div class="card-head"><h3>${icon('droplet')} Agua de hoy</h3>
        <button class="icon-btn" data-act="water-goal" title="Meta y recordatorios" aria-label="Meta y recordatorios">${icon('settings')}</button></div>
      <div class="water-top">
        <div><div class="water-total num">${liters(total)}</div>
          <div class="small muted">Meta ${liters(min)} – ${liters(max)}</div></div>
        <div class="water-week" aria-label="Últimos 7 días">${bars}</div>
      </div>
      <div class="progress water-progress"><div style="width:${pct}%"></div><i style="left:${min * 100 / scale}%"></i></div>
      <div class="small" style="margin:6px 0 12px;color:${total >= min ? 'var(--ok)' : 'var(--muted)'}">${status}</div>
      <div class="water-btns">
        <button class="btn ghost" data-act="water-add" data-ml="250">+250 ml</button>
        <button class="btn ghost" data-act="water-add" data-ml="500">+500 ml</button>
        <button class="btn ghost" data-act="water-add" data-ml="1000">+1 L</button>
        <button class="btn ghost" data-act="water-custom">Otra</button>
      </div>
      ${list.length ? `<details class="water-log"><summary class="small muted">${list.length} registro${list.length === 1 ? '' : 's'} hoy · toca uno para quitarlo</summary>
        <div class="row" style="gap:6px;margin-top:8px">${list.slice().reverse().map(w => `<button class="chip water-chip" data-act="water-del" data-id="${w.id}" title="Quitar">${w.at.slice(11, 16)} · ${w.ml} ml ${icon('x')}</button>`).join('')}</div></details>` : ''}
    </div>`;
  }

  async function addWater(ml) {
    ml = Math.round(+ml);
    if (!(ml > 0 && ml <= 5000)) return;
    const rec = { id: uid(), date: today(), at: today() + 'T' + timeKey(new Date()), ml };
    const before = waterSum(today());
    await DB.put('water', rec);
    if (before < waterGoal().min && before + ml >= waterGoal().min) setTimeout(() => { toast('🎉 ¡Cumpliste tu meta de agua de hoy!'); haptic([15, 60, 15]); }, 900);
    await load(); render();
    toast(`+${ml} ml · llevas ${liters(waterSum(today()))}`, 'droplet', {
      label: 'Deshacer', fn: async () => { await DB.del('water', rec.id); await load(); render(); }
    });
  }

  function waterGoalForm() {
    const { min, max } = waterGoal(), s = state.settings;
    const every = +s.waterEvery || 120;
    modal({
      title: 'Agua: meta y recordatorios',
      body: `<div class="form-section">Meta diaria</div>
        <div class="fields">
          <label class="field"><span>Mínimo (litros)</span><input type="number" name="min" inputmode="decimal" min="0.5" max="6" step="0.1" value="${min / 1000}" required></label>
          <label class="field"><span>Máximo (litros)</span><input type="number" name="max" inputmode="decimal" min="0.5" max="6" step="0.1" value="${max / 1000}" required></label>
        </div>
        <div class="form-section">Recordatorios</div>
        <label class="check"><input type="checkbox" name="on" ${s.notifyWater !== false ? 'checked' : ''}> Recordarme tomar agua</label>
        <label class="field"><span>Cada</span><select name="every">${[[60, '1 hora'], [90, '1 h 30 min'], [120, '2 horas'], [180, '3 horas']].map(([v, l]) => `<option value="${v}" ${every === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="fields">
          <label class="field"><span>Desde</span><input type="time" name="from" value="${esc(s.waterFrom || '09:00')}" required></label>
          <label class="field"><span>Hasta</span><input type="time" name="to" value="${esc(s.waterTo || '21:00')}" required></label>
        </div>
        <p class="small muted" style="margin:0">El aviso se salta si registraste agua hace poco y se detiene al cumplir tu meta. Desde la notificación puedes tocar <b>💧 +250 ml</b> para registrarlo sin abrir la app.<br>El agua es solo para ti: no aparece en los reportes.</p>`,
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        const a = Math.round(+f.min.value * 1000), b = Math.round(+f.max.value * 1000);
        if (!(b >= a)) { toast('El máximo debe ser mayor o igual al mínimo'); return false; }
        if (f.to.value <= f.from.value) { toast('La hora final debe ser después de la inicial'); return false; }
        Object.assign(state.settings, { waterMin: a, waterMax: b, notifyWater: f.on.checked, waterEvery: +f.every.value, waterFrom: f.from.value, waterTo: f.to.value });
        await saveSettings(); render(); toast('Guardado', 'check');
        schedulePushSync(500);
      }
    });
  }

  // ======================================================
  //  HÁBITOS (seguimiento personal; no aparecen en los reportes)
  // ======================================================
  const habitGoals = () => {
    const s = state.settings;
    return { salt: s.saltMax != null ? +s.saltMax : 1, coffee: s.coffeeMax != null ? +s.coffeeMax : 2 };
  };
  const habitsOn = (date, type) => state.habits.filter(h => h.date === date && h.type === type);
  const habitSum = (date, type) => habitsOn(date, type).reduce((t, h) => t + (+h.value || 0), 0);
  const lastDays = n => Array.from({ length: n }, (_, i) => addDays(today(), i - n + 1));

  // Rachas: test(ds) → true (cumplido), false (no cumplido) o null (sin datos ese día: no cuenta ni rompe)
  function streakInfo(test) {
    let best = 0, run = 0;
    for (const ds of lastDays(365)) {
      const r = test(ds);
      if (r === true) { run++; best = Math.max(best, run); } else if (r === false && ds !== today()) run = 0;
    }
    let cur = 0;
    for (let i = 0; i < 365; i++) {
      const r = test(addDays(today(), -i));
      if (r === true) cur++; else if (r === false) { if (i === 0) continue; break; }
    }
    return { cur, best };
  }
  function medsDayOk(ds) {
    const now = new Date(), im = intakeMap();
    const due = dosesForDate(state.meds, ds).filter(d => at(ds, d.time) <= now);
    if (!due.length) return null;
    return due.every(d => im.get(d.key)?.status === 'taken');
  }
  function waterDayOk(ds) {
    const first = state.water[0];
    if (!first || ds < first.date) return null;
    const sum = waterSum(ds);
    return ds === today() && sum < waterGoal().min ? null : sum >= waterGoal().min;
  }
  const streakTxt = n => `${n} día${n === 1 ? '' : 's'}`;

  function habitsCard() {
    const g = habitGoals(), d = today();
    const salt = habitSum(d, 'salt'), coffee = habitSum(d, 'coffee');
    const sm = streakInfo(medsDayOk), sw = state.water.length ? streakInfo(waterDayOk) : null;
    return `<div class="card">
      <div class="card-head"><h3>${icon('flame')} Hábitos de hoy</h3><a href="#/habitos" class="small">Ver más</a></div>
      <div class="streaks">
        ${state.meds.length ? `<div class="streak"><span class="flame ${sm.cur ? 'on' : ''}">${icon('flame')}</span><div><b>${streakTxt(sm.cur)}</b><div class="small muted">con todas tus dosis</div></div></div>` : ''}
        ${sw ? `<div class="streak"><span class="flame ${sw.cur ? 'on' : ''}">${icon('droplet')}</span><div><b>${streakTxt(sw.cur)}</b><div class="small muted">con tu meta de agua</div></div></div>` : ''}
      </div>
      ${habitCounter('salt', salt, g)}
      ${habitCounter('coffee', coffee, g)}
    </div>`;
  }
  const HABIT_DEF = {
    salt: { label: 'Comidas saladas', icon: 'alert', unit: '', step: 1, hint: 'Embutidos, enlatados, botanas, sopas instantáneas…' },
    coffee: { label: 'Café', icon: 'coffee', unit: 'taza', step: 1 }
  };
  function habitCounter(type, v, g) {
    const D = HABIT_DEF[type];
    const over = type === 'salt' ? v > g.salt : type === 'coffee' ? v > g.coffee : false;
    const sub = `${v} de máx. ${type === 'salt' ? g.salt : g.coffee} ${type === 'coffee' ? (g.coffee === 1 ? 'taza' : 'tazas') : ''}`;
    return `<div class="habit-row">
      <div class="item-ic" style="background:${over ? 'var(--danger-soft)' : 'var(--surface-2)'};color:${over ? 'var(--danger)' : 'inherit'}">${icon(D.icon)}</div>
      <div class="item-body"><div class="item-title" style="font-weight:500">${D.label}</div><div class="small" style="color:${over ? 'var(--danger)' : 'var(--muted)'}">${sub}</div></div>
      <button class="icon-btn" data-act="habit-minus" data-type="${type}" aria-label="Quitar" ${v ? '' : 'disabled'}>${icon('x')}</button>
      <button class="btn ghost small" data-act="habit-add" data-type="${type}" data-v="${D.step}">+${D.step}</button>
    </div>`;
  }
  async function addHabit(type, value) {
    value = +value;
    if (!(value > 0)) return;
    const rec = { id: uid(), date: today(), at: today() + 'T' + timeKey(new Date()), type, value };
    await DB.put('habits', rec);
    await load(); render();
    const msg = type === 'salt' ? 'Comida salada registrada' : 'Café registrado';
    toast(msg, 'check', { label: 'Deshacer', fn: async () => { await DB.del('habits', rec.id); await load(); render(); } });
  }
  async function removeLastHabit(type) {
    const list = habitsOn(today(), type);
    const last = list[list.length - 1];
    if (!last) return;
    await DB.del('habits', last.id); await load(); render();
  }

  function renderHabits() {
    const g = habitGoals(), d = today();
    const days = lastDays(7);
    const sm = streakInfo(medsDayOk), sw = state.water.length ? streakInfo(waterDayOk) : null;
    const dots = (type, max) => days.map(x => { const v = habitSum(x, type); return `<div class="hdot ${v > max ? 'bad' : v ? 'ok' : ''}" title="${esc(fmtDate(x))}: ${v}"><span>${v}</span><small>${cap(fmtDate(x, { weekday: 'narrow' }))}</small></div>`; }).join('');
    return `
    <div class="stack-v">
      <div class="row between"><p class="small muted" style="margin:0">Solo para ti: estos datos no aparecen en los reportes.</p>
        <button class="btn ghost small" data-act="habit-goals">${icon('settings')} Metas</button></div>
      <div class="grid cols-2" style="align-items:start">
        <div class="card">
          <div class="card-head"><h3>${icon('coffee')} Sal y café</h3></div>
          ${habitCounter('salt', habitSum(d, 'salt'), g)}
          <div class="small muted" style="margin:-2px 0 8px 52px">${HABIT_DEF.salt.hint}</div>
          <div class="hdots">${dots('salt', g.salt)}</div>
          <div style="height:12px"></div>
          ${habitCounter('coffee', habitSum(d, 'coffee'), g)}
          <div class="hdots">${dots('coffee', g.coffee)}</div>
          <p class="small muted" style="margin:10px 0 0">La sal y el café pueden subir tu presión. En <b>Signos</b> puedes marcarlos al medirte para ver cuánto te afectan.</p>
        </div>

        <div class="card">
          <div class="card-head"><h3>${icon('flame')} Rachas</h3></div>
          ${state.meds.length ? `<div class="streak big"><span class="flame ${sm.cur ? 'on' : ''}">${icon('flame')}</span><div><b>${streakTxt(sm.cur)} seguidos</b><div class="small muted">tomando todas tus dosis · récord: ${streakTxt(sm.best)}</div></div></div>` : ''}
          ${sw ? `<div class="streak big"><span class="flame ${sw.cur ? 'on' : ''}">${icon('droplet')}</span><div><b>${streakTxt(sw.cur)} seguidos</b><div class="small muted">cumpliendo tu meta de agua · récord: ${streakTxt(sw.best)}</div></div></div>` : ''}
          ${!state.meds.length && !sw ? '<div class="small muted">Registra tus dosis y tu agua para empezar una racha.</div>' : ''}
          <p class="small muted" style="margin:10px 0 0">Un día cuenta cuando registras todas tus dosis como tomadas (o llegas a tu meta de agua).</p>
        </div>
      </div>
    </div>`;
  }
  function habitGoalsForm() {
    const g = habitGoals();
    modal({
      title: 'Metas de hábitos',
      body: `<div class="fields">
          <label class="field"><span>Comidas saladas (máx/día)</span><input type="number" name="salt" inputmode="numeric" min="0" max="10" value="${g.salt}" required></label>
          <label class="field"><span>Tazas de café (máx/día)</span><input type="number" name="coffee" inputmode="numeric" min="0" max="10" value="${g.coffee}" required></label>
        </div>
        <p class="small muted" style="margin:0">Ajusta los límites con tu médico.</p>`,
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        Object.assign(state.settings, { saltMax: +f.salt.value, coffeeMax: +f.coffee.value });
        await saveSettings(); render(); toast('Metas guardadas', 'check');
      }
    });
  }

  // ======================================================
  //  RESUMEN (semana y próxima consulta)
  // ======================================================
  function periodStats(from, to) {
    const vit = state.vitals.filter(v => v.date >= from && v.date <= to);
    const bp = vit.filter(v => v.sys && v.dia);
    const ad = state.meds.length ? adherence(from, to) : null;
    const days = []; for (let ds = from; ds <= to; ds = addDays(ds, 1)) days.push(ds);
    const sum = type => days.reduce((t, x) => t + habitSum(x, type), 0);
    return {
      n: bp.length, sys: avg(bp.map(v => v.sys)), dia: avg(bp.map(v => v.dia)),
      max: bp.slice().sort((a, b) => b.sys - a.sys)[0] || null,
      urgent: bp.filter(isUrgentBP).length, parts: dayParts(vit), ad,
      waterOk: state.water.length ? days.filter(x => x <= today() && waterSum(x) >= waterGoal().min).length : null,
      days: days.filter(x => x <= today()).length,
      salt: sum('salt'), coffee: sum('coffee')
    };
  }
  const lastConsult = () => state.appts.filter(a => a.type === 'consulta' && (a.done || a.date < today())).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const nextConsult = () => state.appts.filter(a => a.type === 'consulta' && !a.done && a.date >= today())[0] || null;
  const summarySince = () => { const lc = lastConsult(); return lc ? lc.date : addDays(today(), -30); };

  function summaryText(kind) {
    const s = state.settings, lines = [];
    if (kind === 'week') {
      const w = periodStats(addDays(today(), -6), today());
      lines.push(`Mi semana en Latidia (${fmtDate(addDays(today(), -6), { day: 'numeric', month: 'short' })} – ${fmtDate(today(), { day: 'numeric', month: 'short' })})`);
      if (w.n) lines.push(`• Presión promedio: ${w.sys}/${w.dia} mmHg (${w.n} tomas)`);
      if (w.ad && w.ad.scheduled) lines.push(`• Dosis tomadas: ${w.ad.pct}% (${w.ad.taken}/${w.ad.scheduled})`);
      if (w.waterOk != null) lines.push(`• Meta de agua: ${w.waterOk} de ${w.days} días`);
      return lines.join('\n');
    }
    const from = summarySince(), w = periodStats(from, today()), nc = nextConsult();
    lines.push(`Resumen para mi consulta${s.name ? ' — ' + s.name : ''}`);
    lines.push(`Periodo: ${fmtDate(from, { day: 'numeric', month: 'long' })} al ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`);
    if (w.n) {
      lines.push(`\nPresión arterial: promedio ${w.sys}/${w.dia} mmHg en ${w.n} tomas`);
      for (const p of w.parts) if (p.n) lines.push(`  ${p.label}: ${p.sys}/${p.dia} (${p.n})`);
      if (w.max) lines.push(`  Más alta: ${w.max.sys}/${w.max.dia} el ${fmtDate(w.max.date, { day: 'numeric', month: 'short' })}`);
      if (w.urgent) lines.push(`  ${w.urgent} toma${w.urgent === 1 ? '' : 's'} de 180/110 o más`);
    }
    if (w.ad && w.ad.per.length) {
      lines.push(`\nMedicamentos (${w.ad.pct}% de dosis tomadas):`);
      for (const p of w.ad.per) lines.push(`  ${p.med.name} ${doseLabel(p.med)}: ${Math.round(p.taken * 100 / p.scheduled)}%`);
    }
    const ch = medChanges(from);
    if (ch.length) { lines.push('\nCambios en medicamentos:'); for (const c of ch) lines.push(`  ${c.text}`); }
    const labs = state.labs.filter(l => l.date >= from);
    for (const l of labs) {
      const out = (l.items || []).filter(it => ['high', 'low'].includes(labFlag(it)));
      lines.push(`\nAnálisis ${fmtDate(l.date, { day: 'numeric', month: 'short' })}: ${out.length ? out.map(it => `${it.name} ${it.value} (${LAB_FLAG[labFlag(it)].label.toLowerCase()})`).join(', ') : 'valores dentro de referencia'}`);
    }
    const qs = (s.questions || []).filter(q => !q.done);
    if (qs.length) { lines.push('\nPreguntas para el médico:'); qs.forEach((q, i) => lines.push(`  ${i + 1}. ${q.text}`)); }
    if (nc) lines.push(`\nPróxima consulta: ${fmtDate(nc.date, { weekday: 'long', day: 'numeric', month: 'long' })}${nc.time ? ' ' + nc.time : ''}`);
    return lines.join('\n');
  }
  function medChanges(from) {
    const out = [];
    for (const m of state.meds) {
      if (m.created && m.created >= from) out.push({ date: m.created, text: `Nuevo: ${m.name} ${doseLabel(m)} (${fmtDate(m.created, { day: 'numeric', month: 'short' })})` });
      for (const h of m.history || []) if (h.date >= from) out.push({ date: h.date, text: `${m.name}: ${h.from} → ${h.to} (${fmtDate(h.date, { day: 'numeric', month: 'short' })})` });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  async function shareText(title, text) {
    if (navigator.share && isMobile()) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('Copiado: pégalo en WhatsApp o correo', 'check'); }
    catch (_) { download(title.replace(/\s+/g, '-') + '.txt', text, 'text/plain'); }
  }

  function renderSummary() {
    const d = today();
    const w = periodStats(addDays(d, -6), d), pw = periodStats(addDays(d, -13), addDays(d, -7));
    const from = summarySince(), c = periodStats(from, d);
    const lc = lastConsult(), nc = nextConsult();
    const qs = state.settings.questions || [];
    const sm = state.meds.length ? streakInfo(medsDayOk) : null;
    const diff = w.n && pw.n ? w.sys - pw.sys : null;
    const tile = (ic, color, label, value, sub) => `<div class="card stat">${statIc(ic, color)}<div style="min-width:0"><div class="label">${label}</div><div class="value num">${value}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div></div>`;
    const ch = medChanges(from);
    const labs = state.labs.filter(l => l.date >= from);
    const history = state.appts.filter(a => a.type === 'consulta' && a.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    return `
    <div class="stack-v">
      <div class="card">
        <div class="card-head"><h3>${icon('calendar')} Esta semana</h3><button class="btn ghost small" data-act="share-week">${icon('upload')} Compartir</button></div>
        <div class="grid stats">
          ${tile('heart', 'var(--sys)', 'Presión promedio', w.n ? `${w.sys}/${w.dia}` : '—', diff == null ? `${w.n} tomas` : `<span style="color:${diff > 2 ? 'var(--danger)' : diff < -2 ? 'var(--ok)' : 'inherit'}">${diff > 0 ? '▲' : diff < 0 ? '▼' : '='} ${Math.abs(diff)} vs. semana anterior</span>`)}
          ${w.ad && w.ad.scheduled ? tile('pill', 'var(--primary)', 'Dosis tomadas', w.ad.pct + '%', `${w.ad.taken} de ${w.ad.scheduled}`) : ''}
          ${w.waterOk != null ? tile('droplet', '#0ea5e9', 'Meta de agua', `${w.waterOk}/${w.days}`, 'días cumplidos') : ''}
          ${tile('coffee', 'var(--pulse)', 'Café / sal', `${(w.coffee / w.days).toFixed(1).replace('.', ',')} / ${(w.salt / w.days).toFixed(1).replace('.', ',')}`, 'promedio al día')}
          ${sm ? tile('flame', '#f97316', 'Racha de dosis', streakTxt(sm.cur), `récord ${streakTxt(sm.best)}`) : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('stethoscope')} Para tu próxima consulta</h3>
          <div class="row" style="gap:6px"><button class="btn ghost small" data-act="summary-pdf">${icon('file')} PDF</button><button class="btn small" data-act="share-consult">${icon('upload')} Compartir</button></div></div>
        <div class="small muted" style="margin:-6px 0 12px">Desde ${lc ? `tu última consulta (${fmtDate(from, { day: 'numeric', month: 'long' })})` : `hace 30 días (${fmtDate(from, { day: 'numeric', month: 'long' })})`}${nc ? ` · próxima: <b>${relDay(nc.date)}${nc.time ? ' ' + nc.time : ''}</b>` : ''}</div>
        ${lc && lc.outcome ? `<div class="banner" style="margin-bottom:12px">${icon('chat')}<div class="item-body small"><b>Lo que te indicó el médico la última vez:</b><br>${esc(lc.outcome)}</div></div>` : ''}
        <div class="grid cols-2">
          <div>
            <h4 class="sum-h">Presión arterial</h4>
            ${c.n ? `<div class="small">Promedio <b>${c.sys}/${c.dia}</b> en ${c.n} tomas ${catChip(bpCategory(c.sys, c.dia))}</div>
              <div class="small muted">${c.parts.filter(p => p.n).map(p => `${p.label}: ${p.sys}/${p.dia}`).join(' · ')}</div>
              ${c.max ? `<div class="small muted">Más alta: ${c.max.sys}/${c.max.dia} (${fmtDate(c.max.date, { day: 'numeric', month: 'short' })})</div>` : ''}
              ${c.urgent ? `<div class="small" style="color:var(--danger)">${c.urgent} toma${c.urgent === 1 ? '' : 's'} de 180/110 o más</div>` : ''}` : '<div class="small muted">Sin tomas en este periodo.</div>'}
            <h4 class="sum-h">Medicamentos</h4>
            ${c.ad && c.ad.per.length ? `<div class="small">Tomaste el <b>${c.ad.pct}%</b> de tus dosis${c.ad.scheduled - c.ad.taken ? ` · ${c.ad.scheduled - c.ad.taken} sin tomar` : ''}</div>
              ${c.ad.per.map(p => `<div class="small muted">${esc(p.med.name)}: ${Math.round(p.taken * 100 / p.scheduled)}%</div>`).join('')}` : '<div class="small muted">Sin dosis en este periodo.</div>'}
            ${ch.length ? `<h4 class="sum-h">Cambios en medicamentos</h4>${ch.map(x => `<div class="small muted">${esc(x.text)}</div>`).join('')}` : ''}
            ${labs.length ? `<h4 class="sum-h">Análisis</h4>${labs.map(l => { const out = (l.items || []).filter(it => ['high', 'low'].includes(labFlag(it))); return `<div class="small muted">${fmtDate(l.date, { day: 'numeric', month: 'short' })}: ${out.length ? out.map(it => esc(it.name) + ' ' + esc(it.value)).join(', ') + ' fuera de rango' : 'todo en rango'}</div>`; }).join('')}` : ''}
          </div>
          <div>
            <h4 class="sum-h">Preguntas para el médico</h4>
            <form class="q-add" data-q-form><input name="q" placeholder="Ej. ¿Puedo tomar ibuprofeno?" maxlength="200" autocomplete="off"><button class="btn small" aria-label="Agregar pregunta">${icon('plus')}</button></form>
            ${qs.filter(q => !q.done).length ? `<div class="list">${qs.filter(q => !q.done).map(q => `<div class="item" style="padding:8px 0">
                <button class="dose-btn" data-act="q-done" data-id="${q.id}" aria-label="Marcar como resuelta" style="width:30px;height:30px">${icon('check')}</button>
                <div class="item-body small">${esc(q.text)}</div>
                <button class="icon-btn" data-act="q-del" data-id="${q.id}" aria-label="Eliminar">${icon('trash')}</button></div>`).join('')}</div>`
              : '<div class="small muted">Anota aquí lo que quieras preguntar; se incluye al compartir el resumen.</div>'}
            ${qs.filter(q => q.done).length ? `<details style="margin-top:8px"><summary class="small muted">${qs.filter(q => q.done).length} resueltas</summary>
              ${qs.filter(q => q.done).slice(-10).reverse().map(q => `<div class="small muted" style="text-decoration:line-through;margin-top:4px">${esc(q.text)} <button class="link-btn small" data-act="q-del" data-id="${q.id}">Quitar</button></div>`).join('')}</details>` : ''}
          </div>
        </div>
      </div>

      ${history.length ? `<div class="card"><div class="card-head"><h3>${icon('list')} Historial de consultas</h3></div>
        <div class="list">${history.map(a => `<div class="item"><div class="item-ic" style="background:var(--primary-soft);color:var(--primary)">${icon('stethoscope')}</div>
          <div class="item-body"><div class="item-title">${esc(a.title)}</div><div class="item-sub">${cap(fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }))}${a.doctor ? ' · ' + esc(a.doctor) : ''}</div>
          ${a.outcome ? `<div class="item-sub outcome">${icon('chat')} ${esc(a.outcome)}</div>` : ''}</div>
          <button class="icon-btn" data-act="appt-outcome" data-id="${a.id}" aria-label="Editar indicaciones">${icon('edit')}</button></div>`).join('')}</div></div>` : ''}
    </div>`;
  }
  function summaryAfter() {
    const f = $('[data-q-form]');
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const text = f.q.value.trim();
      if (!text) return;
      state.settings.questions = (state.settings.questions || []).concat({ id: uid(), text, created: today() });
      await saveSettings(); render();
      setTimeout(() => { const i = $('[data-q-form] input'); if (i) i.focus(); }, 50);
    };
  }

  // ======================================================
  //  GUÍA DE BIENVENIDA (primer uso)
  // ======================================================
  function onboarding(step) {
    const steps = [
      { title: 'Bienvenido a Latidia', body: `<div class="ob-hero">${icon('heart')}</div>
          <p>Tu presión, tus medicamentos y tus citas en un solo lugar.</p>
          <ul class="ob-list"><li>${icon('heart')} Registra tu presión y ve cómo va</li><li>${icon('pill')} Recordatorios de cada dosis</li>
          <li>${icon('calendar')} Citas y análisis con aviso</li><li>${icon('report')} Reportes en PDF para tu médico</li></ul>` },
      { title: 'Recordatorios', body: `<div class="ob-hero">${icon('bell')}</div>
          <p>Latidia te avisa a la hora de cada dosis, para medir tu presión y antes de tus citas, aunque la app esté cerrada.</p>
          ${isIOS() && !isStandalone() ? '<p class="small muted">En iPhone primero agrégala a la pantalla de inicio: botón <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>.</p>' : ''}
          ${typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? `<button type="button" class="btn block" data-ob-notif>${icon('bell')} Activar notificaciones</button>` : `<div class="now-ok">${icon('check')}<b>Notificaciones activadas</b></div>`}` },
      { title: '¿Por dónde empiezas?', body: `<div class="quick-grid">
          <button type="button" class="quick-item" data-ob="med"><span class="quick-ic" style="background:var(--primary-soft);color:var(--primary)">${icon('pill')}</span><b>Agregar un medicamento</b><small>Con la biblioteca</small></button>
          <button type="button" class="quick-item" data-ob="vital"><span class="quick-ic" style="background:color-mix(in srgb, var(--sys) 15%, transparent);color:var(--sys)">${icon('heart')}</span><b>Registrar mi presión</b><small>2 o 3 lecturas</small></button>
          <button type="button" class="quick-item" data-ob="data"><span class="quick-ic" style="background:var(--surface-2)">${icon('user')}</span><b>Mis datos</b><small>Para los reportes</small></button>
          <button type="button" class="quick-item" data-ob="done"><span class="quick-ic" style="background:color-mix(in srgb, var(--ok) 15%, transparent);color:var(--ok)">${icon('check')}</span><b>Explorar</b><small>Lo haré después</small></button></div>
          <p class="small muted" style="margin:0">Tip: el botón <b>+</b> abre el registro rápido desde cualquier pantalla.</p>` }
    ];
    const st = steps[step];
    const finish = async () => { if (!state.settings.onboarded) { state.settings.onboarded = true; await saveSettings(); } };
    modal({
      title: st.title, submit: step < steps.length - 1 ? 'Siguiente' : 'Listo', cancel: step ? 'Atrás' : 'Saltar',
      body: `<div class="ob">${st.body}<div class="ob-dots">${steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div></div>`,
      onOpen: f => {
        const cancel = $('.modal-foot [data-close]', f);
        if (cancel && step) cancel.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); $('#modal').close(); setTimeout(() => onboarding(step - 1), 0); }, true);
        else if (cancel) cancel.addEventListener('click', finish);
        f.addEventListener('click', async e => {
          if (e.target.closest('[data-ob-notif]')) { await enableNotifications(); $('#modal').close(); setTimeout(() => onboarding(step), 0); }
          const b = e.target.closest('[data-ob]');
          if (!b) return;
          await finish(); $('#modal').close();
          setTimeout(() => ({ med: () => medForm(), vital: () => vitalForm(), data: () => fichaForm(), done: () => {} })[b.dataset.ob](), 0);
        });
      },
      onSubmit: async () => {
        if (step < steps.length - 1) { setTimeout(() => onboarding(step + 1), 0); return; }
        await finish();
      }
    });
  }

  // ======================================================
  //  SIGNOS VITALES
  // ======================================================
  function renderVitals() {
    const r = state.vitalsRange;
    const list = r ? state.vitals.filter(v => v.date > addDays(today(), -r)) : state.vitals;
    const seg = [[7, '7 días'], [30, '30 días'], [90, '3 meses'], [0, 'Todo']]
      .map(([v, l]) => `<button data-act="vrange" data-v="${v}" class="${r === v ? 'active' : ''}">${l}</button>`).join('');
    return `
    <div class="stack-v">
      <div class="row between"><div class="seg">${seg}</div>
        <button class="btn hide-mobile" data-act="new-vital">${icon('plus')} Nuevo registro</button></div>
      <div class="card"><div class="card-head"><h3>${icon('activity')} Presión y pulso</h3>
          <button class="btn ghost small" data-act="bp-goal">${icon('settings')} ${state.settings.bpGoal ? `Meta ${state.settings.bpGoal.sys}/${state.settings.bpGoal.dia}` : 'Mi meta'}</button></div>
        ${goalStat(list)}
        <div data-chart="vitals"></div>
        <div class="small muted">Toca un punto para ver el detalle. Franja verde: sistólica normal (90–120)${state.settings.bpGoal ? '; líneas punteadas: tu meta' : ''}.</div></div>
      ${calendarCard()}
      <div class="grid cols-2">${dayPartCard(list)}${triggersCard(list)}</div>
      <div class="card">
        <div class="card-head"><h3>${icon('list')} Registros <span class="chip">${list.length}</span></h3></div>
        ${list.length ? `<div class="list">${list.map(vitalItem).join('')}</div>` : emptyState('heart', 'No hay registros en este periodo', `<button class="btn ghost small" style="margin-top:10px" data-act="new-vital">${icon('plus')} Registrar toma</button>`)}
      </div>
    </div>`;
  }
  routeById('signos').after = () => {
    const r = state.vitalsRange;
    drawBPChart($('[data-chart="vitals"]'), r ? state.vitals.filter(v => v.date > addDays(today(), -r)) : state.vitals, 260);
    const cal = $('.cal-heat');
    if (cal) cal.onclick = e => {
      const b = e.target.closest('[data-cal]');
      if (!b) return;
      const day = state.vitals.filter(v => v.date === b.dataset.cal).sort((a, c) => a.time.localeCompare(c.time));
      const rc = b.getBoundingClientRect();
      vitalPopover(day[0], rc.left + rc.width / 2, rc.bottom, day);
    };
  };

  // Mañana / tarde / noche: ayuda al médico a decidir a qué hora conviene cada medicamento
  const DAY_PARTS = [['Mañana', '05:00', '12:00', 'sun'], ['Tarde', '12:00', '18:00', 'sun'], ['Noche', '18:00', '05:00', 'moon']];
  const inPart = (t, a, b) => a < b ? t >= a && t < b : t >= a || t < b;
  function dayParts(list) {
    return DAY_PARTS.map(([label, a, b, ic]) => {
      const bp = list.filter(v => v.sys && v.dia && inPart(v.time, a, b));
      return { label, ic, n: bp.length, sys: avg(bp.map(v => v.sys)), dia: avg(bp.map(v => v.dia)) };
    });
  }
  function dayPartCard(list) {
    const parts = dayParts(list);
    const m = parts[0], n = parts[2];
    let note = 'Mide tu presión en la mañana y en la noche para comparar.';
    if (m.n >= 2 && n.n >= 2) {
      const d = n.sys - m.sys;
      note = Math.abs(d) < 5 ? 'Tu presión es parecida en la mañana y en la noche.'
        : `En la ${d > 0 ? 'noche' : 'mañana'} tu sistólica es <b>${Math.abs(d)} mmHg más alta</b>. Coméntalo con tu médico: puede ayudar a ajustar el horario de tus medicamentos.`;
    }
    return `<div class="card"><div class="card-head"><h3>${icon('clock')} Mañana, tarde y noche</h3></div>
      <div class="dayparts">${parts.map(p => `<div class="daypart">${icon(p.ic)}<div class="small muted">${p.label}</div>
        <div class="bp-val">${p.n ? `${p.sys}/${p.dia}` : '—'}</div>${p.n ? catChip(bpCategory(p.sys, p.dia)) : ''}<div class="small muted">${p.n} toma${p.n === 1 ? '' : 's'}</div></div>`).join('')}</div>
      <p class="small muted" style="margin:10px 0 0">${note}</p></div>`;
  }

  // Contexto de cada toma y qué factores coinciden con presión más alta
  const VITAL_TAGS = [['cafe', '☕ Café'], ['estres', '😟 Estrés'], ['sal', '🧂 Comida salada'],
    ['dolor', '🤕 Dolor de cabeza'], ['sueno', '😴 Dormí mal'], ['sin_med', '💊 Sin medicamento'], ['alcohol', '🍺 Alcohol']];
  const tagLabel = id => (VITAL_TAGS.find(t => t[0] === id) || [id, id])[1];
  function triggersCard(list) {
    const bp = list.filter(v => v.sys && v.dia);
    const base = bp.filter(v => !(v.tags && v.tags.length));
    const rows = VITAL_TAGS.map(([id, label]) => {
      const w = bp.filter(v => (v.tags || []).includes(id));
      return { id, label, n: w.length, sys: avg(w.map(v => v.sys)), dia: avg(w.map(v => v.dia)) };
    }).filter(x => x.n);
    const bSys = avg(base.map(v => v.sys));
    let body;
    if (!rows.length) body = `<div class="small muted">Al registrar una toma marca qué pasó antes (café, estrés, comida salada…). Con varias tomas verás aquí qué te sube la presión.</div>`;
    else body = `<div class="list">${rows.sort((a, b) => b.sys - a.sys).map(x => {
      const d = base.length >= 2 && x.n >= 2 ? x.sys - bSys : null;
      return `<div class="item" style="padding:8px 0"><div class="item-body"><div class="item-title" style="font-weight:500">${x.label}</div>
        <div class="item-sub">${x.n} toma${x.n === 1 ? '' : 's'} · promedio ${x.sys}/${x.dia}</div></div>
        ${d == null ? '<span class="small muted">pocos datos</span>' : `<span class="chip" style="color:${d >= 5 ? 'var(--danger)' : d <= -5 ? 'var(--ok)' : 'var(--muted)'}">${d > 0 ? '+' : ''}${d} mmHg</span>`}</div>`;
    }).join('')}</div>
      <p class="small muted" style="margin:8px 0 0">Comparado con tus tomas sin ningún factor${base.length >= 2 ? ` (${bSys} de sistólica)` : ' (aún hay pocas)'}.</p>`;
    return `<div class="card"><div class="card-head"><h3>${icon('alert')} ¿Qué te sube la presión?</h3></div>${body}</div>`;
  }

  function vitalItem(v) {
    const c = bpCategory(v.sys, v.dia);
    const extras = [
      v.temp && `${icon('thermo')} ${v.temp} °C`, v.spo2 && `${icon('lungs')} ${v.spo2}%`,
      v.glucose && `${icon('droplet')} ${v.glucose} mg/dL`, v.weight && `${icon('scale')} ${v.weight} kg`
    ].filter(Boolean);
    return `<div class="item">
      <div class="bp-bar" style="background:${c ? c.color : 'var(--border)'}"></div>
      <div class="item-body">
        <div class="row" style="gap:8px 12px">
          ${v.sys ? `<span class="bp-val">${v.sys}/${v.dia} <span class="small muted">mmHg</span></span>` : ''}
          ${v.pulse ? `<span class="num"><b>${v.pulse}</b> <span class="small muted">lpm</span></span>` : ''}
          ${catChip(c)}
          ${v.readings && v.readings.length > 1 ? `<span class="chip">Promedio de ${v.readings.length}</span>` : ''}
        </div>
        <div class="item-sub row" style="gap:4px 12px">${relDay(v.date)} · ${v.time}
          ${extras.map(e => `<span class="row" style="gap:3px">${e.replace('class="ic ', 'style="width:14px;height:14px" class="ic ')}</span>`).join('')}
          ${v.arm || v.position ? `<span>${[v.arm, v.position].filter(Boolean).join(', ')}</span>` : ''}</div>
        ${v.tags && v.tags.length ? `<div class="row" style="gap:4px;margin-top:4px">${v.tags.map(t => `<span class="chip tag">${tagLabel(t)}</span>`).join('')}</div>` : ''}
        ${v.notes ? `<div class="item-sub">${esc(v.notes)}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="icon-btn" data-act="edit-vital" data-id="${v.id}" aria-label="Editar">${icon('edit')}</button>
        <button class="icon-btn danger" data-act="del-vital" data-id="${v.id}" aria-label="Eliminar">${icon('trash')}</button>
      </div></div>`;
  }

  function vitalForm(v) {
    const now = new Date();
    v = v || { date: dateKey(now), time: timeKey(now) };
    const reads = v.readings && v.readings.length ? v.readings : null;
    const r0 = reads ? reads[0] : v;
    const val = k => v[k] != null ? esc(v[k]) : '';
    const rv = (o, k) => o && o[k] != null ? esc(o[k]) : '';
    const readingRow = (o, i) => `<div class="reading-row"><span class="small muted">Lectura ${i}</span>
      <input type="number" inputmode="numeric" data-r="sys" min="50" max="300" placeholder="Sist." value="${rv(o, 'sys')}" aria-label="Sistólica lectura ${i}">
      <input type="number" inputmode="numeric" data-r="dia" min="30" max="200" placeholder="Diast." value="${rv(o, 'dia')}" aria-label="Diastólica lectura ${i}">
      <input type="number" inputmode="numeric" data-r="pulse" min="20" max="250" placeholder="Pulso" value="${rv(o, 'pulse')}" aria-label="Pulso lectura ${i}">
      <button type="button" class="icon-btn" data-rm-reading aria-label="Quitar lectura">${icon('x')}</button></div>`;
    const sel = (name, opts) => `<select name="${name}"><option value="">—</option>${opts.map(o => `<option ${v[name] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    modal({
      title: v.id ? 'Editar registro' : 'Nuevo registro',
      body: `
        <div class="fields"><label class="field"><span>Fecha</span><input type="date" name="date" value="${val('date')}" max="${today()}" required></label>
        <label class="field"><span>Hora</span><input type="time" name="time" value="${val('time')}" required></label></div>
        <div class="fields" style="grid-template-columns:repeat(3,1fr)">
          <label class="field"><span style="color:var(--sys)">Sistólica</span><input class="big" type="number" inputmode="numeric" name="sys" min="50" max="300" placeholder="120" value="${rv(r0, 'sys')}"></label>
          <label class="field"><span style="color:var(--dia)">Diastólica</span><input class="big" type="number" inputmode="numeric" name="dia" min="30" max="200" placeholder="80" value="${rv(r0, 'dia')}"></label>
          <label class="field"><span style="color:var(--pulse)">Pulso</span><input class="big" type="number" inputmode="numeric" name="pulse" min="20" max="250" placeholder="70" value="${rv(r0, 'pulse')}"></label>
        </div>
        <div id="moreReadings">${reads ? reads.slice(1).map((o, i) => readingRow(o, i + 2)).join('') : ''}</div>
        <button type="button" class="btn ghost small" data-add-reading>${icon('plus')} Otra lectura</button>
        <div class="small muted" style="margin-top:-4px">Recomendado: 2 o 3 lecturas con 1 minuto entre cada una. Se guarda el promedio.</div>
        <div id="bpPreview" style="min-height:24px"></div>
        <div class="field"><span>¿Qué pasó antes de medirte? (opcional)</span>
          <div class="tagpick">${VITAL_TAGS.map(([id, label]) => `<label><input type="checkbox" name="tags" value="${id}" ${(v.tags || []).includes(id) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></div>
        <details ${v.temp || v.spo2 || v.glucose || v.weight ? 'open' : ''}><summary class="small" style="cursor:pointer;font-weight:600">Otros signos vitales</summary>
          <div class="fields" style="margin-top:12px">
            <label class="field"><span>Temperatura °C</span><input type="number" step="0.1" inputmode="decimal" name="temp" min="30" max="45" value="${val('temp')}"></label>
            <label class="field"><span>SpO₂ %</span><input type="number" inputmode="numeric" name="spo2" min="50" max="100" value="${val('spo2')}"></label>
            <label class="field"><span>Glucosa mg/dL</span><input type="number" inputmode="numeric" name="glucose" min="20" max="700" value="${val('glucose')}"></label>
            <label class="field"><span>Peso kg</span><input type="number" step="0.1" inputmode="decimal" name="weight" min="1" max="400" value="${val('weight')}"></label>
          </div></details>
        <div class="fields"><label class="field"><span>Brazo</span>${sel('arm', ['Izquierdo', 'Derecho'])}</label>
          <label class="field"><span>Posición</span>${sel('position', ['Sentado', 'De pie', 'Acostado'])}</label></div>
        <label class="field"><span>Notas</span><textarea name="notes" placeholder="Ej. después de caminar, con dolor de cabeza…">${val('notes')}</textarea></label>`,
      onOpen: f => {
        const upd = () => {
          const all = readReadings(f);
          // Solo valores en rango para el promedio; los demás se señalan
          const ok = o => (o.sys == null || (o.sys >= 50 && o.sys <= 300)) && (o.dia == null || (o.dia >= 30 && o.dia <= 200)) && (o.pulse == null || (o.pulse >= 20 && o.pulse <= 250));
          const badIdx = all.map((o, i) => ok(o) ? 0 : i + 1).filter(Boolean);
          const rs = all.filter(ok), m = avgReadings(rs);
          const c = bpCategory(m.sys, m.dia);
          const bp = rs.filter(x => x.sys && x.dia);
          const spread = bp.length > 1 ? Math.max(Math.max(...bp.map(x => x.sys)) - Math.min(...bp.map(x => x.sys)), Math.max(...bp.map(x => x.dia)) - Math.min(...bp.map(x => x.dia))) : 0;
          $('#bpPreview').innerHTML = (bp.length > 1 ? `<span class="small"><b>Promedio:</b> ${m.sys}/${m.dia}${m.pulse ? ` · ${m.pulse} lpm` : ''}</span> ` : '') + (c ? catChip(c) : '')
            + (badIdx.length ? `<div class="small" style="color:var(--danger);margin-top:4px">Revisa la lectura ${badIdx.join(' y ')}: hay un valor fuera de rango.</div>` : '')
            + (spread > 10 ? `<div class="small" style="color:var(--warn);margin-top:4px">Hay más de 10 mmHg de diferencia entre lecturas. Descansa 1–2 minutos y mide otra vez.</div>` : '')
            + (isUrgentBP(m) ? ' <span class="small" style="color:var(--danger)">Presión muy alta: si tienes síntomas, busca atención médica de inmediato.</span>' : '');
        };
        const renumber = () => $$('.reading-row', f).forEach((r, i) => { $('.small', r).textContent = `Lectura ${i + 2}`; });
        f.addEventListener('click', e => {
          if (e.target.closest('[data-add-reading]')) {
            if ($$('.reading-row', f).length >= 4) return;
            $('#moreReadings').insertAdjacentHTML('beforeend', readingRow({}, $$('.reading-row', f).length + 2));
            $('#moreReadings .reading-row:last-child input').focus();
          }
          const rm = e.target.closest('[data-rm-reading]');
          if (rm) { rm.closest('.reading-row').remove(); renumber(); upd(); }
        });
        f.addEventListener('input', upd); upd();
        // Al completar un valor pasa solo al siguiente (como en un cajero)
        const done = (k, t) => {
          if (!/^\d+$/.test(t)) return false;
          if (k === 'sys') return t.length === 3 || (t.length === 2 && +t[0] >= 3);
          if (k === 'dia') return t.length === 3 || (t.length === 2 && +t[0] >= 3);
          return false;
        };
        f.addEventListener('input', e => {
          const i = e.target, k = i.name || i.dataset.r;
          if (!done(k, i.value)) return;
          const row = i.closest('.reading-row');
          const next = row ? $(`[data-r="${k === 'sys' ? 'dia' : 'pulse'}"]`, row) : f[k === 'sys' ? 'dia' : 'pulse'];
          if (next && !next.value) next.focus();
        });
        if (!v.id) f.sys.focus();
      },
      onSubmit: async f => {
        const rs = readReadings(f), m = avgReadings(rs);
        const bad = rs.find(x => (x.sys == null) !== (x.dia == null) || (x.sys != null && x.sys <= x.dia));
        if (bad) { toast(bad.sys != null && bad.dia != null ? 'La sistólica debe ser mayor que la diastólica' : 'Cada lectura necesita sistólica y diastólica'); return false; }
        const d = {
          id: v.id || uid(), date: f.date.value, time: f.time.value,
          sys: m.sys, dia: m.dia, pulse: m.pulse,
          readings: rs.length > 1 ? rs : null,
          tags: $$('input[name="tags"]:checked', f).map(i => i.value),
          temp: num(f.temp.value), spo2: num(f.spo2.value), glucose: num(f.glucose.value), weight: num(f.weight.value),
          arm: f.arm.value, position: f.position.value, notes: f.notes.value.trim()
        };
        if (!f.reportValidity()) return false;
        if ((d.sys == null) !== (d.dia == null)) { toast('Ingresa sistólica y diastólica'); return false; }
        if (d.sys != null && d.sys <= d.dia) { toast('La sistólica debe ser mayor que la diastólica'); return false; }
        if ([d.sys, d.pulse, d.temp, d.spo2, d.glucose, d.weight].every(x => x == null)) { toast('Ingresa al menos un valor'); return false; }
        if (!d.readings) delete d.readings;
        if (!d.tags.length) delete d.tags;
        await DB.put('vitals', d);
        await load(); render(); toast('Registro guardado', 'check');
        if (isUrgentBP(d) && d.date === today()) setTimeout(() => urgentBPAlert(d), 350);
      }
    });
  }

  // Lecturas del formulario: la principal + las adicionales (filas vacías se ignoran)
  function readReadings(f) {
    const out = [{ sys: num(f.sys.value), dia: num(f.dia.value), pulse: num(f.pulse.value) }];
    for (const r of $$('.reading-row', f)) {
      const o = {}; for (const i of $$('[data-r]', r)) o[i.dataset.r] = num(i.value);
      out.push(o);
    }
    return out.filter(o => o.sys != null || o.dia != null || o.pulse != null);
  }
  function avgReadings(rs) {
    const bp = rs.filter(o => o.sys && o.dia), p = rs.filter(o => o.pulse);
    return { sys: bp.length ? avg(bp.map(o => o.sys)) : null, dia: bp.length ? avg(bp.map(o => o.dia)) : null, pulse: p.length ? avg(p.map(o => o.pulse)) : null };
  }

  // Presión muy alta (≥180 o ≥110): qué hacer y a quién llamar
  const isUrgentBP = v => !!(v && v.sys && v.dia && (v.sys >= 180 || v.dia >= 110));
  function urgentBPAlert(v) {
    const s = state.settings;
    const tel = x => esc(String(x).replace(/[^\d+]/g, ''));
    modal({
      title: '⚠️ Presión muy alta', submit: 'Medir de nuevo', cancel: 'Cerrar',
      body: `<div class="urgent-bp"><div class="bp-val" style="font-size:2rem;color:var(--danger)">${v.sys}/${v.dia}</div><div class="small">mmHg</div></div>
        <ol class="small" style="padding-left:18px;margin:12px 0">
          <li>Siéntate, relájate y respira tranquilo <b>5 minutos</b>. Después mide otra vez.</li>
          <li>Si sigue igual de alta o tienes <b>dolor de pecho, falta de aire, dolor de cabeza muy fuerte, visión borrosa, debilidad u hormigueo en un lado del cuerpo, o dificultad para hablar</b>, llama al <b>911</b> o ve a urgencias.</li>
          <li>No tomes dosis extra de tus medicamentos sin indicación médica.</li>
        </ol>
        <div class="stack-v" style="gap:8px">
          <a class="btn danger block" href="tel:911">${icon('phone')} Llamar al 911</a>
          ${s.emPhone ? `<a class="btn outline block" href="tel:${tel(s.emPhone)}">${icon('phone')} Llamar a ${esc(s.emName || 'mi contacto de emergencia')}</a>` : ''}
          ${s.doctorPhone ? `<a class="btn outline block" href="tel:${tel(s.doctorPhone)}">${icon('phone')} Llamar a ${esc(s.doctor || 'mi médico')}</a>` : ''}
        </div>`,
      onSubmit: () => { setTimeout(() => vitalForm(), 0); }
    });
  }

  // ======================================================
  //  MEDICAMENTOS
  // ======================================================
  function doseItem(d, im) {
    const it = im.get(d.key), st = it?.status;
    const ds = d.key.split('|')[1];
    const past = at(ds, d.time) < new Date();
    const realAt = it && it.at ? new Date(it.at) : null;
    const realTxt = st === 'taken' && realAt && dateKey(realAt) === ds ? ' ' + timeKey(realAt) : '';
    return `<div class="item dose ${st || ''}">
      <button class="dose-btn ${st || ''}" data-act="dose" data-key="${d.key}" aria-label="${st ? 'Editar toma' : 'Marcar como tomada'}" title="${st ? 'Editar toma' : 'Marcar como tomada'}">${icon(st === 'skipped' ? 'skip' : 'check')}</button>
      <div class="item-body"><div class="item-title row" style="gap:6px;flex-wrap:nowrap">${SOLID.includes(d.med.form) || (d.med.look && d.med.look.color) ? pillSVG(d.med.look, d.med.form, 18) : ''}<span style="overflow:hidden;text-overflow:ellipsis">${esc(d.med.name)}</span></div>
        <div class="item-sub">${d.time}${doseLabel(d.med) ? ' · ' + esc(doseLabel(d.med)) : ''}${st === 'taken' ? ` · <span style="color:var(--ok)">Tomada${realTxt}</span>` : st === 'skipped' ? ' · Omitida' : past ? ' · <span style="color:var(--warn)">Pendiente</span>' : ''}</div>
        ${it && it.note ? `<div class="item-sub">${esc(it.note)}</div>` : ''}</div>
      ${st ? `<button class="icon-btn" data-act="dose" data-key="${d.key}" title="Editar toma" aria-label="Editar toma">${icon('edit')}</button>`
        : `<button class="icon-btn" data-act="dose-skip" data-key="${d.key}" title="Omitir" aria-label="Omitir">${icon('skip')}</button>`}
    </div>`;
  }

  // Registrar una dosis; aviso con "Deshacer" por si fue un toque accidental
  async function markDose(key, status) {
    const before = medsDayOk(today());
    await MS.markTaken(key, status);
    await load(); render();
    const [medId, , t] = key.split('|');
    const med = state.meds.find(m => m.id === medId);
    toast(`${med ? med.name : 'Dosis'} ${t}: ${status === 'taken' ? 'tomada' : 'omitida'}`, status === 'taken' ? 'check' : 'skip', {
      label: 'Deshacer',
      fn: async () => { await DB.del('intakes', key); await load(); render(); }
    });
    if (status === 'taken') celebrateDoses(before);
  }

  // Editar una toma ya registrada (estado, hora real, nota o quitar registro)
  function intakeEditor(key) {
    const it = state.intakes.find(i => i.id === key);
    if (!it) return;
    const [medId, ds, t] = key.split('|');
    const med = state.meds.find(m => m.id === medId);
    const atD = it.at ? new Date(it.at) : at(ds, t);
    const realTime = dateKey(atD) === ds ? timeKey(atD) : t;
    modal({
      title: 'Editar toma',
      body: `
        <div class="item" style="padding:0;border:0">${medIc(med)}
          <div class="item-body"><div class="item-title">${esc(med ? med.name : 'Medicamento eliminado')}</div>
          <div class="item-sub">${[med && doseLabel(med), `programada ${relDay(ds).toLowerCase()} a las ${t}`].filter(Boolean).map(esc).join(' · ')}</div></div></div>
        <div class="field"><span>Estado</span>
          <div class="seg" style="width:100%"><button type="button" data-st="taken" class="${it.status === 'taken' ? 'active' : ''}" style="flex:1">${icon('check')} Tomada</button>
          <button type="button" data-st="skipped" class="${it.status === 'skipped' ? 'active' : ''}" style="flex:1">${icon('skip')} Omitida</button></div>
          <input type="hidden" name="status" value="${it.status}"></div>
        <label class="field" data-taken ${it.status === 'taken' ? '' : 'hidden'}><span>Hora en que la tomaste</span><input type="time" name="realTime" value="${realTime}"></label>
        <label class="field"><span>Nota (opcional)</span><input name="note" value="${esc(it.note)}" placeholder="Ej. con alimentos, la tomé tarde…"></label>
        <button type="button" class="btn ghost block" data-remove style="color:var(--danger)">${icon('trash')} Quitar registro (dejar sin marcar)</button>`,
      onOpen: f => {
        f.addEventListener('click', async e => {
          const b = e.target.closest('[data-st]');
          if (b) {
            f.status.value = b.dataset.st;
            $$('[data-st]', f).forEach(x => x.classList.toggle('active', x === b));
            $('[data-taken]', f).hidden = b.dataset.st !== 'taken';
          }
          const rm = e.target.closest('[data-remove]');
          if (rm) {
            if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.innerHTML = `${icon('alert')} Toca de nuevo para confirmar`; rm.classList.add('danger'); rm.style.color = '#fff'; return; }
            await DB.del('intakes', key);
            $('#modal').close();
            await load(); render(); toast('Registro quitado');
          }
        });
      },
      onSubmit: async f => {
        const status = f.status.value;
        const when = status === 'taken' && f.realTime.value ? at(ds, f.realTime.value) : new Date();
        await DB.put('intakes', Object.assign({}, it, { status, at: when.toISOString(), note: f.note.value.trim() }));
        await load(); render(); toast('Toma actualizada', 'check');
      }
    });
  }

  function adherence(from, to) {
    const im = intakeMap(), now = new Date();
    let scheduled = 0, taken = 0, skipped = 0;
    const per = new Map();
    for (let ds = from; ds <= to && ds <= today(); ds = addDays(ds, 1)) {
      for (const d of dosesForDate(state.meds, ds)) {
        if (at(ds, d.time) > now) continue;
        scheduled++;
        const p = per.get(d.med.id) || { med: d.med, scheduled: 0, taken: 0 };
        p.scheduled++;
        const st = im.get(d.key)?.status;
        if (st === 'taken') { taken++; p.taken++; } else if (st === 'skipped') skipped++;
        per.set(d.med.id, p);
      }
    }
    return { scheduled, taken, skipped, pct: scheduled ? Math.round(taken * 100 / scheduled) : null, per: [...per.values()] };
  }

  function renderMeds() {
    const ds = state.medDay, im = intakeMap();
    const doses = dosesForDate(state.meds, ds);
    const adDays = state.adRange || 7;
    const ad = adherence(addDays(today(), -(adDays - 1)), today());
    return `
    <div class="stack-v">
      <div class="grid cols-2">
        <div class="card">
          <div class="card-head">
            <button class="icon-btn" data-act="medday" data-v="-1" aria-label="Día anterior">${icon('left')}</button>
            <div style="text-align:center"><h3>${relDay(ds)}</h3><div class="small muted">${cap(fmtDate(ds, { day: 'numeric', month: 'long' }))}</div></div>
            <button class="icon-btn" data-act="medday" data-v="1" aria-label="Día siguiente">${icon('right')}</button>
          </div>
          ${doses.length ? `<div class="list">${doses.map(d => doseItem(d, im)).join('')}</div>` : emptyState('pill', 'Sin dosis programadas este día')}
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('trend')} Adherencia</h3>
            <div class="row" style="gap:8px"><div class="seg"><button data-act="adrange" data-v="7" class="${adDays === 7 ? 'active' : ''}">7 días</button><button data-act="adrange" data-v="30" class="${adDays === 30 ? 'active' : ''}">30 días</button></div>
            <span class="bp-val">${ad.pct == null ? '—' : ad.pct + '%'}</span></div></div>
          ${ad.scheduled ? `<div class="progress"><div style="width:${ad.pct}%"></div></div>
            <div class="small muted" style="margin:6px 0 12px">${ad.taken} tomadas · ${ad.skipped} omitidas · ${ad.scheduled - ad.taken - ad.skipped} sin marcar</div>
            <div class="list">${ad.per.map(p => `<div class="item"><div class="item-body"><div class="item-title">${esc(p.med.name)}</div>
              <div class="progress" style="margin-top:6px"><div style="width:${Math.round(p.taken * 100 / p.scheduled)}%"></div></div></div>
              <span class="num small" style="text-align:right">${Math.round(p.taken * 100 / p.scheduled)}%<br><span class="muted">${p.taken}/${p.scheduled}</span></span></div>`).join('')}</div>`
            : emptyState('trend', 'Aún no hay dosis para calcular')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${icon('pill')} Mis medicamentos</h3>
          <div class="row">${state.meds.length ? `<button class="btn outline small" data-act="meds-ics" title="Crea eventos repetitivos con alarma en el calendario de tu teléfono">${icon('calPlus')}<span class="hide-mobile">Añadir a calendario</span></button>` : ''}
          <button class="btn outline small" data-act="med-lib" title="Biblioteca de medicamentos">${icon('list')}<span>Biblioteca</span></button>
          <button class="btn small hide-mobile" data-act="new-med">${icon('plus')} Agregar</button></div></div>
        ${state.meds.length ? `<div class="list">${state.meds.map(m => `
          <div class="item" style="${m.active === false ? 'opacity:.55' : ''}">
            ${medIc(m)}
            <div class="item-body"><div class="item-title">${esc(m.name)} ${doseLabel(m) ? `<span class="muted" style="font-weight:400">· ${esc(doseLabel(m))}</span>` : ''}</div>
              <div class="item-sub">${esc(schedLabel(m))}${m.end ? ' · hasta ' + fmtDate(m.end, { day: 'numeric', month: 'short' }) : ''}${m.active === false ? ' · Pausado' : ''}</div>
              ${m.active !== false && MS.isInterval(m) ? (() => { const n = MS.nextDoses(m, new Date(), 1)[0]; return n ? `<div class="item-sub" style="color:var(--primary)">Próxima toma: ${relDay(n.date)} ${n.time}</div>` : ''; })() : ''}
              ${m.look && (m.look.color || m.look.brand || m.look.imprint) ? `<div class="item-sub">${esc(medLookText(m))}</div>` : ''}
              ${m.notes ? `<div class="item-sub">${esc(m.notes)}</div>` : ''}
              ${stockLine(m)}</div>
            <div class="item-actions">
              <button class="icon-btn" data-act="edit-med" data-id="${m.id}" aria-label="Editar">${icon('edit')}</button>
              <button class="icon-btn danger" data-act="del-med" data-id="${m.id}" aria-label="Eliminar">${icon('trash')}</button></div>
          </div>`).join('')}</div>`
          : emptyState('pill', 'No has agregado medicamentos', `<button class="btn ghost small" style="margin-top:10px" data-act="new-med">${icon('plus')} Agregar medicamento</button>`)}
      </div>
    </div>`;
  }

  // Concentración: número, o texto para combinaciones ("80/12.5")
  const parseStrength = v => { v = String(v || '').trim().replace(',', '.'); return !v ? null : /^\d+(\.\d+)?$/.test(v) ? +v : v; };
  function readLook(f) {
    const val = n => { const r = $(`input[name="${n}"]:checked`, f); return r ? r.value : ''; };
    const lk = { shape: f.form.value === 'capsula' ? 'capsula' : val('shape') || 'redonda', color: val('color'), color2: f.form.value === 'capsula' ? val('color2') : '',
      scored: f.form.value !== 'capsula' && f.scored.checked, imprint: f.imprint.value.trim(), brand: f.brand.value.trim() };
    for (const k of Object.keys(lk)) if (!lk[k]) delete lk[k];
    return lk;
  }
  const presLabel = p => `${(PRESENTATIONS[p.form] || { label: p.form }).label}${p.strength !== '' && p.strength != null ? ' ' + String(p.strength).replace(/\./g, ',') + ' ' + (p.unit || '') : ''}`.trim();
  const normTxt = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Mis medicamentos (con su apariencia) + biblioteca general
  function libEntries() {
    const mine = new Map();
    for (const m of state.meds) {
      const k = normTxt(m.name);
      const e = mine.get(k) || { name: m.name, group: 'Mis medicamentos', mine: true, pres: [] };
      if (m.form || m.strength) e.pres.push({ form: m.form, strength: m.strength ?? '', unit: m.unit, look: m.look });
      mine.set(k, e);
    }
    return [...mine.values(), ...(window.MED_LIBRARY || [])];
  }
  function libSearch(q, limit) {
    const t = normTxt(q).trim();
    if (!t) return [];
    const all = libEntries();
    const starts = all.filter(e => normTxt(e.name).startsWith(t));
    const has = all.filter(e => !starts.includes(e) && normTxt(e.name).includes(t));
    return [...starts, ...has].slice(0, limit || 50);
  }
  // Lista agrupada (Mis medicamentos, Presión arterial…) con botones data-sug
  function libListHTML(list, grouped) {
    if (!list.length) return `<div class="small muted" style="padding:10px">No está en la biblioteca: escribe el nombre tal cual.</div>`;
    let last = null;
    return list.map((e, i) => {
      const head = grouped && e.group !== last ? `<div class="lib-group">${esc(e.group)}</div>` : '';
      last = e.group;
      const p0 = e.pres[0];
      return `${head}<button type="button" class="lib-item" data-sug="${i}"><span class="lib-ic">${p0 && p0.look && p0.look.color ? pillSVG(p0.look, p0.form, 22) : icon(FORM_ICON[p0 && p0.form] || 'pill')}</span>
        <span class="item-body"><b>${esc(e.name)}</b><small>${esc(e.mine ? 'Mis medicamentos' + (e.pres.length ? ' · ' + e.pres.map(presLabel).join(' · ') : '') : e.pres.map(presLabel).join(' · '))}</small></span></button>`;
    }).join('');
  }
  // Ventana de biblioteca (desde Medicamentos): al elegir abre el formulario ya llenado
  function medLibrary() {
    let cur = libEntries();
    modal({
      title: 'Biblioteca de medicamentos', submit: 'Cerrar', cancel: null,
      body: `<input type="search" name="q" placeholder="Buscar medicamento…" autocomplete="off">
        <div class="lib-list" id="libList">${libListHTML(cur, true)}</div>
        <p class="small muted" style="margin:0">Referencia general de presentaciones comunes en México. Confirma siempre la dosis con tu receta.</p>`,
      onOpen: f => {
        f.q.addEventListener('input', () => { cur = f.q.value.trim() ? libSearch(f.q.value, 80) : libEntries(); $('#libList').innerHTML = libListHTML(cur, true); });
        f.q.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        f.addEventListener('click', e => {
          const b = e.target.closest('[data-sug]');
          if (!b) return;
          const entry = cur[+b.dataset.sug];
          $('#modal').close();
          setTimeout(() => medForm({ name: entry.name, libEntry: entry }), 0);
        });
      },
      onSubmit: () => {}
    });
  }

  // Inventario en la lista de medicamentos
  const unitWord = (m, n) => { const P = PRESENTATIONS[m.form]; return P ? (n === 1 ? P.u1 : P.u2) : 'unidades'; };
  function stockLine(m) {
    const st = MS.medStock(m, state.intakes);
    if (!st) return m.active !== false ? `<button class="link-btn small" data-act="med-refill" data-id="${m.id}">${icon('plus')} Registrar cuántas tienes</button>` : '';
    const color = st.low ? 'var(--danger)' : 'var(--muted)';
    return `<div class="item-sub row" style="gap:8px;color:${color}">${st.low ? icon('alert') : ''}Quedan ${String(st.left).replace('.', ',')} ${unitWord(m, st.left)}${st.days != null ? ` · ~${st.days} día${st.days === 1 ? '' : 's'}` : ''}
      <button class="link-btn small" data-act="med-refill" data-id="${m.id}">Resurtí</button></div>`;
  }
  const lowStockMeds = () => state.meds.filter(m => m.active !== false && (!m.end || m.end >= today())).map(m => ({ m, st: MS.medStock(m, state.intakes) })).filter(x => x.st && x.st.low);
  function refillForm(m) {
    const st = MS.medStock(m, state.intakes);
    modal({
      title: st ? `Resurtir ${m.name}` : `¿Cuántas ${unitWord(m, 2)} tienes?`,
      body: `${st ? `<p class="small muted" style="margin-top:0">Te quedan ${String(st.left).replace('.', ',')} ${unitWord(m, st.left)}.</p>` : ''}
        <label class="field"><span>${st ? `${cap(unitWord(m, 2))} que compraste o te dieron` : `${cap(unitWord(m, 2))} que tienes ahora`}</span>
          <input type="number" name="n" inputmode="decimal" min="0" step="any" required placeholder="Ej. 30"></label>`,
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        const n = +f.n.value;
        await DB.put('meds', Object.assign({}, m, { stock: (st ? st.left : 0) + n, stockAt: new Date().toISOString(), refillDays: m.refillDays || 5 }));
        await load(); render(); toast('Inventario actualizado', 'check');
      }
    });
  }

  // Interpreta la dosis escrita a mano en versiones anteriores ("50 mg · 1 tableta")
  function parseLegacyDose(txt) {
    const out = {};
    if (!txt) return out;
    const t = txt.toLowerCase();
    const st = t.match(/(\d+(?:[.,]\d+)?)\s*(mg\/5 ?ml|mg\/ml|mcg|mg|ml|ui|g|%)(?![a-z])/);
    if (st) {
      out.strength = st[1].replace(',', '.');
      out.unit = STRENGTH_UNITS.find(u => u.toLowerCase().replace(' ', '') === st[2].replace(' ', '')) || st[2];
    }
    for (const [k, P] of Object.entries(PRESENTATIONS)) {
      const re = new RegExp(`(\\d+(?:[.,]\\d+)?|½|media)?\\s*(${P.u1}|${P.u2}|${P.label.toLowerCase()})`);
      const mm = k !== 'otro' && !P.liquid && t.normalize('NFD').replace(/[̀-ͯ]/g, '').match(new RegExp(re.source.normalize('NFD').replace(/[̀-ͯ]/g, '')));
      if (mm) {
        out.form = k;
        out.qty = mm[1] ? (mm[1] === '½' || mm[1] === 'media' ? '0.5' : mm[1].replace(',', '.')) : '1';
        break;
      }
    }
    return out;
  }

  function medForm(m) {
    const now = new Date();
    const round5 = timeKey(new Date(Math.floor(now.getTime() / 300000) * 300000));
    if (!m || !m.id) m = Object.assign({ mode: 'interval', every: 8, firstTime: round5, qty: 1, form: 'tableta', unit: 'mg', times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], start: today(), active: true }, m || {});
    const look = Object.assign({ shape: 'redonda', color: '', color2: '', scored: false, brand: '', imprint: '' }, m.look || {});
    const units = STRENGTH_UNITS.includes(m.unit) || !m.unit ? STRENGTH_UNITS : [...STRENGTH_UNITS, m.unit];
    const legacy = !m.form && !m.strength && !m.qty ? parseLegacyDose(m.dose) : {};
    const stock0 = m.id ? MS.medStock(m, state.intakes) : null;
    const v = Object.assign({}, m, legacy);
    const mode = MS.isInterval(m) ? 'interval' : m.id ? 'times' : 'interval';
    const days = v.days && v.days.length ? v.days : [0, 1, 2, 3, 4, 5, 6];
    const order = [1, 2, 3, 4, 5, 6, 0];
    const durDays = v.start && v.end ? Math.round((at(v.end) - at(v.start)) / 86400000) + 1 : '';
    const everyOpts = EVERY_OPTS.some(([h]) => h === Number(v.every)) ? EVERY_OPTS : [...EVERY_OPTS, [Number(v.every), `Cada ${v.every} horas`]];
    modal({
      title: m.id ? 'Editar medicamento' : 'Nuevo medicamento',
      body: `
        <div class="field"><span class="row between" style="flex-wrap:nowrap">Nombre del medicamento <button type="button" class="link-btn small" data-lib-open>${icon('list')} Biblioteca</button></span>
          <input name="name" required placeholder="Escribe para buscar: losartán, paracetamol…" value="${esc(v.name)}" autocomplete="off">
          <div class="lib-sug" id="libSug" hidden></div>
          <div class="lib-pres" id="libPres" hidden></div></div>
        <label class="field"><span>Presentación</span><select name="form"><option value="">Seleccionar…</option>
          ${Object.entries(PRESENTATIONS).map(([k, P]) => `<option value="${k}" ${v.form === k ? 'selected' : ''}>${P.label}</option>`).join('')}</select></label>
        <div class="fields">
          <div class="field"><span>Dosis / concentración</span><div class="combo">
            <input name="strength" type="text" inputmode="decimal" placeholder="50" value="${esc(v.strength)}" title="Número; para combinaciones usa /, p. ej. 80/12.5">
            <select name="unit" aria-label="Unidad">${units.map(u => `<option ${v.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
          <div class="field"><span>Cantidad por toma</span><div class="combo">
            <input name="qty" type="number" inputmode="decimal" step="any" min="0" placeholder="1" value="${esc(v.qty)}">
            <span class="unit-suffix" id="qtyUnit"></span></div></div>
        </div>
        ${m.id && m.dose && !m.form && !legacy.strength && !legacy.form ? `<div class="small muted">Dosis registrada anteriormente: <b>${esc(m.dose)}</b></div>` : ''}

        <div class="field"><span>Frecuencia</span>
          <div class="seg" style="width:100%"><button type="button" data-mode="interval" class="${mode === 'interval' ? 'active' : ''}" style="flex:1">Cada X horas</button>
          <button type="button" data-mode="times" class="${mode === 'times' ? 'active' : ''}" style="flex:1">Horarios fijos</button></div>
          <input type="hidden" name="mode" value="${mode}"></div>
        <div data-block="interval" ${mode === 'interval' ? '' : 'hidden'}>
          <label class="field"><span>Tomar</span><select name="every">${everyOpts.map(([h, l]) => `<option value="${h}" ${Number(v.every || 8) === h ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <div data-block="times" ${mode === 'times' ? '' : 'hidden'} class="stack-v" style="gap:14px">
          <div class="field"><span>Horarios</span>${timesEditor(v.times || [])}</div>
          <div class="field"><span>Días</span><div class="days">${order.map(d => `<label><input type="checkbox" name="days" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${DOW1[d]}</span></label>`).join('')}</div></div>
        </div>
        <div class="fields">
          <label class="field"><span id="startLbl">${mode === 'interval' ? 'Fecha 1.ª toma' : 'Inicio'}</span><input type="date" name="start" required value="${esc(v.start || today())}"></label>
          <label class="field" data-block="interval" ${mode === 'interval' ? '' : 'hidden'}><span>Hora 1.ª toma</span><input type="time" name="firstTime" value="${esc(v.firstTime || round5)}"></label>
        </div>
        <div class="fields">
          <label class="field"><span>Duración (días)</span><input type="number" name="durDays" inputmode="numeric" min="1" max="3650" placeholder="Continuo" value="${durDays}"></label>
          <label class="field"><span>Hasta (opcional)</span><input type="date" name="end" value="${esc(v.end)}"></label>
        </div>
        <div data-look ${SOLID.includes(v.form) ? '' : 'hidden'} class="stack-v" style="gap:12px">
          <div class="form-section">Apariencia (opcional)</div>
          <div class="look-head"><div class="pill-big" id="pillPrev"></div><div class="small muted" id="pillTxt">Elige la forma y el color para reconocerla fácilmente.</div></div>
          <div class="field" data-shape-field><span>Forma</span><div class="shape-pick">${Object.entries(PILL_SHAPES).map(([k, l]) => `<label title="${l}"><input type="radio" name="shape" value="${k}" ${look.shape === k ? 'checked' : ''}><span>${pillSVG({ shape: k, color: '#e2e8f0' }, 'tableta', 30)}<small>${l}</small></span></label>`).join('')}</div></div>
          <div class="field"><span data-c1-label>Color</span><div class="swatches">${PILL_COLORS.map(([c, l]) => `<label title="${l}"><input type="radio" name="color" value="${c}" ${look.color === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
          <div class="field" data-c2-field hidden><span>Color de la otra mitad</span><div class="swatches">${PILL_COLORS.map(([c, l]) => `<label title="${l}"><input type="radio" name="color2" value="${c}" ${look.color2 === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
          <label class="check" data-score-field><input type="checkbox" name="scored" ${look.scored ? 'checked' : ''}> Tiene ranura (línea para partirla)</label>
          <div class="fields">
            <label class="field"><span>Grabado</span><input name="imprint" value="${esc(look.imprint)}" placeholder="Ej. 50, M 15" maxlength="20"></label>
            <label class="field"><span>Marca o laboratorio</span><input name="brand" value="${esc(look.brand)}" placeholder="Ej. genérico IMSS" maxlength="40"></label>
          </div>
        </div>
        <div class="preview-box" id="medPreview"></div>
        <label class="field"><span>Indicaciones</span><textarea name="notes" placeholder="Ej. en ayunas, con alimentos…">${esc(v.notes)}</textarea></label>
        <div class="form-section">Inventario (opcional)</div>
        <div class="fields">
          <label class="field"><span>Unidades que tienes ahora</span><input type="number" name="stock" inputmode="decimal" min="0" step="any" placeholder="Ej. 30" value="${stock0 ? stock0.left : ''}"></label>
          <label class="field"><span>Avisarme cuando alcance para</span><select name="refillDays">${[3, 5, 7, 10].map(n => `<option value="${n}" ${(+v.refillDays || 5) === n ? 'selected' : ''}>${n} días</option>`).join('')}</select></label>
        </div>
        <div class="small muted" style="margin-top:-6px">Se descuenta la cantidad por toma cada vez que marcas una dosis como tomada.</div>
        <label class="check"><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}> Activo (recibir recordatorios)</label>`,
      onOpen: f => {
        bindTimes(f);
        const draft = () => ({
          id: m.id || 'draft', mode: f.mode.value, every: +f.every.value, firstTime: f.firstTime.value || '08:00',
          times: readTimes(f, 'times'), days: $$('input[name="days"]:checked', f).map(i => +i.value),
          start: f.start.value || today(), end: f.end.value, active: true,
          form: f.form.value, qty: f.qty.value, strength: f.strength.value, unit: f.unit.value
        });
        // Biblioteca: sugerencias al escribir y concentraciones del medicamento elegido
        const setPres = p => {
          if (p.form) f.form.value = p.form;
          f.strength.value = p.strength ?? '';
          if (p.unit) {
            if (![...f.unit.options].some(o => o.value === p.unit)) f.unit.add(new Option(p.unit, p.unit));
            f.unit.value = p.unit;
          }
          if (p.look) for (const [k, val] of Object.entries(p.look)) {
            if (k === 'scored') f.scored.checked = !!val;
            else if (k === 'imprint' || k === 'brand') f[k].value = val || '';
            else { const r = $(`input[name="${k}"][value="${val}"]`, f); if (r) r.checked = true; }
          }
          $$('#libPres button', f).forEach(b => b.classList.toggle('active', b.dataset.i !== undefined && libPresList[+b.dataset.i] === p));
          update();
        };
        let libPresList = [];
        const showPres = entry => {
          libPresList = entry.pres;
          const box = $('#libPres');
          box.hidden = !entry.pres.length;
          box.innerHTML = entry.pres.length ? `<div class="small muted">Elige la presentación:</div><div class="row" style="gap:6px">${entry.pres.map((p, i) => `<button type="button" class="chip-btn" data-i="${i}">${presLabel(p)}</button>`).join('')}</div>` : '';
          if (entry.pres.length === 1) setPres(entry.pres[0]);
          else if (entry.pres.length && entry.pres.every(x => x.form === entry.pres[0].form)) { f.form.value = entry.pres[0].form; update(); }
        };
        const sug = $('#libSug');
        f.name.addEventListener('input', () => {
          const list = f.name.value.trim().length < 2 ? [] : libSearch(f.name.value, 8);
          sug.hidden = !list.length;
          sug.innerHTML = libListHTML(list, false);
          sug._list = list;
          $('#libPres').hidden = true;
        });
        f.addEventListener('click', e => {
          const sb = e.target.closest('[data-sug]');
          if (sb) { const entry = sug._list[+sb.dataset.sug]; f.name.value = entry.name; sug.hidden = true; sug.classList.remove('full'); showPres(entry); }
          const pb = e.target.closest('#libPres [data-i]');
          if (pb) setPres(libPresList[+pb.dataset.i]);
          if (e.target.closest('[data-lib-open]')) {
            const list = f.name.value.trim().length >= 2 ? libSearch(f.name.value, 80) : libEntries();
            sug.innerHTML = libListHTML(list, true); sug._list = list; sug.hidden = false; sug.classList.add('full');
            f.name.focus();
          }
        });
        const update = () => {
          const P = PRESENTATIONS[f.form.value];
          // Apariencia: solo para tabletas, cápsulas, pastillas y grageas
          const solid = SOLID.includes(f.form.value), caps = f.form.value === 'capsula';
          $('[data-look]', f).hidden = !solid;
          $('[data-shape-field]', f).hidden = caps;
          $('[data-score-field]', f).hidden = caps;
          $('[data-c2-field]', f).hidden = !caps;
          $('[data-c1-label]', f).textContent = caps ? 'Color de una mitad' : 'Color';
          const lk = readLook(f);
          $('#pillPrev').innerHTML = pillSVG(lk, f.form.value, 64);
          const desc = medLookText({ form: f.form.value, look: lk });
          $('#pillTxt').textContent = lk.color ? cap(desc) : 'Elige la forma y el color para reconocerla fácilmente.';
          $('#qtyUnit').textContent = P ? (Number(f.qty.value || 1) <= 1 ? P.u1 : P.u2) : 'unidad(es)';
          const d = draft();
          const next = MS.nextDoses(d, new Date(Math.max(Date.now(), at(d.start).getTime())) , 6);
          let total = '';
          if (d.end && (d.mode === 'times' ? d.times.length && d.days.length : true)) {
            const n = MS.nextDoses(d, at(d.start), 5000).length;
            total = `<div class="small" style="margin-top:8px">Total del tratamiento: <b>${n} toma${n === 1 ? '' : 's'}</b> · termina el ${fmtDate(d.end, { day: 'numeric', month: 'long' })}</div>`;
          }
          const lbl = doseLabel(d);
          $('#medPreview').innerHTML = `<div class="small muted" style="margin-bottom:6px">${lbl ? `Cada toma: <b style="color:var(--text)">${esc(lbl)}</b> · ` : ''}Próximas tomas:</div>
            ${next.length ? `<div class="row" style="gap:6px">${next.map(x => `<span class="chip">${relDay(x.date)} ${x.time}</span>`).join('')}</div>` : '<div class="small muted">Sin tomas próximas con esta configuración.</div>'}${total}`;
        };
        f.addEventListener('click', e => {
          const b = e.target.closest('[data-mode]');
          if (b) {
            f.mode.value = b.dataset.mode;
            $$('[data-mode]', f).forEach(x => x.classList.toggle('active', x === b));
            $$('[data-block]', f).forEach(x => { x.hidden = x.dataset.block !== b.dataset.mode; });
            $('#startLbl').textContent = b.dataset.mode === 'interval' ? 'Fecha 1.ª toma' : 'Inicio';
          }
          setTimeout(update);
        });
        f.addEventListener('input', e => {
          if (e.target.name === 'durDays' || (e.target.name === 'start' && f.durDays.value)) {
            const n = parseInt(f.durDays.value, 10);
            f.end.value = n > 0 && f.start.value ? addDays(f.start.value, n - 1) : '';
          } else if (e.target.name === 'end') {
            f.durDays.value = f.end.value && f.start.value && f.end.value >= f.start.value
              ? Math.round((at(f.end.value) - at(f.start.value)) / 86400000) + 1 : '';
          }
          update();
        });
        f.addEventListener('change', update);
        update();
        if (m.libEntry) showPres(m.libEntry);
      },
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        const modeV = f.mode.value;
        const times = readTimes(f, 'times');
        const dsel = $$('input[name="days"]:checked', f).map(i => +i.value);
        if (modeV === 'times' && !times.length) { toast('Agrega al menos un horario'); return false; }
        if (modeV === 'times' && !dsel.length) { toast('Selecciona al menos un día'); return false; }
        if (modeV === 'interval' && !f.firstTime.value) { toast('Indica la hora de la primera toma'); return false; }
        if (f.end.value && f.end.value < f.start.value) { toast('La fecha final es anterior al inicio'); return false; }
        // Se conservan todos los campos existentes del medicamento (compatibilidad con datos ya guardados)
        const med = Object.assign({}, m, {
          id: m.id || uid(), name: f.name.value.trim(), form: f.form.value,
          strength: parseStrength(f.strength.value), unit: f.unit.value,
          qty: f.qty.value ? +f.qty.value : null, mode: modeV, every: +f.every.value, firstTime: f.firstTime.value,
          times: times.length ? times : (m.times || []), days: dsel.length ? dsel : (m.days || []),
          start: f.start.value, end: f.end.value, notes: f.notes.value.trim(), active: f.active.checked
        });
        delete med.libEntry;
        if (SOLID.includes(med.form)) med.look = readLook(f); else delete med.look;
        med.dose = doseLabel(Object.assign({}, med, { dose: m.dose || '' }));
        // Inventario: solo se reinicia el conteo si cambiaste la cantidad
        const stockIn = f.stock.value === '' ? null : +f.stock.value;
        med.refillDays = +f.refillDays.value;
        if (stockIn == null) { med.stock = null; med.stockAt = null; }
        else if (!stock0 || stockIn !== stock0.left) { med.stock = stockIn; med.stockAt = new Date().toISOString(); }
        // Historial de cambios (para el resumen de la consulta)
        const was = m.id ? `${doseLabel(m)} · ${schedLabel(m)}` : '';
        const now = `${doseLabel(med)} · ${schedLabel(med)}`;
        if (!m.id) med.created = today();
        else if (was !== now || (m.active !== false) !== med.active) {
          med.history = (m.history || []).concat({ date: today(), from: was + (m.active === false ? ' (pausado)' : ''), to: now + (med.active ? '' : ' (pausado)') }).slice(-20);
        }
        await DB.put('meds', med);
        await load(); render(); toast('Medicamento guardado', 'check');
      }
    });
  }

  // ======================================================
  //  AGENDA
  // ======================================================
  function apptItem(a) {
    const t = APPT_TYPES[a.type] || APPT_TYPES.otro;
    const past = (a.date + 'T' + (a.time || '23:59')) < today() + 'T' + timeKey(new Date());
    return `<div class="item" style="${a.done ? 'opacity:.6' : ''}">
      <div class="item-ic" style="background:color-mix(in srgb, ${t.color} 15%, transparent);color:${t.color}">${icon(t.icon)}</div>
      <div class="item-body"><div class="item-title">${esc(a.title)}</div>
        <div class="item-sub">${relDay(a.date)}${a.time ? ' · ' + a.time : ''} · ${t.label}${a.done ? ' · Realizada' : past ? ' · Pasada' : ''}</div>
        ${a.doctor || a.place ? `<div class="item-sub">${[a.doctor, a.place].filter(Boolean).map(esc).join(' — ')}</div>` : ''}
        ${a.notes ? `<div class="item-sub">${esc(a.notes)}</div>` : ''}
        ${a.outcome ? `<div class="item-sub outcome">${icon('chat')} ${esc(a.outcome)}</div>` : ''}</div>
      <div class="item-actions">
        ${a.done && a.type === 'consulta' ? `<button class="icon-btn" data-act="appt-outcome" data-id="${a.id}" title="Indicaciones del médico" aria-label="Indicaciones del médico">${icon('chat')}</button>` : ''}
        ${!a.done ? `<button class="icon-btn" data-act="appt-done" data-id="${a.id}" title="Marcar como realizada" aria-label="Realizada">${icon('check')}</button>` : ''}
        ${a.type === 'examen' && (a.done || past) ? `<button class="icon-btn" data-act="appt-results" data-id="${a.id}" title="Registrar resultados" aria-label="Registrar resultados" style="color:var(--pulse)">${icon('flask')}</button>` : ''}
        <button class="icon-btn hide-mobile" data-act="appt-ics" data-id="${a.id}" title="Añadir a calendario" aria-label="Añadir a calendario">${icon('calPlus')}</button>
        <button class="icon-btn" data-act="edit-appt" data-id="${a.id}" aria-label="Editar">${icon('edit')}</button>
        <button class="icon-btn danger" data-act="del-appt" data-id="${a.id}" aria-label="Eliminar">${icon('trash')}</button></div>
    </div>`;
  }

  function renderAgenda() {
    if (!state.calMonth) { const d = at(state.calSel); state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
    const m = state.calMonth;
    const first = new Date(m);
    const offset = (first.getDay() + 6) % 7; // lunes primero
    const start = new Date(m.getFullYear(), m.getMonth(), 1 - offset);
    const byDay = new Map();
    for (const a of state.appts) { if (!byDay.has(a.date)) byDay.set(a.date, []); byDay.get(a.date).push(a); }
    let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const ds = dateKey(d);
      const items = byDay.get(ds) || [];
      cells += `<button class="day ${d.getMonth() !== m.getMonth() ? 'other' : ''} ${ds === today() ? 'today' : ''} ${ds === state.calSel ? 'sel' : ''}" data-act="calsel" data-d="${ds}">
        <span>${d.getDate()}</span><span class="dots">${items.slice(0, 3).map(a => `<i style="background:${(APPT_TYPES[a.type] || APPT_TYPES.otro).color}"></i>`).join('')}</span></button>`;
    }
    const dayItems = byDay.get(state.calSel) || [];
    const nowKey = today() + 'T' + timeKey(new Date());
    const upcoming = state.appts.filter(a => !a.done && (a.date + 'T' + (a.time || '23:59')) >= nowKey);
    const past = state.appts.filter(a => a.done || (a.date + 'T' + (a.time || '23:59')) < nowKey).reverse();
    return `
    <div class="stack-v">
      <div class="row between">
        <div class="legend" style="margin:0">${Object.values(APPT_TYPES).map(t => `<span><i style="background:${t.color};border-radius:50%"></i>${t.label}</span>`).join('')}</div>
        <div class="row">${upcoming.length ? `<button class="btn outline small" data-act="appts-ics">${icon('calPlus')}<span class="hide-mobile">Exportar citas</span></button>` : ''}
        <button class="btn small hide-mobile" data-act="new-appt">${icon('plus')} Nueva cita</button></div>
      </div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-head">
            <button class="icon-btn" data-act="calnav" data-v="-1" aria-label="Mes anterior">${icon('left')}</button>
            <div style="text-align:center"><h3>${cap(m.toLocaleDateString('es', { month: 'long', year: 'numeric' }))}</h3>
            <button class="btn ghost small" style="min-height:26px;padding:2px 10px;margin-top:4px" data-act="caltoday">Hoy</button></div>
            <button class="icon-btn" data-act="calnav" data-v="1" aria-label="Mes siguiente">${icon('right')}</button>
          </div>
          <div class="cal">${cells}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${cap(fmtLong(state.calSel))}</h3>
            <button class="icon-btn" data-act="new-appt" data-d="${state.calSel}" aria-label="Agregar en este día">${icon('plus')}</button></div>
          ${dayItems.length ? `<div class="list">${dayItems.map(apptItem).join('')}</div>` : emptyState('calendar', 'Sin eventos este día')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${icon('clock')} Próximas <span class="chip">${upcoming.length}</span></h3></div>
        ${upcoming.length ? `<div class="list">${upcoming.map(apptItem).join('')}</div>` : emptyState('calendar', 'No tienes citas próximas')}
      </div>
      ${past.length ? `<details class="card"><summary style="cursor:pointer;font-weight:600">Historial (${past.length})</summary>
        <div class="list" style="margin-top:8px">${past.slice(0, 50).map(apptItem).join('')}</div></details>` : ''}
    </div>`;
  }

  // Al terminar una consulta: lo que indicó el médico (queda en el historial y en el resumen)
  function consultOutcomeForm(a) {
    const qs = (state.settings.questions || []).filter(q => !q.done);
    modal({
      title: 'Consulta realizada',
      body: `<div class="small muted" style="margin-top:0">${esc(a.title)} · ${relDay(a.date)}${a.time ? ' ' + a.time : ''}</div>
        <label class="field"><span>¿Qué te indicó el médico?</span><textarea name="outcome" rows="4" placeholder="Ej. subir losartán a 100 mg, análisis en 3 meses, bajar la sal…">${esc(a.outcome)}</textarea></label>
        ${qs.length ? `<div class="field"><span>Preguntas que llevabas (marca las que ya resolviste)</span>
          <div class="stack-v" style="gap:6px">${qs.map(q => `<label class="check"><input type="checkbox" name="q" value="${q.id}" checked> ${esc(q.text)}</label>`).join('')}</div></div>` : ''}
        <p class="small muted" style="margin:0">Si te cambiaron un medicamento, edítalo en <b>Medicamentos</b>: el cambio queda guardado en tu historial.</p>`,
      onSubmit: async f => {
        a.done = true; a.outcome = f.outcome.value.trim(); a.doneAt = today();
        await DB.put('appts', a);
        const solved = new Set($$('input[name="q"]:checked', f).map(i => i.value));
        if (solved.size) {
          state.settings.questions = (state.settings.questions || []).map(q => solved.has(q.id) ? Object.assign({}, q, { done: true, answeredAt: today() }) : q);
          await saveSettings();
        }
        await load(); render();
        toast('Consulta guardada', 'check', { label: 'Medicamentos', fn: () => { location.hash = '#/medicamentos'; } });
      }
    });
  }

  function apptForm(a, date) {
    a = a || { type: 'consulta', date: date || today(), time: '09:00', remind: 60, remindDayBefore: true };
    const rem = [[0, 'A la hora'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [120, '2 horas antes'], [180, '3 horas antes']];
    modal({
      title: a.id ? 'Editar evento' : 'Nueva cita o examen',
      body: `
        <div class="seg" role="radiogroup">${Object.entries(APPT_TYPES).map(([k, t]) =>
          `<button type="button" data-type="${k}" class="${a.type === k ? 'active' : ''}">${t.label}</button>`).join('')}</div>
        <input type="hidden" name="type" value="${esc(a.type)}">
        <label class="field"><span>Título</span><input name="title" required placeholder="Ej. Cardiólogo, Perfil lipídico…" value="${esc(a.title)}"></label>
        <div class="fields"><label class="field"><span>Fecha</span><input type="date" name="date" required value="${esc(a.date)}"></label>
          <label class="field"><span>Hora</span><input type="time" name="time" value="${esc(a.time)}"></label></div>
        <div class="fields"><label class="field"><span>Médico / laboratorio</span><input name="doctor" value="${esc(a.doctor)}"></label>
          <label class="field"><span>Lugar</span><input name="place" value="${esc(a.place)}"></label></div>
        <label class="field"><span>Recordatorio</span><select name="remind">${rem.map(([v, l]) => `<option value="${v}" ${+a.remind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="remindDayBefore" ${a.remindDayBefore !== false ? 'checked' : ''}> Recordarme también un día antes</label>
        <label class="field"><span>Notas / preparación</span><textarea name="notes" placeholder="Ej. ayuno de 8 horas, llevar estudios previos…">${esc(a.notes)}</textarea></label>
        ${a.id ? `<label class="check"><input type="checkbox" name="done" ${a.done ? 'checked' : ''}> Realizada</label>` : ''}`,
      onOpen: f => {
        f.addEventListener('click', e => {
          const b = e.target.closest('[data-type]');
          if (!b) return;
          f.type.value = b.dataset.type;
          $$('[data-type]', f).forEach(x => x.classList.toggle('active', x === b));
        });
      },
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        await DB.put('appts', {
          id: a.id || uid(), type: f.type.value, title: f.title.value.trim(), date: f.date.value, time: f.time.value,
          doctor: f.doctor.value.trim(), place: f.place.value.trim(), remind: +f.remind.value,
          remindDayBefore: f.remindDayBefore.checked, notes: f.notes.value.trim(), done: f.done ? f.done.checked : false
        });
        state.calSel = f.date.value;
        const d = at(f.date.value); state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        await load(); render(); toast('Evento guardado', 'check');
      }
    });
  }

  // ---------- iCalendar (.ics) ----------
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  const icsLocal = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarm = (trigger, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${trigger}`, `DESCRIPTION:${icsEsc(text)}`, 'END:VALARM'];
  const icsWrap = events => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Latidia//ES', 'CALSCALE:GREGORIAN', ...events.flat(), 'END:VCALENDAR'].join('\r\n');

  function apptEvent(a) {
    const s = at(a.date, a.time || '09:00'), e = new Date(s.getTime() + 3600000);
    const t = (APPT_TYPES[a.type] || APPT_TYPES.otro).label;
    const ev = ['BEGIN:VEVENT', `UID:${a.id}@medicsoft`, `DTSTAMP:${icsStamp()}`, `DTSTART:${icsLocal(s)}`, `DTEND:${icsLocal(e)}`,
      `SUMMARY:${icsEsc(t + ': ' + a.title)}`];
    if (a.place) ev.push(`LOCATION:${icsEsc(a.place)}`);
    ev.push(`DESCRIPTION:${icsEsc([a.doctor, a.notes].filter(Boolean).join('\n'))}`);
    ev.push(...alarm(`-PT${+a.remind || 0}M`, a.title));
    if (a.remindDayBefore !== false) ev.push(...alarm('-P1D', a.title + ' (mañana)'));
    ev.push('END:VEVENT');
    return ev;
  }
  function medEvents(m) {
    const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const summary = `SUMMARY:${icsEsc('💊 ' + m.name + (doseLabel(m) ? ' — ' + doseLabel(m) : ''))}`;
    if (MS.isInterval(m)) {
      const s = at(m.start || today(), m.firstTime || '08:00'), e = new Date(s.getTime() + 600000);
      let rule = `RRULE:FREQ=HOURLY;INTERVAL=${Number(m.every)}`;
      if (m.end) rule += `;UNTIL=${m.end.replace(/-/g, '')}T235959`;
      return [['BEGIN:VEVENT', `UID:${m.id}-int@medicsoft`, `DTSTAMP:${icsStamp()}`, `DTSTART:${icsLocal(s)}`, `DTEND:${icsLocal(e)}`,
        rule, summary, `DESCRIPTION:${icsEsc(m.notes)}`, ...alarm('PT0M', 'Tomar ' + m.name), 'END:VEVENT']];
    }
    const start = m.start && m.start > today() ? m.start : today();
    return (m.times || []).map(t => {
      const s = at(start, t), e = new Date(s.getTime() + 600000);
      let rule = m.days && m.days.length && m.days.length < 7 ? `RRULE:FREQ=WEEKLY;BYDAY=${m.days.map(d => BY[d]).join(',')}` : 'RRULE:FREQ=DAILY';
      if (m.end) rule += `;UNTIL=${m.end.replace(/-/g, '')}T235959`;
      return ['BEGIN:VEVENT', `UID:${m.id}-${t.replace(':', '')}@medicsoft`, `DTSTAMP:${icsStamp()}`, `DTSTART:${icsLocal(s)}`, `DTEND:${icsLocal(e)}`,
        rule, summary, `DESCRIPTION:${icsEsc(m.notes)}`,
        ...alarm('PT0M', 'Tomar ' + m.name), 'END:VEVENT'];
    });
  }

  // ======================================================
  //  REPORTES
  // ======================================================
  function reportPreset(p) {
    const t = today(), d = new Date();
    if (p === '7') return [addDays(t, -6), t];
    if (p === '30') return [addDays(t, -29), t];
    if (p === '90') return [addDays(t, -89), t];
    if (p === 'month') return [dateKey(new Date(d.getFullYear(), d.getMonth(), 1)), t];
    if (p === 'prev') return [dateKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)), dateKey(new Date(d.getFullYear(), d.getMonth(), 0))];
    return null;
  }

  function reportData() {
    const r = state.report;
    const list = state.vitals.filter(v => v.date >= r.from && v.date <= r.to)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const bp = list.filter(v => v.sys && v.dia), pul = list.filter(v => v.pulse);
    const cats = {};
    for (const v of bp) { const c = bpCategory(v.sys, v.dia); cats[c.id] = (cats[c.id] || 0) + 1; }
    const periods = [['Mañana (00–12 h)', 0, 12], ['Tarde (12–18 h)', 12, 18], ['Noche (18–24 h)', 18, 24]].map(([label, a, b]) => {
      const s = bp.filter(v => { const h = +v.time.slice(0, 2); return h >= a && h < b; });
      const p = pul.filter(v => { const h = +v.time.slice(0, 2); return h >= a && h < b; });
      return { label, n: s.length, sys: avg(s.map(v => v.sys)), dia: avg(s.map(v => v.dia)), pulse: avg(p.map(v => v.pulse)) };
    });
    return { list, bp, pul, cats, periods };
  }

  function renderReports() {
    if (!state.report) { const [from, to] = reportPreset('30'); state.report = { preset: '30', from, to, meds: true }; }
    const r = state.report;
    const { list, bp, pul, cats, periods } = reportData();
    const s = state.settings;
    const mm = (arr, k) => arr.length ? `${Math.min(...arr.map(v => v[k]))} – ${Math.max(...arr.map(v => v[k]))}` : '—';
    const presets = [['7', '7 días'], ['30', '30 días'], ['90', '3 meses'], ['month', 'Este mes'], ['prev', 'Mes anterior']];
    const catDefs = [['normal', 'Normal', 'var(--bp-normal)'], ['elev', 'Elevada', 'var(--bp-elev)'], ['h1', 'HTA grado 1', 'var(--bp-h1)'],
      ['h2', 'HTA grado 2', 'var(--bp-h2)'], ['crisis', 'Crisis', 'var(--bp-crisis)'], ['low', 'Baja', 'var(--bp-low)']];
    const ad = r.meds && state.meds.length ? adherence(r.from, r.to) : null;
    const avgCat = bp.length ? bpCategory(avg(bp.map(v => v.sys)), avg(bp.map(v => v.dia))) : null;

    return `
    <div class="stack-v">
      <div class="card no-print">
        <div class="card-head"><h3>${icon('calendar')} Periodo del reporte</h3></div>
        <div class="seg" style="margin-bottom:12px">${presets.map(([v, l]) => `<button data-act="rpreset" data-v="${v}" class="${r.preset === v ? 'active' : ''}">${l}</button>`).join('')}</div>
        <div class="fields" style="max-width:520px">
          <label class="field"><span>Desde</span><input type="date" data-rdate="from" value="${r.from}" max="${r.to}"></label>
          <label class="field"><span>Hasta</span><input type="date" data-rdate="to" value="${r.to}" min="${r.from}"></label>
        </div>
        <label class="check" style="margin-top:12px"><input type="checkbox" data-rmeds ${r.meds ? 'checked' : ''}> Incluir adherencia a medicamentos</label>
        <label class="check" style="margin-top:8px"><input type="checkbox" data-rlabs ${r.labs !== false ? 'checked' : ''}> Incluir análisis de laboratorio del periodo${labsInRange(r).length ? ` (${labsInRange(r).length})` : ''}</label>
        <div class="report-actions">
          <button class="btn" data-act="pdf" ${list.length ? '' : 'disabled'}>${icon('file')} ${isMobile() ? 'Generar PDF' : 'Descargar PDF'}</button>
          <button class="btn outline" data-act="csv" ${list.length ? '' : 'disabled'}>${icon('download')} Excel (CSV)</button>
        </div>
        <div class="small muted" style="margin-top:8px">${isMobile() ? 'Se abrirá el menú para compartir: puedes guardarlo en Archivos, imprimirlo o enviarlo por WhatsApp o correo.' : 'PDF en tamaño carta, listo para imprimir o enviar a tu médico.'}</div>
      </div>

      <div id="report" class="stack-v">
        <div class="report-head">
          <h2 style="font-size:1.3rem">Reporte de presión arterial y pulso</h2>
          <div class="report-meta small">
            ${s.name ? `<span><b>Paciente:</b> ${esc(s.name)}</span>` : ''}
            ${s.doctor ? `<span><b>Médico:</b> ${esc(s.doctor)}</span>` : ''}
            <span><b>Periodo:</b> ${fmtDate(r.from, { day: 'numeric', month: 'short', year: 'numeric' })} – ${fmtDate(r.to, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span><b>Generado:</b> ${new Date().toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>
        ${!list.length ? `<div class="card">${emptyState('report', 'No hay registros en el periodo seleccionado')}</div>` : `
        <div class="grid stats">
          <div class="card stat">${statIc('heart', 'var(--sys)')}<div><div class="label">Promedio PA</div><div class="value num">${bp.length ? `${avg(bp.map(v => v.sys))}/${avg(bp.map(v => v.dia))}` : '—'} <small>mmHg</small></div>${avgCat ? catChip(avgCat) : ''}</div></div>
          <div class="card stat">${statIc('pulse', 'var(--pulse)')}<div><div class="label">Pulso promedio</div><div class="value num">${pul.length ? avg(pul.map(v => v.pulse)) : '—'} <small>lpm</small></div><div class="small muted">Rango ${mm(pul, 'pulse')}</div></div></div>
          <div class="card stat">${statIc('trend', 'var(--sys)')}<div><div class="label">Sistólica mín–máx</div><div class="value num">${mm(bp, 'sys')}</div></div></div>
          <div class="card stat">${statIc('trend', 'var(--dia)')}<div><div class="label">Diastólica mín–máx</div><div class="value num">${mm(bp, 'dia')}</div></div></div>
          <div class="card stat">${statIc('list', 'var(--primary)')}<div><div class="label">Tomas registradas</div><div class="value num">${list.length}</div><div class="small muted">${new Set(list.map(v => v.date)).size} días con registro</div></div></div>
          ${ad ? `<div class="card stat">${statIc('pill', 'var(--primary)')}<div><div class="label">Adherencia</div><div class="value num">${ad.pct == null ? '—' : ad.pct + '%'}</div><div class="small muted">${ad.taken}/${ad.scheduled} dosis</div></div></div>` : ''}
        </div>
        <div class="card"><div class="card-head"><h3>${icon('activity')} Evolución</h3></div><div data-chart="report"></div></div>
        <div class="grid cols-2">
          <div class="card"><div class="card-head"><h3>Clasificación de las tomas</h3></div>
            ${bp.length ? Charts.stackBar(catDefs.map(([id, label, color]) => ({ label, color, value: cats[id] || 0 }))) : '<div class="muted">Sin datos de presión</div>'}
            <div class="small muted" style="margin-top:10px">Según guía AHA/ACC 2017.</div></div>
          <div class="card"><div class="card-head"><h3>Promedio por horario</h3></div>
            <div class="table-wrap"><table><thead><tr><th>Horario</th><th>Tomas</th><th>PA</th><th>Pulso</th></tr></thead><tbody>
            ${periods.map(p => `<tr><td>${p.label}</td><td class="num">${p.n}</td><td class="num">${p.n ? p.sys + '/' + p.dia : '—'}</td><td class="num">${p.pulse ?? '—'}</td></tr>`).join('')}
            </tbody></table></div></div>
        </div>
        ${ad && ad.per.length ? `<div class="card"><div class="card-head"><h3>${icon('pill')} Medicamentos en el periodo</h3></div>
          <div class="table-wrap"><table><thead><tr><th>Medicamento</th><th>Dosis</th><th>Horarios</th><th>Tomadas</th><th>Adherencia</th></tr></thead><tbody>
          ${ad.per.map(p => `<tr><td>${esc(p.med.name)}</td><td>${esc(doseLabel(p.med))}</td><td>${esc(schedLabel(p.med))}</td><td class="num">${p.taken}/${p.scheduled}</td><td class="num">${Math.round(p.taken * 100 / p.scheduled)}%</td></tr>`).join('')}
          </tbody></table></div></div>` : ''}
        <div class="card"><div class="card-head"><h3>${icon('list')} Detalle de tomas</h3></div>
          <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Sist.</th><th>Diast.</th><th>Pulso</th><th>Clasificación</th><th>Otros</th><th>Notas</th></tr></thead><tbody>
          ${list.map(v => { const c = bpCategory(v.sys, v.dia); return `<tr>
            <td>${fmtDate(v.date, { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })}</td><td class="num">${v.time}</td>
            <td class="num" style="color:var(--sys);font-weight:600">${v.sys ?? '—'}</td><td class="num" style="color:var(--dia);font-weight:600">${v.dia ?? '—'}</td>
            <td class="num">${v.pulse ?? '—'}</td><td>${c ? `<span style="color:${c.color};font-weight:600">● ${c.label}</span>` : '—'}</td>
            <td class="small">${vitalOther(v, true)}</td>
            <td class="wrap small">${esc(v.notes)}</td></tr>`; }).join('')}
          </tbody></table></div></div>
        <p class="small muted">Este reporte es informativo y no sustituye la valoración de un profesional de la salud.</p>`}
      </div>
    </div>`;
  }
  routeById('reportes').after = () => {
    if (window.ReportPDF) ReportPDF.load().catch(() => {});
    const el = $('[data-chart="report"]');
    if (el) drawBPChart(el, reportData().list, 280);
    $$('[data-rdate]').forEach(i => i.onchange = () => {
      if (!i.value) return;
      state.report[i.dataset.rdate] = i.value; state.report.preset = '';
      if (state.report.from > state.report.to) [state.report.from, state.report.to] = [state.report.to, state.report.from];
      render();
    });
    const mc = $('[data-rmeds]');
    if (mc) mc.onchange = () => { state.report.meds = mc.checked; render(); };
    const lc = $('[data-rlabs]');
    if (lc) lc.onchange = () => { state.report.labs = lc.checked; render(); };
  };

  function ageFrom(birth) {
    if (!birth) return '';
    const b = at(birth), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a >= 0 && a < 130 ? `${a} años` : '';
  }

  const labsInRange = r => state.labs.filter(l => l.date >= r.from && l.date <= r.to);

  function pdfData() {
    const r = state.report, s = state.settings;
    const { list, bp, pul, cats, periods } = reportData();
    const mm = (arr, k) => arr.length ? `${Math.min(...arr.map(v => v[k]))} - ${Math.max(...arr.map(v => v[k]))}` : '';
    const ad = r.meds && state.meds.length ? adherence(r.from, r.to) : null;
    const long = ds => fmtDate(ds, { day: 'numeric', month: 'long', year: 'numeric' });
    return {
      title: 'Reporte de presión arterial y frecuencia cardiaca',
      patient: s.name, doctor: s.doctor, age: ageFrom(s.birth), blood: s.blood,
      conditions: listOf(s.conditions).join(', '), allergies: listOf(s.allergies).join(', '),
      periodLabel: `${long(r.from)} al ${long(r.to)}`,
      generated: new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' }),
      total: list.length, days: new Set(list.map(v => v.date)).size, bpCount: bp.length,
      avgBP: bp.length ? `${avg(bp.map(v => v.sys))}/${avg(bp.map(v => v.dia))}` : '',
      avgCat: bp.length ? bpCategory(avg(bp.map(v => v.sys)), avg(bp.map(v => v.dia))) : null,
      avgPulse: pul.length ? avg(pul.map(v => v.pulse)) : null, pulseRange: mm(pul, 'pulse'),
      sysRange: mm(bp, 'sys'), diaRange: mm(bp, 'dia'), cats,
      catDefs: [['normal', 'Normal'], ['elev', 'Elevada'], ['h1', 'Hipertensión grado 1'], ['h2', 'Hipertensión grado 2'], ['crisis', 'Crisis hipertensiva'], ['low', 'Presión baja']].map(([id, label]) => ({ id, label })),
      periods: periods.map(p => Object.assign({}, p, { label: p.label.replace('–', '-') })),
      adherence: ad && ad.scheduled ? ad : null,
      meds: ad ? ad.per.map(p => ({ name: p.med.name, dose: doseLabel(p.med),
        schedule: schedLabel(p.med), taken: p.taken, scheduled: p.scheduled, pct: Math.round(p.taken * 100 / p.scheduled) })) : [],
      labs: r.labs !== false ? labsInRange(r).slice().reverse().map(l => ({
        title: [cap(fmtDate(l.date, { day: 'numeric', month: 'long', year: 'numeric' })), l.lab, l.folio && 'Folio ' + l.folio].filter(Boolean).join(' · '),
        items: (l.items || []).map(it => ({ name: it.name, value: it.value, unit: it.unit || '', ref: refLabel(it), flag: labFlag(it) }))
      })) : [],
      list: list.map(v => ({
        ts: +vitalTime(v), time: v.time, sys: v.sys, dia: v.dia, pulse: v.pulse, cat: bpCategory(v.sys, v.dia),
        dateLabel: cap(fmtDate(v.date, { weekday: 'short' })).replace('.', '') + ' ' + fmtDate(v.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
        other: vitalOther(v, false),
        notes: v.notes || ''
      }))
    };
  }

  // Columna "Otros" del reporte: signos adicionales, número de lecturas promediadas y contexto
  function vitalOther(v, html) {
    const parts = [v.temp && v.temp + ' °C', v.spo2 && (html ? 'SpO₂ ' : 'SpO2 ') + v.spo2 + '%', v.glucose && v.glucose + ' mg/dL', v.weight && v.weight + ' kg', v.arm, v.position,
      v.readings && v.readings.length > 1 && `prom. de ${v.readings.length} lecturas`,
      ...(v.tags || []).map(t => tagLabel(t).replace(/^\S+\s/, ''))].filter(Boolean).join(' · ');
    return html ? esc(parts) : parts;
  }

  const isMobile = () => matchMedia('(pointer: coarse)').matches || /iphone|ipad|android/i.test(navigator.userAgent);

  // En el celular usa la hoja de compartir (guardar en Archivos, imprimir, WhatsApp…); en la computadora descarga
  async function deliverFile(blob, name, title) {
    const file = new File([blob], name, { type: blob.type });
    if (isMobile() && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) {
        if (e.name === 'AbortError') return;
        // iOS exige un toque reciente: se ofrece un botón para compartir
        return new Promise(res => {
          modal({ title: 'Archivo listo', body: `<p>Tu archivo <b>${esc(name)}</b> está listo.</p>`, submit: 'Compartir',
            onSubmit: async () => { try { await navigator.share({ files: [file], title }); } catch (_) {} } });
          $('#modal').addEventListener('close', res, { once: true });
        });
      }
    }
    download(name, blob);
  }

  function reportCSV() {
    const { list } = reportData();
    const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [['Fecha', 'Hora', 'Sistólica', 'Diastólica', 'Pulso', 'Clasificación', 'Temperatura', 'SpO2', 'Glucosa', 'Peso', 'Brazo', 'Posición', 'Lecturas', 'Contexto', 'Notas']];
    for (const v of list) {
      const c = bpCategory(v.sys, v.dia);
      rows.push([v.date, v.time, v.sys, v.dia, v.pulse, c ? c.label : '', v.temp, v.spo2, v.glucose, v.weight, v.arm, v.position,
        v.readings ? v.readings.length : 1, (v.tags || []).map(t => tagLabel(t).replace(/^\S+\s/, '')).join(', '), v.notes]);
    }
    return '\uFEFF' + rows.map(r => r.map(q).join(';')).join('\r\n');
  }

  // ======================================================
  //  ANÁLISIS DE LABORATORIO
  // ======================================================
  const labKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const LAB_FLAG = {
    high: { label: 'Alto', color: 'var(--danger)', ic: 'trend' },
    low: { label: 'Bajo', color: 'var(--bp-low)', ic: 'trend' },
    ok: { label: 'Normal', color: 'var(--ok)', ic: 'check' }
  };
  function labFlag(it) {
    const v = parseFloat(String(it.value).replace(',', '.').replace(/[<>\s]/g, ''));
    if (isNaN(v) || (it.low == null && it.high == null)) return null;
    if (it.low != null && v < it.low) return 'low';
    if (it.high != null && v > it.high) return 'high';
    return 'ok';
  }
  const fmtN = n => n == null || n === '' ? '' : String(n).replace(/\.0+$/, '');
  function refLabel(it) {
    if (it.low != null && it.high != null) return `${fmtN(it.low)} – ${fmtN(it.high)}`;
    if (it.high != null) return `< ${fmtN(it.high)}`;
    if (it.low != null) return `> ${fmtN(it.low)}`;
    return it.refText || '—';
  }
  const flagChip = f => f ? `<span class="chip" style="color:${LAB_FLAG[f].color};background:color-mix(in srgb, ${LAB_FLAG[f].color} 13%, transparent)"><span class="dot"></span>${LAB_FLAG[f].label}</span>` : '';

  // Último valor de cada parámetro + historial
  function labParams() {
    const map = new Map();
    for (const lab of state.labs.slice().sort((a, b) => a.date.localeCompare(b.date))) {
      for (const it of lab.items || []) {
        const k = labKey(it.name);
        if (!k) continue;
        const p = map.get(k) || { key: k, name: it.name, history: [] };
        p.name = it.name; p.last = it; p.lastDate = lab.date; p.group = it.group;
        p.history.push({ date: lab.date, value: it.value, unit: it.unit, low: it.low, high: it.high, flag: labFlag(it), labId: lab.id });
        map.set(k, p);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function renderLabs() {
    const labs = state.labs;
    const actions = `<div class="row">
      <label class="btn">${icon('upload')} Importar PDF<input type="file" accept="application/pdf,.pdf" data-lab-file hidden></label>
      <button class="btn outline" data-act="lab-manual">${icon('edit')} Captura manual</button></div>`;
    if (!labs.length) {
      return `<div class="stack-v">
        <div class="card">${emptyState('flask', 'Aún no tienes análisis registrados.<br>Importa el PDF de tu laboratorio o captura los valores a mano.', `<div style="margin-top:14px;display:flex;justify-content:center">${actions}</div>`)}</div>
        <p class="small muted" style="margin:0">${icon('lock', '').replace('class="ic ', 'style="width:14px;height:14px;vertical-align:-2px" class="ic ')} El PDF se lee en tu dispositivo; no se sube a ningún servidor. Solo se guardan los valores en tu cuenta.</p></div>`;
    }
    const last = labs[0];
    const lastOut = (last.items || []).filter(it => ['high', 'low'].includes(labFlag(it)));
    const params = labParams();
    const q = state.labQuery || '';
    const shown = q ? params.filter(p => labKey(p.name).includes(labKey(q))) : params;
    return `
    <div class="stack-v">
      <div class="row between"><div class="small muted">${labs.length} estudio${labs.length === 1 ? '' : 's'} · ${params.length} parámetros</div>${actions}</div>
      <div class="card">
        <div class="card-head"><h3>${icon('flask')} Último análisis</h3><span class="chip">${cap(fmtDate(last.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div>
        <div class="small muted">${esc([last.lab, last.doctor && 'Solicitó: ' + last.doctor].filter(Boolean).join(' · ') || 'Sin laboratorio')} · ${(last.items || []).length} parámetros</div>
        ${lastOut.length ? `<div class="row" style="gap:6px;margin-top:10px">${lastOut.map(it => `<span class="chip" style="color:${LAB_FLAG[labFlag(it)].color};background:color-mix(in srgb, ${LAB_FLAG[labFlag(it)].color} 13%, transparent)">${esc(it.name)}: ${esc(it.value)} ${esc(it.unit)} · ${LAB_FLAG[labFlag(it)].label}</span>`).join('')}</div>`
          : `<div class="small" style="margin-top:10px;color:var(--ok)">${icon('check', '').replace('class="ic ', 'style="width:14px;height:14px;vertical-align:-2px" class="ic ')} Todos los valores dentro del rango de referencia.</div>`}
        <div class="row" style="margin-top:12px"><button class="btn ghost small" data-act="lab-view" data-id="${last.id}">${icon('list')} Ver resultados completos</button></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('trend')} Parámetros</h3>
          <input type="search" data-lab-q placeholder="Buscar (glucosa, colesterol…)" value="${esc(q)}" style="max-width:260px;min-height:38px"></div>
        <div class="list">${shown.map(p => {
          const f = labFlag(p.last), h = p.history, prev = h.length > 1 ? h[h.length - 2] : null;
          const cur = parseFloat(String(p.last.value).replace(',', '.')), pv = prev ? parseFloat(String(prev.value).replace(',', '.')) : NaN;
          const delta = prev && !isNaN(cur) && !isNaN(pv) ? cur - pv : null;
          return `<button class="item lab-param" data-act="lab-param" data-k="${esc(p.key)}">
            <div class="item-body"><div class="item-title">${esc(p.name)}</div>
              <div class="item-sub">${esc(refLabel(p.last))} ${esc(p.last.unit || '')} · ${fmtDate(p.lastDate, { day: 'numeric', month: 'short', year: '2-digit' })}${h.length > 1 ? ` · ${h.length} mediciones` : ''}</div></div>
            <div style="text-align:right;flex:none"><div class="bp-val" style="font-size:1.05rem">${esc(p.last.value)} <span class="small muted" style="font-weight:500">${esc(p.last.unit || '')}</span></div>
              <div class="row" style="gap:6px;justify-content:flex-end">${delta != null && delta !== 0 ? `<span class="small muted">${delta > 0 ? '▲' : '▼'} ${fmtN(Math.abs(Math.round(delta * 100) / 100))}</span>` : ''}${flagChip(f)}</div></div>
          </button>`;
        }).join('') || '<div class="small muted">Sin coincidencias.</div>'}</div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('file')} Estudios</h3></div>
        <div class="list">${labs.map(l => {
          const out = (l.items || []).filter(it => ['high', 'low'].includes(labFlag(it))).length;
          return `<div class="item">
            <div class="item-ic" style="background:color-mix(in srgb, var(--pulse) 14%, transparent);color:var(--pulse)">${icon('flask')}</div>
            <div class="item-body"><div class="item-title">${cap(fmtDate(l.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
              <div class="item-sub">${esc([l.lab, l.folio && 'Folio ' + l.folio].filter(Boolean).join(' · ') || 'Laboratorio')} · ${(l.items || []).length} parámetros${out ? ` · <span style="color:var(--danger)">${out} fuera de rango</span>` : ''}</div></div>
            <div class="item-actions">
              <button class="icon-btn" data-act="lab-view" data-id="${l.id}" title="Ver" aria-label="Ver">${icon('eye')}</button>
              <button class="icon-btn" data-act="lab-edit" data-id="${l.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
              <button class="icon-btn danger" data-act="lab-del" data-id="${l.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button></div>
          </div>`;
        }).join('')}</div>
      </div>
      <p class="small muted" style="margin:0">Los rangos de referencia son los que indica cada laboratorio. La interpretación de tus resultados corresponde a tu médico.</p>
    </div>`;
  }

  function labsAfter() {
    const f = $('[data-lab-file]');
    if (f) f.onchange = () => { const file = f.files[0]; f.value = ''; if (file) importLabPdf(file); };
    const q = $('[data-lab-q]');
    if (q) q.oninput = () => {
      state.labQuery = q.value;
      const pos = q.selectionStart;
      render();
      const n = $('[data-lab-q]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {}
    };
  }

  async function importLabPdf(file, extra) {
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast('Selecciona un archivo PDF'); return; }
    toast('Leyendo el PDF…', 'file');
    try {
      const lines = await LabImport.extractLines(file);
      const age = parseInt(ageFrom(state.settings.birth), 10);
      const { meta, items } = LabImport.parse(lines, isNaN(age) ? null : age);
      if (!items.length) {
        toast('No se reconocieron resultados en el PDF; captúralos manualmente');
        return labForm(Object.assign({ date: meta.date, folio: meta.folio, doctor: meta.doctor, items: [] }, extra), { source: 'manual' });
      }
      labForm(Object.assign({ date: meta.date || today(), folio: meta.folio, doctor: meta.doctor, lab: '', items }, extra), { source: 'pdf', fileName: file.name });
    } catch (e) { console.error(e); toast(e.message || 'No se pudo leer el PDF'); }
  }

  function labRow(it, i) {
    const f = labFlag(it);
    return `<div class="lab-row" data-i="${i}" data-group="${esc(it.group || '')}" data-reftext="${esc(it.refText || '')}">
      <input class="lab-name" placeholder="Parámetro (ej. Glucosa)" value="${esc(it.name)}" aria-label="Parámetro">
      <input class="lab-val" placeholder="Valor" value="${esc(it.value)}" inputmode="decimal" aria-label="Valor">
      <input class="lab-unit" placeholder="Unidad" value="${esc(it.unit)}" aria-label="Unidad">
      <input class="lab-low" placeholder="Mín" value="${esc(fmtN(it.low))}" inputmode="decimal" aria-label="Referencia mínima">
      <input class="lab-high" placeholder="Máx" value="${esc(fmtN(it.high))}" inputmode="decimal" aria-label="Referencia máxima">
      <span class="lab-flag">${flagChip(f)}</span>
      <button type="button" class="icon-btn danger" data-rm-row aria-label="Quitar parámetro">${icon('x')}</button>
    </div>`;
  }

  function labForm(lab, opts = {}) {
    const isNew = !lab.id;
    const dup = isNew && state.labs.find(l => (lab.folio && l.folio === lab.folio) || (l.date === lab.date && (l.items || []).length === (lab.items || []).length));
    const items = (lab.items || []).length ? lab.items : [{ name: '', value: '', unit: '', low: null, high: null }];
    modal({
      title: opts.source === 'pdf' ? 'Revisar resultados' : isNew ? 'Nuevo análisis' : 'Editar análisis',
      submit: 'Guardar análisis',
      body: `
        ${opts.source === 'pdf' ? `<div class="banner">${icon('info')}<div class="small">Se leyeron <b>${items.length} parámetros</b> de <i>${esc(opts.fileName || 'tu PDF')}</i>. Revisa que coincidan con el documento y corrige lo necesario antes de guardar.</div></div>` : ''}
        ${dup ? `<div class="banner warn">${icon('alert')}<div class="small">Ya tienes un análisis del ${fmtDate(dup.date, { day: 'numeric', month: 'long' })}${dup.folio ? ' con folio ' + esc(dup.folio) : ''}. Si es el mismo, cancela para no duplicarlo.</div></div>` : ''}
        <div class="fields">
          <label class="field"><span>Fecha de la muestra</span><input type="date" name="date" required max="${today()}" value="${esc(lab.date || today())}"></label>
          <label class="field"><span>Laboratorio</span><input name="lab" value="${esc(lab.lab)}" placeholder="Ej. Laboratorio Chopo"></label>
        </div>
        <div class="fields">
          <label class="field"><span>Folio</span><input name="folio" value="${esc(lab.folio)}"></label>
          <label class="field"><span>Médico que lo solicitó</span><input name="doctor" value="${esc(lab.doctor)}"></label>
        </div>
        <div class="form-section">Resultados</div>
        <div class="lab-head small muted"><span>Parámetro</span><span>Valor</span><span>Unidad</span><span>Mín</span><span>Máx</span></div>
        <div id="labRows">${items.map(labRow).join('')}</div>
        <button type="button" class="btn outline small" data-add-row>${icon('plus')} Agregar parámetro</button>
        <label class="field"><span>Notas</span><textarea name="notes" placeholder="Ej. en ayuno de 12 h">${esc(lab.notes)}</textarea></label>`,
      onOpen: f => {
        let n = items.length;
        f.addEventListener('click', e => {
          if (e.target.closest('[data-add-row]')) {
            $('#labRows').insertAdjacentHTML('beforeend', labRow({ name: '', value: '', unit: '' }, n++));
            $('#labRows .lab-row:last-child .lab-name').focus();
          }
          const rm = e.target.closest('[data-rm-row]');
          if (rm) rm.closest('.lab-row').remove();
        });
        f.addEventListener('input', e => {
          const row = e.target.closest('.lab-row');
          if (!row) return;
          const it = readRow(row);
          $('.lab-flag', row).innerHTML = flagChip(labFlag(it));
        });
      },
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        const rows = $$('#labRows .lab-row', f).map(readRow).filter(it => it.name && it.value !== '');
        if (!rows.length) { toast('Agrega al menos un resultado'); return false; }
        const rec = Object.assign({}, lab, {
          id: lab.id || uid(), date: f.date.value, lab: f.lab.value.trim(), folio: f.folio.value.trim(),
          doctor: f.doctor.value.trim(), notes: f.notes.value.trim(), items: rows,
          source: lab.source || opts.source || 'manual', updated: new Date().toISOString()
        });
        await DB.put('labs', rec);
        await load();
        if (currentRoute !== 'analisis') location.hash = '#/analisis'; else render();
        const out = rows.filter(it => ['high', 'low'].includes(labFlag(it))).length;
        toast(`Análisis guardado${out ? ` · ${out} fuera de rango` : ''}`, 'check');
      }
    });
  }

  function readRow(row) {
    const v = sel => $(sel, row).value.trim();
    const n = s => s === '' ? null : (isNaN(parseFloat(s.replace(',', '.'))) ? null : parseFloat(s.replace(',', '.')));
    return { name: v('.lab-name'), value: v('.lab-val'), unit: v('.lab-unit'), low: n(v('.lab-low')), high: n(v('.lab-high')),
      group: row.dataset.group || '', refText: row.dataset.reftext || '' };
  }

  function labView(lab) {
    const groups = new Map();
    for (const it of lab.items || []) { const g = it.group || 'Resultados'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
    modal({
      title: cap(fmtDate(lab.date, { day: 'numeric', month: 'long', year: 'numeric' })),
      submit: 'Editar', cancel: 'Cerrar',
      body: `<div class="small muted">${esc([lab.lab, lab.folio && 'Folio ' + lab.folio, lab.doctor && 'Solicitó: ' + lab.doctor].filter(Boolean).join(' · '))}</div>
        ${[...groups].map(([g, its]) => `<div class="form-section">${esc(cap(g.toLowerCase()))}</div>
          <div class="list">${its.map(it => `<div class="item" style="padding:9px 0"><div class="item-body"><div class="item-title" style="font-weight:600">${esc(it.name)}</div>
            <div class="item-sub">Referencia: ${esc(refLabel(it))} ${esc(it.unit || '')}</div></div>
            <div style="text-align:right"><b class="num">${esc(it.value)}</b> <span class="small muted">${esc(it.unit || '')}</span><div>${flagChip(labFlag(it))}</div></div></div>`).join('')}</div>`).join('')}
        ${lab.notes ? `<div class="small"><b>Notas:</b> ${esc(lab.notes)}</div>` : ''}`,
      onSubmit: () => { setTimeout(() => labForm(lab), 0); }
    });
  }

  function labParamView(key) {
    const p = labParams().find(x => x.key === key);
    if (!p) return;
    modal({
      title: esc(p.name), submit: 'Cerrar', cancel: null,
      body: `<div class="small muted">Referencia actual: ${esc(refLabel(p.last))} ${esc(p.last.unit || '')}</div>
        <div id="labChart"></div>
        <div class="list">${p.history.slice().reverse().map(h => `<div class="item" style="padding:9px 0">
          <div class="item-body"><div class="item-title" style="font-weight:600">${cap(fmtDate(h.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</div></div>
          <b class="num">${esc(h.value)}</b> <span class="small muted">${esc(h.unit || '')}</span> ${flagChip(h.flag)}</div>`).join('')}</div>`,
      onOpen: () => {
        const pts = p.history.map(h => ({ x: at(h.date), y: parseFloat(String(h.value).replace(',', '.')) })).filter(pt => !isNaN(pt.y));
        const el = $('#labChart');
        if (pts.length < 2) { el.innerHTML = `<div class="small muted" style="padding:10px 0">La gráfica aparecerá cuando tengas al menos dos mediciones de este parámetro.</div>`; return; }
        const band = p.last.low != null && p.last.high != null ? [{ from: p.last.low, to: p.last.high, color: 'var(--bp-normal)' }] : [];
        el.innerHTML = Charts.lineChart({ width: el.clientWidth || 480, height: 200, label: p.name, bands: band,
          series: [{ name: p.name, color: 'var(--primary)', points: pts }] });
      },
      onSubmit: () => {}
    });
  }

  // Selector desde la Agenda o el botón "+": importar PDF o capturar
  function labChooser(extra = {}) {
    modal({
      title: 'Registrar resultados', submit: 'Captura manual', cancel: 'Cancelar',
      body: `<p class="small muted" style="margin-top:0">Importa el PDF que te dio el laboratorio (se lee en tu dispositivo) o captura los valores a mano.</p>
        <label class="btn block" style="min-height:56px">${icon('upload')} Importar PDF del laboratorio<input type="file" accept="application/pdf,.pdf" id="labChooserFile" hidden></label>`,
      onOpen: f => {
        $('#labChooserFile', f).onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          $('#modal').close();
          importLabPdf(file, extra);
        };
      },
      onSubmit: () => { setTimeout(() => labForm(Object.assign({ items: [] }, extra), { source: 'manual' }), 0); }
    });
  }

  // ======================================================
  //  DATOS DEL PACIENTE (se usan en los reportes)
  // ======================================================
  const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const INSTITUTIONS = ['IMSS', 'ISSSTE', 'IMSS-Bienestar', 'Pemex', 'Sedena / Semar', 'Seguro privado', 'Ninguna', 'Otra'];
  const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
  const listOf = v => Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
  const SEX = { M: 'Mujer', H: 'Hombre', X: 'No binario' };

  // La CURP contiene la fecha de nacimiento y el sexo
  function curpInfo(curp) {
    if (!CURP_RE.test(curp)) return null;
    const yy = +curp.slice(4, 6), mm = curp.slice(6, 8), dd = curp.slice(8, 10);
    const year = (/\d/.test(curp[16]) ? 1900 : 2000) + yy;
    return { birth: `${year}-${mm}-${dd}`, sex: curp[10] };
  }

  function fichaForm() {
    const s = state.settings;
    const opt = (list, v) => `<option value="">—</option>` + list.map(o => `<option ${v === o ? 'selected' : ''}>${o}</option>`).join('');
    modal({
      title: 'Datos del paciente',
      body: `
        <div class="form-section">Datos personales</div>
        <label class="field"><span>Nombre completo</span><input name="name" required autocomplete="name" value="${esc(s.name)}"></label>
        <label class="field"><span>CURP</span><input name="curp" maxlength="18" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="18 caracteres" value="${esc(s.curp)}" style="text-transform:uppercase">
          <small class="muted" id="curpHint">Al escribirla se completan la fecha de nacimiento y el sexo.</small></label>
        <div class="fields">
          <label class="field"><span>Fecha de nacimiento</span><input type="date" name="birth" max="${today()}" value="${esc(s.birth)}"></label>
          <label class="field"><span>Sexo</span><select name="sex"><option value="">—</option>${Object.entries(SEX).map(([k, l]) => `<option value="${k}" ${s.sex === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>

        <div class="form-section">Seguridad social</div>
        <div class="fields">
          <label class="field"><span>Institución</span><select name="institution">${opt(INSTITUTIONS, s.institution)}</select></label>
          <label class="field"><span>NSS / afiliación</span><input name="nss" inputmode="numeric" maxlength="20" autocomplete="off" value="${esc(s.nss)}" placeholder="11 dígitos (IMSS)"></label>
        </div>
        <label class="field"><span>Clínica / UMF / hospital</span><input name="clinic" value="${esc(s.clinic)}" placeholder="Ej. UMF 20, consultorio 5"></label>

        <div class="form-section">Salud</div>
        <div class="fields">
          <label class="field"><span>Tipo de sangre</span><select name="blood">${opt(BLOOD_TYPES, s.blood)}</select></label>
          <label class="field"><span>Estatura (cm)</span><input type="number" name="height" inputmode="decimal" min="40" max="250" step="0.5" value="${esc(s.height)}" placeholder="170"></label>
        </div>
        <label class="field"><span>Padecimientos (separados por coma o renglón)</span><textarea name="conditions" placeholder="Ej. Hipertensión arterial, Diabetes tipo 2">${esc(listOf(s.conditions).join(', '))}</textarea></label>
        <label class="field"><span>Alergias (separadas por coma o renglón)</span><textarea name="allergies" placeholder="Ej. Penicilina, Mariscos">${esc(listOf(s.allergies).join(', '))}</textarea></label>
        <label class="field"><span>Notas importantes</span><textarea name="fichaNotes" placeholder="Ej. Marcapasos, cirugías previas, donador de órganos…">${esc(s.fichaNotes)}</textarea></label>

        <div class="form-section">Contacto de emergencia</div>
        <label class="field"><span>Nombre</span><input name="emName" autocomplete="off" value="${esc(s.emName)}"></label>
        <div class="fields">
          <label class="field"><span>Parentesco</span><input name="emRel" value="${esc(s.emRel)}" placeholder="Ej. Esposa, hijo"></label>
          <label class="field"><span>Teléfono</span><input type="tel" name="emPhone" inputmode="tel" autocomplete="off" value="${esc(s.emPhone)}"></label>
        </div>

        <div class="form-section">Médico tratante</div>
        <div class="fields">
          <label class="field"><span>Nombre</span><input name="doctor" value="${esc(s.doctor)}"></label>
          <label class="field"><span>Teléfono</span><input type="tel" name="doctorPhone" inputmode="tel" value="${esc(s.doctorPhone)}"></label>
        </div>`,
      onOpen: f => {
        f.curp.addEventListener('input', () => {
          const pos = f.curp.selectionStart;
          f.curp.value = f.curp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
          try { f.curp.setSelectionRange(pos, pos); } catch (_) {}
          const info = curpInfo(f.curp.value), hint = $('#curpHint');
          if (f.curp.value.length === 18 && !info) { hint.textContent = 'La CURP no parece válida; revísala.'; hint.style.color = 'var(--danger)'; return; }
          hint.style.color = '';
          if (info) {
            if (!f.birth.value) f.birth.value = info.birth;
            if (!f.sex.value && SEX[info.sex]) f.sex.value = info.sex;
            hint.textContent = `CURP válida · ${fmtDate(info.birth, { day: 'numeric', month: 'long', year: 'numeric' })} · ${SEX[info.sex] || ''}`;
          } else hint.textContent = 'Al escribirla se completan la fecha de nacimiento y el sexo.';
        });
        f.nss.addEventListener('input', () => { f.nss.value = f.nss.value.replace(/[^\d-]/g, ''); });
      },
      onSubmit: async f => {
        if (!f.reportValidity()) return false;
        const curp = f.curp.value.trim().toUpperCase();
        if (curp && !CURP_RE.test(curp)) { toast('La CURP no es válida (18 caracteres)'); return false; }
        const nss = f.nss.value.replace(/\D/g, '');
        if (f.institution.value === 'IMSS' && nss && nss.length !== 11) { toast('El NSS del IMSS tiene 11 dígitos'); return false; }
        Object.assign(state.settings, {
          name: f.name.value.trim(), curp, birth: f.birth.value, sex: f.sex.value,
          institution: f.institution.value, nss: f.nss.value.trim(), clinic: f.clinic.value.trim(),
          blood: f.blood.value, height: f.height.value ? +f.height.value : null,
          conditions: listOf(f.conditions.value), allergies: listOf(f.allergies.value), fichaNotes: f.fichaNotes.value.trim(),
          emName: f.emName.value.trim(), emRel: f.emRel.value.trim(), emPhone: f.emPhone.value.trim(),
          doctor: f.doctor.value.trim(), doctorPhone: f.doctorPhone.value.trim()
        });
        await saveSettings();
        render(); toast('Datos guardados', 'check');
      }
    });
  }

  // ======================================================
  //  AJUSTES
  // ======================================================
  function notifStatus() {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return { txt: 'No compatible con este navegador', ok: false };
    if (Notification.permission === 'granted') return { txt: 'Activadas', ok: true };
    if (Notification.permission === 'denied') return { txt: 'Bloqueadas', ok: false, denied: true };
    return { txt: 'Sin activar', ok: false };
  }
  function accountCard() {
    if (!Cloud.configured) {
      return `<div class="card"><div class="card-head"><h3>${icon('cloud')} Cuenta</h3><span class="chip">Modo local</span></div>
        <p class="small muted" style="margin:0">La sincronización con Firebase no está configurada. Los datos se guardan solo en este dispositivo. Para activar el inicio de sesión, completa <code>js/firebase-config.js</code> (ver README).</p></div>`;
    }
    const u = Cloud.user;
    if (!u) return '';
    return `<div class="card"><div class="card-head"><h3>${icon('cloud')} Mi cuenta</h3>
        <span class="chip"><span class="sync-dot ${Cloud.online ? '' : 'off'}"></span>${Cloud.online ? 'Sincronizado' : 'Sin conexión'}</span></div>
      <div class="row" style="flex-wrap:nowrap">
        <div class="avatar-btn icon-btn" style="width:48px;height:48px;font-size:1.2rem;cursor:default">${avatarHTML(u)}</div>
        <div class="item-body"><div class="item-title">${esc(u.displayName || state.settings.name || 'Mi cuenta')}</div><div class="item-sub" style="overflow:hidden;text-overflow:ellipsis">${esc(u.email || '')}</div></div>
      </div>
      ${Cloud.online ? '' : '<p class="small muted">Puedes seguir usando la app; los cambios se subirán al recuperar la conexión.</p>'}
      <button class="btn outline block" style="margin-top:14px" data-act="logout">${icon('logout')} Cerrar sesión</button></div>`;
  }
  const avatarHTML = u => u.photoURL
    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`
    : esc((u.displayName || state.settings.name || u.email || '?').trim().charAt(0).toUpperCase());

  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function renderSettings() {
    const s = state.settings, ns = notifStatus();
    const sw = (key, title, sub, ic) => `<div class="setting"><div class="item-ic" style="background:var(--surface-2)">${icon(ic)}</div>
      <div class="item-body"><div class="item-title">${title}</div><div class="item-sub">${sub}</div></div>
      <label class="switch"><input type="checkbox" data-set="${key}" ${s[key] !== false ? 'checked' : ''}><span></span></label></div>`;
    const theme = document.documentElement.dataset.theme || 'auto';
    return `
    <div class="grid cols-2" style="align-items:start">
      <div class="stack-v">
        ${accountCard()}
        <div class="card">
          <div class="card-head"><h3>${icon('user')} Datos del paciente</h3></div>
          <p class="small muted" style="margin-top:0">Tu nombre, edad, tipo de sangre, padecimientos y alergias aparecen en los reportes.</p>
          <button class="btn outline" data-act="edit-ficha">${icon('edit')} Editar datos</button>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('bell')} Notificaciones</h3><span class="chip" style="${ns.ok ? 'color:var(--ok)' : ''}">${ns.txt}</span></div>
          ${!ns.ok && typeof Notification !== 'undefined' && Notification.permission !== 'denied' ? `<button class="btn block" data-act="enable-notif" style="margin-bottom:8px">${icon('bell')} Activar notificaciones</button>` : ''}
          ${ns.denied ? `<div class="banner warn small" style="margin-bottom:8px">${icon('alert')}<div>Bloqueaste las notificaciones. Habilítalas desde el candado 🔒 junto a la dirección o en la configuración del sitio.</div></div>` : ''}
          ${isIOS() && !isStandalone() ? `<div class="banner warn small" style="margin-bottom:8px">${icon('info')}<div>En iPhone/iPad primero instala la app: botón <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>, ábrela desde ahí y activa las notificaciones (iOS 16.4+).</div></div>` : ''}
          ${sw('notify', 'Recordatorios', 'Activar o pausar todos los avisos', 'bell')}
          ${sw('notifyMeds', 'Medicamentos', 'Aviso a la hora de cada dosis', 'pill')}
          ${sw('notifyAppts', 'Citas y exámenes', 'Según el recordatorio de cada evento', 'calendar')}
          ${sw('notifyBP', 'Tomar la presión', 'Recordatorio diario para medirte', 'heart')}
          ${sw('notifyWater', 'Tomar agua', 'Si vas atrasado con tu meta (ajústalo en Inicio → Agua)', 'droplet')}
          ${sw('notifyStock', 'Medicamento por acabarse', 'Aviso a las 10:00 cuando te alcance para pocos días', 'pill')}
          ${sw('weeklySummary', 'Resumen semanal', 'Domingo a las 19:00', 'chat')}
          <div class="field" style="padding:4px 0 12px"><span>Horarios para medir la presión</span><div id="bpTimes">${timesEditor(s.bpTimes || [], 'bpTimes')}</div></div>
          ${pushCard()}
          <button class="btn outline block" data-act="test-notif" ${ns.ok ? '' : 'disabled'} style="margin-top:8px">${icon('bell')} Enviar notificación de prueba (este dispositivo)</button>
          <p class="small muted" style="margin-bottom:0">Con los avisos de la app cerrada activos, el servidor te avisa aunque Latidia no esté abierta. Si no abres la app en 14 días, los recordatorios dejan de renovarse.</p>
        </div>
      </div>
      <div class="stack-v">
        <div class="card">
          <div class="card-head"><h3>${icon('install')} Instalación</h3><span class="chip" style="${isStandalone() ? 'color:var(--ok)' : ''}">${isStandalone() ? 'Instalada' : 'En navegador'}</span></div>
          ${state.installEvt ? `<button class="btn block" data-act="install">${icon('install')} Instalar Latidia</button>` :
            isStandalone() ? '<div class="muted small">Estás usando la app instalada. ✅</div>' :
            `<div class="small muted">${isIOS() ? 'Safari: <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>.' : 'Chrome/Edge: menú ⋮ → <b>Instalar aplicación</b> o el ícono de instalar en la barra de direcciones.'}</div>`}
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('sun')} Apariencia</h3></div>
          <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button data-act="theme" data-v="${v}" class="${theme === v ? 'active' : ''}">${l}</button>`).join('')}</div>
          <div class="small muted" style="margin:14px 0 6px">Tamaño del texto</div>
          <div class="seg">${[['normal', 'Normal'], ['grande', 'Grande'], ['muy', 'Muy grande']].map(([v, l]) => `<button data-act="text-size" data-v="${v}" class="${(s.textSize || 'normal') === v ? 'active' : ''}">${l}</button>`).join('')}</div>
          <button class="btn ghost small" data-act="onboarding" style="margin-top:14px">${icon('info')} Ver la guía de bienvenida</button>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('file')} Datos y respaldo</h3></div>
          <p class="small muted" style="margin-top:0">${Cloud.user ? 'Tus datos se guardan en tu cuenta y se sincronizan en todos tus dispositivos. También puedes descargar una copia en archivo.' : 'Tus datos se guardan solo en este dispositivo. Haz respaldos periódicos para no perderlos o para pasarlos a otro equipo.'}</p>
          <div class="row">
            <button class="btn outline" data-act="backup">${icon('download')} Exportar respaldo</button>
            <label class="btn outline">${icon('upload')} Importar<input type="file" accept="application/json,.json" id="importFile" hidden></label>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="demo">Cargar datos de ejemplo</button>
            <button class="btn ghost small" style="color:var(--danger)" data-act="wipe">${icon('trash')} Borrar todo</button></div>
        </div>
        <div class="card small muted">
          <b style="color:var(--text)">Latidia</b> es una herramienta de registro personal y no es un dispositivo médico. Ante valores alarmantes o síntomas, consulta a tu médico o acude a urgencias.
        </div>
      </div>
    </div>`;
  }
  routeById('ajustes').after = () => {
    $$('[data-set]').forEach(i => i.onchange = async () => { state.settings[i.dataset.set] = i.checked; await saveSettings(); toast('Guardado', 'check'); schedulePushSync(500); });
    $$('[data-set-text]').forEach(i => i.onchange = async () => { state.settings[i.dataset.setText] = i.value.trim(); await saveSettings(); toast('Guardado', 'check'); });
    const box = $('#bpTimes');
    bindTimes(box, async () => { state.settings.bpTimes = readTimes(box, 'bpTimes'); await saveSettings(); });
    $('#importFile').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!(await confirmDlg('Importar respaldo', 'Esto reemplazará los datos actuales por los del archivo. ¿Continuar?', 'Importar'))) return;
        await DB.importAll(data); await load(); render(); toast('Respaldo importado', 'check');
      } catch (err) { toast('No se pudo importar: ' + err.message); }
      e.target.value = '';
    };
  };

  // ---------- Datos de ejemplo ----------
  async function loadDemo() {
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      for (const [h, base] of [['07:30', 0], ['20:15', 4]]) {
        const ds = addDays(today(), -i);
        if (i === 0 && h > timeKey(now)) continue;
        const trend = Math.round((29 - i) * -0.3);
        const sys = 128 + base + trend + Math.round((Math.random() - .5) * 14);
        const dia = 83 + Math.round(base / 2) + Math.round(trend / 2) + Math.round((Math.random() - .5) * 10);
        await DB.put('vitals', { id: uid(), date: ds, time: h, sys, dia, pulse: 66 + Math.round(Math.random() * 16), arm: 'Izquierdo', position: 'Sentado', notes: '' });
      }
    }
    const m1 = { id: uid(), name: 'Losartán', dose: '50 mg', times: ['08:00', '20:00'], days: [0, 1, 2, 3, 4, 5, 6], start: addDays(today(), -30), end: '', notes: 'Con alimentos', active: true };
    const m2 = { id: uid(), name: 'Aspirina', dose: '100 mg', times: ['14:00'], days: [0, 1, 2, 3, 4, 5, 6], start: addDays(today(), -30), end: '', notes: '', active: true };
    await DB.put('meds', m1); await DB.put('meds', m2);
    for (let i = 7; i >= 1; i--) {
      const ds = addDays(today(), -i);
      for (const d of dosesForDate([m1, m2], ds)) if (Math.random() > .12) await DB.put('intakes', { id: d.key, medId: d.med.id, date: ds, time: d.time, status: 'taken', at: new Date().toISOString() });
    }
    await DB.put('appts', { id: uid(), type: 'consulta', title: 'Cardiología — control', doctor: 'Dr. Ejemplo', place: 'Clínica Central, consultorio 204', date: addDays(today(), 3), time: '10:30', remind: 60, remindDayBefore: true, notes: 'Llevar reporte de presión' });
    await DB.put('appts', { id: uid(), type: 'examen', title: 'Perfil lipídico y química sanguínea', doctor: 'Laboratorio', place: 'Laboratorio Norte', date: addDays(today(), 9), time: '07:00', remind: 120, remindDayBefore: true, notes: 'Ayuno de 12 horas' });
  }

  // ======================================================
  //  ACCIONES (delegación de eventos)
  // ======================================================
  const actions = {
    fab: () => quickMenu(),
    'dose-all': el => markDoses(el.dataset.keys.split(',')),
    'text-size': async el => { state.settings.textSize = el.dataset.v; applyTextSize(); await saveSettings(); render(); },
    onboarding: () => onboarding(0),
    'bp-goal': () => bpGoalForm(),
    'new-vital': () => vitalForm(),
    'edit-vital': el => vitalForm(state.vitals.find(v => v.id === el.dataset.id)),
    'del-vital': async el => {
      if (await confirmDlg('Eliminar registro', '¿Eliminar este registro de signos vitales?')) { await DB.del('vitals', el.dataset.id); await load(); render(); toast('Eliminado'); }
    },
    vrange: el => { state.vitalsRange = +el.dataset.v; render(); },

    'new-med': () => medForm(),
    'edit-med': el => medForm(state.meds.find(m => m.id === el.dataset.id)),
    'med-lib': () => medLibrary(),
    'med-refill': el => refillForm(state.meds.find(m => m.id === el.dataset.id)),
    adrange: el => { state.adRange = +el.dataset.v; render(); },
    'del-med': async el => {
      const m = state.meds.find(x => x.id === el.dataset.id);
      if (await confirmDlg('Eliminar medicamento', `¿Eliminar <b>${esc(m.name)}</b>? El historial de tomas se conserva.`)) { await DB.del('meds', m.id); await load(); render(); toast('Eliminado'); }
    },
    medday: el => { state.medDay = addDays(state.medDay, +el.dataset.v); render(); },
    dose: async el => {
      const key = el.dataset.key;
      if (state.intakes.some(i => i.id === key)) return intakeEditor(key);
      await markDose(key, 'taken');
    },
    'dose-skip': el => markDose(el.dataset.key, 'skipped'),
    'meds-today': () => { state.medDay = today(); location.hash = '#/medicamentos'; },
    'meds-ics': () => {
      const active = state.meds.filter(m => m.active !== false);
      download('medicamentos-latidia.ics', icsWrap(active.flatMap(medEvents)), 'text/calendar');
      toast('Abre el archivo para añadir las alarmas a tu calendario');
    },

    'new-appt': el => apptForm(null, el.dataset.d || state.calSel),
    'edit-appt': el => apptForm(state.appts.find(a => a.id === el.dataset.id)),
    'del-appt': async el => {
      if (await confirmDlg('Eliminar evento', '¿Eliminar esta cita o examen?')) { await DB.del('appts', el.dataset.id); await load(); render(); toast('Eliminado'); }
    },
    'appt-done': async el => {
      const a = state.appts.find(x => x.id === el.dataset.id);
      if (a.type === 'consulta') return consultOutcomeForm(a);
      a.done = true; await DB.put('appts', a); await load(); render(); toast('Marcada como realizada', 'check');
    },
    'appt-outcome': el => consultOutcomeForm(state.appts.find(x => x.id === el.dataset.id)),
    'appt-results': el => {
      const a = state.appts.find(x => x.id === el.dataset.id);
      labChooser({ date: a.date <= today() ? a.date : today(), lab: a.place || a.doctor || '', apptId: a.id });
    },
    'lab-manual': () => labForm({ items: [] }, { source: 'manual' }),
    'lab-view': el => labView(state.labs.find(l => l.id === el.dataset.id)),
    'lab-edit': el => labForm(state.labs.find(l => l.id === el.dataset.id)),
    'lab-del': async el => {
      const l = state.labs.find(x => x.id === el.dataset.id);
      if (await confirmDlg('Eliminar análisis', `¿Eliminar el análisis del ${fmtDate(l.date, { day: 'numeric', month: 'long', year: 'numeric' })} con ${(l.items || []).length} resultados?`)) {
        await DB.del('labs', l.id); await load(); render(); toast('Análisis eliminado');
      }
    },
    'lab-param': el => labParamView(el.dataset.k),
    'appt-ics': el => { const a = state.appts.find(x => x.id === el.dataset.id); download(`cita-${a.date}.ics`, icsWrap([apptEvent(a)]), 'text/calendar'); },
    'appts-ics': () => {
      const nowKey = today() + 'T' + timeKey(new Date());
      const list = state.appts.filter(a => !a.done && (a.date + 'T' + (a.time || '23:59')) >= nowKey);
      download('citas-latidia.ics', icsWrap(list.map(apptEvent)), 'text/calendar');
    },
    calsel: el => {
      state.calSel = el.dataset.d;
      const d = at(el.dataset.d);
      if (d.getMonth() !== state.calMonth.getMonth()) state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      render();
    },
    calnav: el => { const m = state.calMonth; state.calMonth = new Date(m.getFullYear(), m.getMonth() + +el.dataset.v, 1); render(); },
    caltoday: () => { state.calSel = today(); state.calMonth = null; render(); },

    rpreset: el => { const [from, to] = reportPreset(el.dataset.v); Object.assign(state.report, { preset: el.dataset.v, from, to }); render(); },
    pdf: async el => {
      const label = el.innerHTML;
      el.disabled = true; el.innerHTML = 'Generando…';
      try {
        await ReportPDF.load();
        const blob = ReportPDF.build(pdfData());
        const nm = (state.settings.name || 'paciente').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
        await deliverFile(blob, `Reporte-presion_${nm}_${state.report.from}_a_${state.report.to}.pdf`, 'Reporte de presión arterial');
      } catch (e) { console.error(e); toast(e.message || 'No se pudo generar el PDF'); }
      finally { el.disabled = false; el.innerHTML = label; }
    },
    csv: () => deliverFile(new Blob([reportCSV()], { type: 'text/csv;charset=utf-8' }), `presion-${state.report.from}_a_${state.report.to}.csv`, 'Registros de presión arterial'),
    'enable-notif': enableNotifications,
    'push-enable': async el => {
      el.disabled = true; el.textContent = 'Activando…';
      try {
        if (Notification.permission !== 'granted') await Notification.requestPermission();
        await pushSync(true);
        toast('Avisos con la app cerrada activados', 'check');
      } catch (e) { state.push.error = e.message; toast('No se pudo activar: ' + e.message); }
      render();
    },
    'push-test': async el => {
      el.disabled = true;
      try {
        const r = await fetch(PUSH.url + '/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await Cloud.idToken() }, body: '{}' });
        const d = await r.json();
        toast(d.delivered ? `Enviada a ${d.delivered} dispositivo${d.delivered === 1 ? '' : 's'}. Cierra la app para comprobar.` : 'El servidor no pudo entregarla', d.delivered ? 'check' : 'alert');
      } catch (e) { toast('Error: ' + e.message); }
      el.disabled = false;
    },
    'test-notif': async () => {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('🔔 Notificación de prueba', { body: '¡Las notificaciones de Latidia funcionan!', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'test' });
    },
    install: async () => {
      if (!state.installEvt) return;
      state.installEvt.prompt();
      await state.installEvt.userChoice;
      state.installEvt = null; render();
    },
    theme: el => setTheme(el.dataset.v),
    'edit-ficha': () => fichaForm(),
    'water-add': el => addWater(el.dataset.ml),
    'water-goal': () => waterGoalForm(),
    'home-layout': () => homeLayoutForm(),
    'habit-add': el => addHabit(el.dataset.type, el.dataset.v),
    'habit-minus': el => removeLastHabit(el.dataset.type),
    'habit-goals': () => habitGoalsForm(),
    'share-week': () => shareText('Mi semana en Latidia', summaryText('week')),
    'share-consult': () => shareText('Resumen para mi consulta', summaryText('consult')),
    'summary-pdf': () => { state.report = { preset: '', from: summarySince(), to: today(), meds: true, labs: true }; location.hash = '#/reportes'; },
    'q-done': async el => {
      state.settings.questions = (state.settings.questions || []).map(q => q.id === el.dataset.id ? Object.assign({}, q, { done: true, answeredAt: today() }) : q);
      await saveSettings(); render();
    },
    'q-del': async el => {
      state.settings.questions = (state.settings.questions || []).filter(q => q.id !== el.dataset.id);
      await saveSettings(); render();
    },
    'water-custom': () => modal({
      title: 'Agregar agua',
      body: `<label class="field"><span>Cantidad (ml)</span><input type="number" name="ml" inputmode="numeric" min="10" max="5000" step="10" value="350" required></label>`,
      onSubmit: async f => { if (!f.reportValidity()) return false; setTimeout(() => addWater(f.ml.value), 0); }
    }),
    'water-del': async el => {
      const w = state.water.find(x => x.id === el.dataset.id);
      if (!w) return;
      await DB.del('water', w.id); await load(); render();
      toast(`Se quitaron ${w.ml} ml`, 'x', { label: 'Deshacer', fn: async () => { await DB.put('water', w); await load(); render(); } });
    },
    logout: async () => {
      if (!(await confirmDlg('Cerrar sesión', 'Tus datos seguirán guardados en tu cuenta. En este dispositivo se borrará la copia local y dejarás de recibir recordatorios hasta que vuelvas a iniciar sesión.', 'Cerrar sesión'))) return;
      await pushUnsubscribe();
      await Cloud.signOut();
    },
    backup: async () => download(`respaldo-latidia-${today()}.json`, JSON.stringify(await DB.exportAll(), null, 1), 'application/json'),
    demo: async () => {
      if (!(await confirmDlg('Datos de ejemplo', 'Se agregarán 30 días de lecturas, 2 medicamentos y 2 citas de ejemplo a tus datos.', 'Agregar'))) return;
      await loadDemo(); await load(); render(); toast('Datos de ejemplo cargados', 'check');
    },
    wipe: async () => {
      if (!(await confirmDlg('Borrar todo', `Se eliminarán <b>todos</b> tus registros, medicamentos, citas y ajustes ${Cloud.user ? 'de tu cuenta y de <b>todos tus dispositivos</b>' : 'de este dispositivo'}. Esta acción no se puede deshacer.`, 'Borrar todo'))) return;
      for (const s of ['vitals', 'meds', 'intakes', 'appts', 'labs', 'kv']) await DB.clear(s);
      await load(); render(); toast('Datos eliminados');
    }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (fn) { e.preventDefault(); Promise.resolve(fn(el)).catch(err => { console.error(err); toast('Error: ' + err.message); }); }
  });

  // ---------- Tema ----------
  function setTheme(v) {
    if (v === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = v;
    try { v === 'auto' ? localStorage.removeItem('ms-theme') : localStorage.setItem('ms-theme', v); } catch (_) {}
    syncThemeColor();
    render();
  }
  // La barra de estado sigue el tema elegido en la app (no solo el del sistema)
  function syncThemeColor() {
    const t = document.documentElement.dataset.theme;
    $$('meta[name="theme-color"]').forEach(m => {
      if (!m.dataset.media) m.dataset.media = m.getAttribute('media') || '';
      if (t) { m.removeAttribute('media'); m.content = t === 'dark' ? '#0a1220' : '#f3f6fa'; }
      else { m.setAttribute('media', m.dataset.media); m.content = m.dataset.media.includes('dark') ? '#0a1220' : '#f3f6fa'; }
    });
  }
  syncThemeColor();
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  function updateHeaderButtons() {
    $('#themeBtn').innerHTML = icon(isDark() ? 'sun' : 'moon');
    const on = typeof Notification !== 'undefined' && Notification.permission === 'granted' && state.settings.notify !== false;
    const pending = pendingDoses().length;
    $('#bellBtn').innerHTML = icon('bell') + (pending ? `<span class="badge">${pending > 9 ? '9+' : pending}</span>` : '');
    $('#bellBtn').classList.toggle('on', on);
    $('#bellBtn').title = pending ? `${pending} dosis pendiente${pending === 1 ? '' : 's'}` : 'Notificaciones';
    const ab = $('#accountBtn');
    ab.hidden = !Cloud.user;
    if (Cloud.user) ab.innerHTML = avatarHTML(Cloud.user);
    const ib = $('#installBtn');
    ib.hidden = !state.installEvt;
    ib.innerHTML = icon('install') + ' Instalar app';
  }
  $('#themeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');
  $('#bellBtn').onclick = () => openNotifCenter();
  $('#installBtn').onclick = () => actions.install();
  $('#accountBtn').onclick = () => { location.hash = '#/ajustes'; };

  // ======================================================
  //  NOTIFICACIONES
  // ======================================================
  // Dosis de hoy cuya hora ya pasó y no se han marcado
  function pendingDoses() {
    const im = intakeMap(), now = new Date(), ds = today();
    return dosesForDate(state.meds, ds).filter(d => !im.has(d.key) && at(ds, d.time) <= now);
  }

  // Próximos avisos en las siguientes 24 h
  function upcomingReminders() {
    const now = new Date(), limit = new Date(now.getTime() + 86400000), s = state.settings, out = [];
    const im = intakeMap();
    for (const ds of [today(), addDays(today(), 1)]) {
      if (s.notifyMeds !== false) {
        for (const d of dosesForDate(state.meds, ds)) {
          const when = at(ds, d.time);
          if (when > now && when <= limit && !im.has(d.key)) out.push({ when, ic: 'pill', title: d.med.name, sub: doseLabel(d.med) });
        }
      }
      if (s.notifyBP !== false) {
        for (const t of s.bpTimes || []) {
          const when = at(ds, t);
          if (when > now && when <= limit) out.push({ when, ic: 'heart', title: 'Tomar la presión', sub: 'Recordatorio diario' });
        }
      }
    }
    if (s.notifyAppts !== false) {
      for (const a of state.appts) {
        if (a.done) continue;
        const when = at(a.date, a.time || '08:00');
        if (when > now && when <= limit) out.push({ when, ic: (APPT_TYPES[a.type] || APPT_TYPES.otro).icon, title: a.title, sub: [(APPT_TYPES[a.type] || APPT_TYPES.otro).label, a.place].filter(Boolean).join(' · ') });
      }
    }
    return out.sort((a, b) => a.when - b.when).slice(0, 8);
  }

  let notifLog = [];
  function notifCenterHTML() {
    const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    const pend = pendingDoses(), up = upcomingReminders();
    const nowKey = today() + 'T' + timeKey(new Date());
    const appts = state.appts.filter(a => !a.done && (a.date + 'T' + (a.time || '23:59')) >= nowKey).slice(0, 3);
    const whenTxt = d => `${relDay(dateKey(d))} ${timeKey(d)}`;
    const ago = iso => {
      const m = Math.round((Date.now() - new Date(iso)) / 60000);
      return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    };
    const logIc = { med: 'pill', bp: 'heart', appt: 'calendar', water: 'droplet', stock: 'pill', week: 'chat' };
    return `
      ${perm !== 'granted' ? `<div class="banner ${perm === 'denied' ? 'warn' : ''}">${icon('bell')}<div class="item-body small">${
        perm === 'denied' ? 'Las notificaciones están bloqueadas. Habilítalas en la configuración del navegador o del iPhone (Ajustes → Notificaciones → Latidia).'
        : perm === 'unsupported' ? (isIOS() && !isStandalone() ? 'En iPhone instala primero la app en la pantalla de inicio para recibir notificaciones.' : 'Este navegador no admite notificaciones.')
        : 'Activa las notificaciones para recibir tus recordatorios.'}</div>
        ${perm === 'default' ? `<button type="button" class="btn small" data-act="enable-notif">Activar</button>` : ''}</div>` : ''}

      <div class="notif-section"><h3>${icon('alert')} Pendientes de hoy ${pend.length ? `<span class="chip" style="color:var(--warn)">${pend.length}</span>` : ''}</h3>
        ${pend.length ? `<div class="list">${pend.map(d => `<div class="item">
          ${medIc(d.med)}
          <div class="item-body"><div class="item-title">${esc(d.med.name)}</div><div class="item-sub">${d.time}${doseLabel(d.med) ? ' · ' + esc(doseLabel(d.med)) : ''}</div></div>
          <div class="item-actions"><button type="button" class="icon-btn" data-act="dose-skip" data-key="${d.key}" title="Omitir" aria-label="Omitir">${icon('skip')}</button>
          <button type="button" class="btn small" data-act="dose" data-key="${d.key}">${icon('check')} Tomada</button></div></div>`).join('')}</div>`
          : `<div class="small muted">No tienes dosis pendientes. ✅</div>`}</div>

      <div class="notif-section"><h3>${icon('clock')} Próximas 24 horas</h3>
        ${up.length ? `<div class="list">${up.map(r => `<div class="item">
          <div class="item-ic" style="background:var(--surface-2)">${icon(r.ic)}</div>
          <div class="item-body"><div class="item-title">${esc(r.title)}</div><div class="item-sub">${esc(r.sub)}</div></div>
          <span class="chip">${whenTxt(r.when)}</span></div>`).join('')}</div>`
          : `<div class="small muted">Sin recordatorios en las próximas 24 horas.</div>`}</div>

      ${appts.length ? `<div class="notif-section"><h3>${icon('calendar')} Próximas citas</h3><div class="list">${appts.map(a => {
        const t = APPT_TYPES[a.type] || APPT_TYPES.otro;
        return `<div class="item"><div class="item-ic" style="background:color-mix(in srgb, ${t.color} 15%, transparent);color:${t.color}">${icon(t.icon)}</div>
          <div class="item-body"><div class="item-title">${esc(a.title)}</div><div class="item-sub">${relDay(a.date)}${a.time ? ' · ' + a.time : ''}${a.place ? ' · ' + esc(a.place) : ''}</div></div></div>`;
      }).join('')}</div></div>` : ''}

      <div class="notif-section"><h3>${icon('bell')} Avisos recibidos</h3>
        ${notifLog.length ? `<div class="list">${notifLog.slice(0, 15).map(n => `<div class="item">
          <div class="item-ic" style="background:var(--surface-2)">${icon(logIc[n.kind] || 'bell')}</div>
          <div class="item-body"><div class="item-title">${esc(n.title.replace(/^\W+\s*/u, ''))}</div><div class="item-sub">${esc(n.body)}</div></div>
          <span class="small muted" style="white-space:nowrap">${ago(n.at)}</span></div>`).join('')}</div>`
          : `<div class="small muted">Aquí aparecerán los avisos que te envíe la app en este dispositivo.</div>`}</div>`;
  }

  async function openNotifCenter() {
    notifLog = await DB.getKV('notiflog', []);
    modal({
      title: 'Notificaciones', body: notifCenterHTML(), submit: 'Configurar avisos', cancel: 'Cerrar',
      onSubmit: () => { location.hash = '#/ajustes'; }
    });
    $('#modalForm').dataset.panel = 'notifs';
  }
  function refreshNotifCenter() {
    const f = $('#modalForm');
    if ($('#modal').open && f.dataset.panel === 'notifs') $('.modal-body', f).innerHTML = notifCenterHTML();
  }
  // ======================================================
  //  NOTIFICACIONES CON LA APP CERRADA (servidor Web Push)
  // ======================================================
  const PUSH = window.PUSH_CONFIG || {};
  const pushSupported = () => !!(PUSH.url && PUSH.vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined');
  const b64uBytes = s => {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0));
  };
  const sameBytes = (a, b) => { a = new Uint8Array(a); if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const randomHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => x.toString(16).padStart(2, '0')).join('');
  state.push = { last: 0, error: '', busy: false };

  let pushTimer = null;
  function schedulePushSync(delay) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushSync().catch(e => { state.push.error = e.message; console.warn('push', e); }), delay ?? 3000);
  }

  // Suscribe este dispositivo y envía al servidor los recordatorios de los próximos 14 días.
  // Las llamadas se encadenan: dos sincronizaciones simultáneas creaban registros duplicados.
  let pushChain = Promise.resolve();
  function pushSync(force) {
    const run = pushChain.then(() => pushSyncNow(force));
    pushChain = run.catch(() => {});
    return run;
  }

  async function pushSyncNow(force) {
    if (!pushSupported() || !Cloud.user || Notification.permission !== 'granted') return false;
    const reg = state.reg || await navigator.serviceWorker.ready;
    const key = b64uBytes(PUSH.vapidPublicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey && !sameBytes(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

    // Identificador estable: derivado de la dirección push (el mismo teléfono = el mismo id)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint));
    const devId = Array.from(new Uint8Array(digest).slice(0, 12), x => x.toString(16).padStart(2, '0')).join('');
    let dev = await DB.getKV('pushDevice', null);
    if (!dev || dev.id !== devId) { dev = { id: devId, secret: (dev && dev.secret) || randomHex(24) }; await DB.setKV('pushDevice', dev); }
    const reminders = state.settings.notify === false ? [] : await MS.pushReminders(14);
    const done = state.intakes.filter(i => i.date >= addDays(today(), -1)).map(i => 'med:' + i.id);
    const subJson = sub.toJSON();

    // Evita escrituras innecesarias: solo si algo cambió o pasaron 6 h
    const hash = JSON.stringify([subJson.endpoint, reminders.map(r => r.id + r.at + r.body), done]);
    const prev = await DB.getKV('pushHash', null);
    const last = await DB.getKV('pushActive', 0);
    if (!force && prev === hash && Date.now() - last < 6 * 3600000) { state.push.last = last; return true; }

    const token = await Cloud.idToken();
    const r = await fetch(PUSH.url + '/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ deviceId: dev.id, secret: dev.secret, subscription: subJson, reminders, done })
    });
    if (!r.ok) throw new Error('El servidor respondió ' + r.status);
    const now = Date.now();
    await DB.setKV('pushActive', now);
    await DB.setKV('pushHash', hash);
    await DB.setKV('pushCfg', { url: PUSH.url, uid: Cloud.user.uid, deviceId: dev.id, secret: dev.secret });
    state.push.last = now; state.push.error = '';
    if (currentRoute === 'ajustes' && !$('#modal').open) render();
    return true;
  }

  async function pushUnsubscribe() {
    try {
      const dev = await DB.getKV('pushDevice', null);
      if (PUSH.url && Cloud.user && dev) {
        await fetch(PUSH.url + '/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await Cloud.idToken() },
          body: JSON.stringify({ deviceId: dev.id })
        });
      }
      const reg = state.reg || await navigator.serviceWorker.ready;
      const sub = reg && reg.pushManager && await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (e) { console.warn('push', e); }
    for (const k of ['pushActive', 'pushHash', 'pushCfg']) await DB.del('kv', k);
    state.push.last = 0;
  }

  function pushCard() {
    if (!PUSH.url) return '';
    const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    const ok = state.push.last && Date.now() - state.push.last < 36 * 3600000;
    let status, action = '';
    if (!pushSupported()) status = isIOS() && !isStandalone() ? 'Instala la app en la pantalla de inicio para activarlos.' : 'Este navegador no admite notificaciones push.';
    else if (perm !== 'granted') status = 'Activa primero las notificaciones.';
    else if (ok) {
      const mins = Math.round((Date.now() - state.push.last) / 60000);
      status = `Activos ✓ · sincronizado ${mins < 1 ? 'hace un momento' : mins < 60 ? `hace ${mins} min` : `hace ${Math.round(mins / 60)} h`}`;
      action = `<button class="btn outline small" data-act="push-test">${icon('bell')} Probar</button>`;
    } else {
      status = state.push.error ? 'Error: ' + state.push.error : 'Sin activar en este dispositivo.';
      action = `<button class="btn small" data-act="push-enable">${icon('cloud')} Activar</button>`;
    }
    return `<div class="setting"><div class="item-ic" style="background:${ok ? 'color-mix(in srgb, var(--ok) 15%, transparent)' : 'var(--surface-2)'};color:${ok ? 'var(--ok)' : 'inherit'}">${icon('cloud')}</div>
      <div class="item-body"><div class="item-title">Avisos con la app cerrada</div><div class="item-sub">${esc(status)}</div></div>${action}</div>
      ${ok ? `<div class="setting"><div class="item-ic" style="background:var(--surface-2)">${icon('clock')}</div>
        <div class="item-body"><div class="item-title">Repetir si no marco la dosis</div><div class="item-sub">Segundo aviso 30 min después</div></div>
        <label class="switch"><input type="checkbox" data-set="pushRepeat" ${state.settings.pushRepeat !== false ? 'checked' : ''}><span></span></label></div>` : ''}`;
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      toast(isIOS() ? 'En iPhone, instala primero la app en la pantalla de inicio' : 'Este navegador no soporta notificaciones');
      return;
    }
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      state.settings.notify = true; await saveSettings();
      await registerPeriodicSync();
      toast('Notificaciones activadas', 'bell');
      checkReminders();
      pushSync(true).catch(e => { state.push.error = e.message; });
    } else toast('Permiso de notificaciones no concedido');
    render();
  }

  async function registerPeriodicSync() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!('periodicSync' in reg)) return;
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') await reg.periodicSync.register('medicsoft-reminders', { minInterval: 15 * 60 * 1000 });
    } catch (_) { /* no soportado */ }
  }

  let checking = false;
  async function checkReminders() {
    if (checking || !state.reg) return;
    checking = true;
    try { await MS.runReminders(state.reg); } catch (e) { console.warn(e); }
    checking = false;
  }

  // ======================================================
  //  LOGIN
  // ======================================================
  const LOGO = $('.brand-logo').innerHTML;
  const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  let authMode = 'login', pendingName = '';

  function showScreen(which) {
    $('#auth').hidden = which === 'app';
    $('#app').hidden = which !== 'app';
    $('#bottomNav').hidden = which !== 'app';
  }

  function renderAuth(mode) {
    authMode = mode || authMode;
    const m = authMode;
    $('#auth').innerHTML = `
      <div class="card auth-card">
        <div class="auth-brand"><span class="brand-logo">${LOGO}</span><h1>Latidia</h1>
          <div class="muted small">Tu presión, medicamentos y citas médicas, sincronizados en todos tus dispositivos.</div></div>
        ${m === 'reset'
          ? `<h2 style="margin-bottom:6px">Recuperar contraseña</h2><p class="small muted" style="margin-top:0">Te enviaremos un enlace a tu correo para crear una nueva contraseña.</p>`
          : `<div class="seg" style="margin-bottom:16px"><button type="button" data-mode="login" class="${m === 'login' ? 'active' : ''}">Iniciar sesión</button>
             <button type="button" data-mode="signup" class="${m === 'signup' ? 'active' : ''}">Crear cuenta</button></div>`}
        <form id="authForm" novalidate>
          ${m === 'signup' ? `<label class="field"><span>Nombre</span><input name="name" autocomplete="name" required placeholder="Tu nombre"></label>` : ''}
          <label class="field"><span>Correo electrónico</span><input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tucorreo@ejemplo.com"></label>
          ${m !== 'reset' ? `<label class="field"><span>Contraseña</span><div class="pw"><input name="pass" type="password" required minlength="6"
            autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" placeholder="${m === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}">
            <button type="button" class="icon-btn" data-pw aria-label="Mostrar contraseña">${icon('eye')}</button></div></label>` : ''}
          <div class="auth-error" id="authError" role="alert"></div>
          <button class="btn block" type="submit">${m === 'login' ? 'Entrar' : m === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}</button>
          ${m === 'login' ? `<button type="button" class="link-btn" data-mode="reset">¿Olvidaste tu contraseña?</button>` : ''}
          ${m === 'reset' ? `<button type="button" class="link-btn" data-mode="login">← Volver a iniciar sesión</button>` : ''}
        </form>
        ${m !== 'reset' ? `<div class="divider" style="margin:18px 0">o</div>
          <button type="button" class="btn block btn-google" data-google>${GOOGLE} Continuar con Google</button>` : ''}
        <p class="small muted" style="text-align:center;margin:18px 0 0">🔒 Solo tú puedes ver tus datos de salud.</p>
      </div>`;
    const root = $('#auth'), form = $('#authForm'), err = $('#authError');
    const submitBtn = form.querySelector('[type=submit]'), submitLabel = submitBtn.innerHTML;
    const busy = on => {
      $$('button', root).forEach(b => { b.disabled = on; });
      submitBtn.innerHTML = on ? 'Un momento…' : submitLabel;
    };
    root.onclick = e => {
      const mb = e.target.closest('[data-mode]');
      if (mb) { const email = form.email.value; renderAuth(mb.dataset.mode); $('#authForm').email.value = email; return; }
      const pw = e.target.closest('[data-pw]');
      if (pw) {
        const i = form.pass;
        i.type = i.type === 'password' ? 'text' : 'password';
        pw.innerHTML = icon(i.type === 'password' ? 'eye' : 'eyeOff');
        return;
      }
      if (e.target.closest('[data-google]')) {
        err.textContent = '';
        busy(true);
        Cloud.signInGoogle().catch(x => { err.textContent = x.message; }).finally(() => busy(false));
      }
    };
    form.onsubmit = async e => {
      e.preventDefault();
      err.textContent = '';
      if (!form.reportValidity()) return;
      busy(true);
      try {
        const email = form.email.value.trim();
        if (m === 'login') await Cloud.signIn(email, form.pass.value);
        else if (m === 'signup') { pendingName = form.name.value.trim(); await Cloud.signUp(pendingName, email, form.pass.value); }
        else {
          await Cloud.resetPassword(email);
          renderAuth('login');
          $('#authForm').email.value = email;
          toast('Te enviamos un correo para restablecer tu contraseña', 'mail');
          return;
        }
      } catch (x) { err.textContent = x.message; }
      busy(false);
    };
    showScreen('auth');
    setTimeout(() => (form.name || form.email).focus(), 50);
  }

  function renderCloudError() {
    $('#auth').innerHTML = `<div class="card auth-card" style="text-align:center">
      <div class="auth-brand"><span class="brand-logo">${LOGO}</span><h1>Latidia</h1></div>
      <p><b>No se pudo conectar</b></p>
      <p class="muted small">Necesitas conexión a internet la primera vez que abres la app para iniciar sesión.</p>
      <button class="btn block" onclick="location.reload()">Reintentar</button></div>`;
    showScreen('auth');
  }

  // ======================================================
  //  ARRANQUE
  // ======================================================
  let started = false, pendingRender = false;
  // La guía aparece solo la primera vez y sin datos; a quien ya usaba la app se le marca como vista
  async function maybeOnboard() {
    if (state.settings.onboarded) return;
    if (state.vitals.length || state.meds.length || state.appts.length) { state.settings.onboarded = true; await saveSettings(); return; }
    if (!$('#modal').open) onboarding(0);
  }
  function refreshSoon() {
    if (!started) return;
    load().then(() => {
      if (state.loading && (state.vitals.length || state.meds.length || state.appts.length)) { state.loading = false; maybeOnboard(); }
      if ($('#modal').open && $('#modalForm').dataset.panel !== 'notifs') pendingRender = true; else render();
    });
  }
  $('#modal').addEventListener('close', () => { if (pendingRender) { pendingRender = false; render(); } });

  async function startApp() {
    showScreen('app');
    await load();
    state.push.last = await DB.getKV('pushActive', 0);
    if (Cloud.user) schedulePushSync(1500);
    const nm = pendingName || (Cloud.user && Cloud.user.displayName);
    if (nm && !state.settings.name) { state.settings.name = nm; await saveSettings(); }
    pendingName = '';
    const empty = !state.vitals.length && !state.meds.length && !state.appts.length;
    if (Cloud.user && empty && !state.settings.onboarded) {
      state.loading = true; // datos de la nube en camino
      setTimeout(() => { if (state.loading) { state.loading = false; render(); maybeOnboard(); } }, 5000);
    }
    render();
    if (!state.loading) maybeOnboard();
    checkReminders();
    if (!started) {
      started = true;
      setInterval(checkReminders, 30000);
      setInterval(() => { if (Cloud.user) schedulePushSync(0); }, 3600000);
      // Refresca la vista de inicio cada minuto (estados "pendiente", etc.)
      setInterval(() => { if (currentRoute === 'inicio' && !$('#modal').open && document.visibilityState === 'visible') render(); }, 60000);
    }
  }

  window.addEventListener('cloud-data', refreshSoon);
  window.addEventListener('sync-status', () => {
    if (!started) return;
    updateHeaderButtons();
    if (currentRoute === 'ajustes' && !$('#modal').open) render();
  });
  window.addEventListener('legacy-uploaded', () => toast('Los datos de este dispositivo se subieron a tu cuenta', 'cloud'));
  window.addEventListener('auth-changed', e => {
    if (e.detail) { startApp(); return; }
    if ($('#modal').open) $('#modal').close();
    Object.assign(state, { vitals: [], meds: [], intakes: [], appts: [] });
    renderAuth('login');
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installEvt = e; if (started) render(); });
  window.addEventListener('appinstalled', () => { state.installEvt = null; toast('¡App instalada!', 'check'); if (started) render(); });
  window.addEventListener('hashchange', () => { if (started) render(); });
  window.addEventListener('scroll', () => $('.topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });
  let rz, lastW = innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { // solo cambios de ancho (evita re-render al abrir el teclado en móvil)
      if (started && innerWidth !== lastW && $('[data-chart]') && !$('#modal').open) render();
      lastW = innerWidth;
    }, 200);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => updateHeaderButtons());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && started) { refreshSoon(); checkReminders(); }
  });

  (async function init() {
    buildNav();
    const splash = document.createElement('div');
    splash.className = 'splash';
    splash.innerHTML = `<span class="brand-logo">${LOGO}</span>`;
    document.body.appendChild(splash);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(reg => {
        state.reg = reg;
        navigator.serviceWorker.addEventListener('message', e => {
          if (e.data && e.data.type === 'data-changed') { if (Cloud.flushOutbox) Cloud.flushOutbox(); refreshSoon(); }
        });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') registerPeriodicSync();
        checkReminders();
        // Busca versión nueva cada vez que vuelves a la app (en iPhone queda suspendida, no se recarga)
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
        setInterval(() => reg.update().catch(() => {}), 3600000);
      }).catch(e => console.warn('SW no registrado', e));
      // Cuando se instala una versión nueva: recarga sola, o pregunta si estás llenando un formulario
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        const go = () => { reloading = true; location.reload(); };
        if ($('#modal').open) toast('Hay una nueva versión de Latidia', 'info', { label: 'Actualizar', fn: go });
        else go();
      });
    }
    await Cloud.ready;
    splash.remove();
    if (Cloud.configured && Cloud.failed) renderCloudError();
    else if (Cloud.configured && !Cloud.user) renderAuth('login');
    else await startApp();
  })();
})();
