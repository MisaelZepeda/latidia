/* MedicSoft — aplicación principal */
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
  const STRENGTH_UNITS = ['mg', 'g', 'mcg', 'ml', 'UI', 'mg/ml', 'mg/5 ml', '%'];
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
    const [settings, vitals, meds, intakes, appts] = await Promise.all([
      DB.getKV('settings', {}), DB.all('vitals'), DB.all('meds'), DB.all('intakes'), DB.all('appts')
    ]);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    if (!settings.bpTimes) await DB.setKV('settings', state.settings); // el service worker lee estos valores
    state.vitals = vitals.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    state.meds = meds.sort((a, b) => a.name.localeCompare(b.name));
    state.intakes = intakes;
    state.appts = appts.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  }
  const saveSettings = () => DB.setKV('settings', state.settings);
  const intakeMap = () => new Map(state.intakes.map(i => [i.id, i]));

  // ---------- UI helpers ----------
  function toast(msg, ic) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (ic ? icon(ic) : '') + esc(msg);
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function modal({ title, body, submit = 'Guardar', cancel = 'Cancelar', danger = false, onSubmit, onOpen }) {
    const dlg = $('#modal'), old = $('#modalForm');
    const form = old.cloneNode(false); // formulario nuevo: sin listeners de modales anteriores
    old.replaceWith(form);
    delete form.dataset.panel;
    form.innerHTML = `
      <div class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-close>${cancel}</button>
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
    { id: 'reportes', label: 'Reportes', title: 'Reportes', icon: 'report', render: renderReports },
    { id: 'ajustes', label: 'Ajustes', title: 'Ajustes', icon: 'settings', render: renderSettings }
  ];
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { route: ROUTES.find(r => r.id === path) || ROUTES[0], params: new URLSearchParams(qs || '') };
  }
  function buildNav() {
    const links = ROUTES.map(r => `<a href="#/${r.id}" data-route="${r.id}">${icon(r.icon)}<span>${r.label}</span></a>`).join('');
    $('#nav').innerHTML = links;
    $('#bottomNav').innerHTML = links;
  }
  let currentRoute = null;
  function render() {
    const { route, params } = parseHash();
    const changed = currentRoute !== route.id;
    currentRoute = route.id;
    $('#pageTitle').textContent = route.title;
    document.title = `${route.title} · MedicSoft`;
    $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route.id));
    const view = $('#view');
    view.innerHTML = route.render();
    if (route.fab) view.insertAdjacentHTML('beforeend', `<button class="fab" data-act="fab" aria-label="Agregar">${icon('plus')}</button>`);
    if (route.after) route.after();
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
    const nowKey = today() + 'T' + timeKey(new Date());
    const upcoming = state.appts.filter(a => !a.done && (a.date + 'T' + (a.time || '23:59')) >= nowKey);
    const next = upcoming[0];

    const banners = [];
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      banners.push(`<div class="banner">${icon('bell')}<div class="item-body"><b>Activa las notificaciones</b><div class="small muted">Para recibir recordatorios de medicamentos, citas y tomas de presión.</div></div><button class="btn small" data-act="enable-notif">Activar</button></div>`);
    }
    if (!isStandalone() && state.installEvt) {
      banners.push(`<div class="banner">${icon('install')}<div class="item-body"><b>Instala MedicSoft</b><div class="small muted">Acceso rápido y notificaciones en tu celular o computadora.</div></div><button class="btn small" data-act="install">Instalar</button></div>`);
    }

    const cat = last && bpCategory(last.sys, last.dia);
    return `
    <div class="stack-v">
      <div><div class="muted">${cap(fmtLong(today()))}</div><h2 style="font-size:1.5rem">${greet}${s.name ? ', ' + esc(s.name.split(' ')[0]) : ''} 👋</h2></div>
      ${banners.join('')}
      <div class="grid cols-2">
        <div class="card hero">
          <div class="row between"><span class="row" style="gap:8px">${icon('heart')}<b>Última presión</b></span>
          ${last ? `<span class="chip">${relDay(last.date)} · ${last.time}</span>` : ''}</div>
          ${last ? `
            <div class="big num" style="margin:14px 0 6px">${last.sys}/${last.dia} <small>mmHg</small></div>
            <div class="row">${last.pulse ? `<span class="chip">${icon('pulse')} ${last.pulse} lpm</span>` : ''}<span class="chip"><span class="dot" style="color:${cat.color}"></span>${cat.label}</span></div>`
            : `<div style="margin:18px 0" class="muted">Aún no tienes registros. Registra tu primera toma.</div>`}
          <div style="margin-top:16px;position:relative;z-index:1"><button class="btn" style="background:#fff;color:#0f766e" data-act="new-vital">${icon('plus')} Registrar toma</button></div>
        </div>
        <div class="grid stats">
          <div class="card stat">${statIc('trend', 'var(--sys)')}<div><div class="label">Promedio 7 días</div><div class="value num">${wBP.length ? `${avg(wBP.map(v => v.sys))}/${avg(wBP.map(v => v.dia))}` : '—'}</div></div></div>
          <div class="card stat">${statIc('pulse', 'var(--pulse)')}<div><div class="label">Pulso promedio</div><div class="value num">${wP.length ? avg(wP.map(v => v.pulse)) : '—'} <small>lpm</small></div></div></div>
          <div class="card stat">${statIc('pill', 'var(--primary)')}<div><div class="label">Dosis de hoy</div><div class="value num">${takenN}/${doses.length}</div></div></div>
          <div class="card stat">${statIc('calendar', 'var(--warn)')}<div style="min-width:0"><div class="label">Próxima cita</div><div class="value" style="font-size:1rem">${next ? relDay(next.date) + (next.time ? ' ' + next.time : '') : '—'}</div></div></div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h3>${icon('pill')} Medicamentos de hoy</h3><a href="#/medicamentos" class="small">Ver todo</a></div>
          ${doses.length ? `<div class="progress" style="margin-bottom:6px"><div style="width:${Math.round(takenN * 100 / doses.length)}%"></div></div>
            <div class="list">${doses.map(d => doseItem(d, im)).join('')}</div>`
            : emptyState('pill', 'No hay dosis programadas hoy', `<button class="btn ghost small" style="margin-top:10px" data-act="new-med">${icon('plus')} Agregar medicamento</button>`)}
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('calendar')} Próximas citas y exámenes</h3><a href="#/agenda" class="small">Agenda</a></div>
          ${upcoming.length ? `<div class="list">${upcoming.slice(0, 4).map(apptItem).join('')}</div>`
            : emptyState('calendar', 'Sin citas próximas', `<button class="btn ghost small" style="margin-top:10px" data-act="new-appt">${icon('plus')} Agendar</button>`)}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('activity')} Tendencia (14 días)</h3><a href="#/reportes" class="small">Reporte completo</a></div>
        <div data-chart="home"></div>
      </div>
    </div>`;
  }
  ROUTES[0].after = () => drawBPChart($('[data-chart="home"]'), state.vitals.filter(v => v.date > addDays(today(), -14)), 220);

  function drawBPChart(el, vitals, height) {
    if (!el) return;
    const bp = vitals.filter(v => v.sys && v.dia);
    const pul = vitals.filter(v => v.pulse);
    el.innerHTML = Charts.lineChart({
      width: el.clientWidth, height, label: 'Presión arterial y pulso',
      bands: bp.length ? [{ from: 90, to: 120, color: 'var(--bp-normal)' }] : [],
      series: [
        { name: 'Sistólica', color: 'var(--sys)', points: bp.map(v => ({ x: vitalTime(v), y: v.sys })) },
        { name: 'Diastólica', color: 'var(--dia)', points: bp.map(v => ({ x: vitalTime(v), y: v.dia })) },
        { name: 'Pulso', color: 'var(--pulse)', dashed: true, points: pul.map(v => ({ x: vitalTime(v), y: v.pulse })) }
      ]
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
      <div class="card"><div class="card-head"><h3>${icon('activity')} Presión y pulso</h3><span class="small muted">Franja verde: sistólica normal (90–120)</span></div><div data-chart="vitals"></div></div>
      <div class="card">
        <div class="card-head"><h3>${icon('list')} Registros <span class="chip">${list.length}</span></h3></div>
        ${list.length ? `<div class="list">${list.map(vitalItem).join('')}</div>` : emptyState('heart', 'No hay registros en este periodo')}
      </div>
    </div>`;
  }
  ROUTES[1].after = () => {
    const r = state.vitalsRange;
    drawBPChart($('[data-chart="vitals"]'), r ? state.vitals.filter(v => v.date > addDays(today(), -r)) : state.vitals, 260);
  };

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
        </div>
        <div class="item-sub row" style="gap:4px 12px">${relDay(v.date)} · ${v.time}
          ${extras.map(e => `<span class="row" style="gap:3px">${e.replace('class="ic ', 'style="width:14px;height:14px" class="ic ')}</span>`).join('')}
          ${v.arm || v.position ? `<span>${[v.arm, v.position].filter(Boolean).join(', ')}</span>` : ''}</div>
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
    const val = k => v[k] != null ? esc(v[k]) : '';
    const sel = (name, opts) => `<select name="${name}"><option value="">—</option>${opts.map(o => `<option ${v[name] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    modal({
      title: v.id ? 'Editar registro' : 'Nuevo registro',
      body: `
        <div class="fields"><label class="field"><span>Fecha</span><input type="date" name="date" value="${val('date')}" max="${today()}" required></label>
        <label class="field"><span>Hora</span><input type="time" name="time" value="${val('time')}" required></label></div>
        <div class="fields" style="grid-template-columns:repeat(3,1fr)">
          <label class="field"><span style="color:var(--sys)">Sistólica</span><input class="big" type="number" inputmode="numeric" name="sys" min="50" max="300" placeholder="120" value="${val('sys')}"></label>
          <label class="field"><span style="color:var(--dia)">Diastólica</span><input class="big" type="number" inputmode="numeric" name="dia" min="30" max="200" placeholder="80" value="${val('dia')}"></label>
          <label class="field"><span style="color:var(--pulse)">Pulso</span><input class="big" type="number" inputmode="numeric" name="pulse" min="20" max="250" placeholder="70" value="${val('pulse')}"></label>
        </div>
        <div id="bpPreview" style="min-height:24px"></div>
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
          const c = bpCategory(num(f.sys.value), num(f.dia.value));
          $('#bpPreview').innerHTML = c ? catChip(c) + (c.id === 'crisis' ? ' <span class="small" style="color:var(--danger)">Si tienes síntomas, busca atención médica de inmediato.</span>' : '') : '';
        };
        f.addEventListener('input', upd); upd();
        if (!v.id) f.sys.focus();
      },
      onSubmit: async f => {
        const d = {
          id: v.id || uid(), date: f.date.value, time: f.time.value,
          sys: num(f.sys.value), dia: num(f.dia.value), pulse: num(f.pulse.value),
          temp: num(f.temp.value), spo2: num(f.spo2.value), glucose: num(f.glucose.value), weight: num(f.weight.value),
          arm: f.arm.value, position: f.position.value, notes: f.notes.value.trim()
        };
        if (!f.reportValidity()) return false;
        if ((d.sys == null) !== (d.dia == null)) { toast('Ingresa sistólica y diastólica'); return false; }
        if (d.sys != null && d.sys <= d.dia) { toast('La sistólica debe ser mayor que la diastólica'); return false; }
        if ([d.sys, d.pulse, d.temp, d.spo2, d.glucose, d.weight].every(x => x == null)) { toast('Ingresa al menos un valor'); return false; }
        await DB.put('vitals', d);
        await load(); render(); toast('Registro guardado', 'check');
      }
    });
  }

  // ======================================================
  //  MEDICAMENTOS
  // ======================================================
  function doseItem(d, im) {
    const st = im.get(d.key)?.status;
    const past = at(d.key.split('|')[1], d.time) < new Date();
    return `<div class="item dose ${st || ''}">
      <button class="dose-btn ${st || ''}" data-act="dose" data-key="${d.key}" aria-label="${st ? 'Deshacer' : 'Marcar como tomada'}">${icon(st === 'skipped' ? 'skip' : 'check')}</button>
      <div class="item-body"><div class="item-title">${esc(d.med.name)}</div>
        <div class="item-sub">${d.time}${doseLabel(d.med) ? ' · ' + esc(doseLabel(d.med)) : ''}${st === 'taken' ? ' · <span style="color:var(--ok)">Tomada</span>' : st === 'skipped' ? ' · Omitida' : past ? ' · <span style="color:var(--warn)">Pendiente</span>' : ''}</div></div>
      ${st ? '' : `<button class="icon-btn" data-act="dose-skip" data-key="${d.key}" title="Omitir" aria-label="Omitir">${icon('skip')}</button>`}
    </div>`;
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
    const ad = adherence(addDays(today(), -6), today());
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
          <div class="card-head"><h3>${icon('trend')} Adherencia (7 días)</h3><span class="bp-val">${ad.pct == null ? '—' : ad.pct + '%'}</span></div>
          ${ad.scheduled ? `<div class="progress"><div style="width:${ad.pct}%"></div></div>
            <div class="small muted" style="margin:6px 0 12px">${ad.taken} tomadas · ${ad.skipped} omitidas · ${ad.scheduled - ad.taken - ad.skipped} sin marcar</div>
            <div class="list">${ad.per.map(p => `<div class="item"><div class="item-body"><div class="item-title">${esc(p.med.name)}</div>
              <div class="progress" style="margin-top:6px"><div style="width:${Math.round(p.taken * 100 / p.scheduled)}%"></div></div></div>
              <span class="num small">${p.taken}/${p.scheduled}</span></div>`).join('')}</div>`
            : emptyState('trend', 'Aún no hay dosis para calcular')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${icon('pill')} Mis medicamentos</h3>
          <div class="row">${state.meds.length ? `<button class="btn outline small" data-act="meds-ics" title="Crea eventos repetitivos con alarma en el calendario de tu teléfono">${icon('calPlus')}<span class="hide-mobile">Añadir a calendario</span></button>` : ''}
          <button class="btn small hide-mobile" data-act="new-med">${icon('plus')} Agregar</button></div></div>
        ${state.meds.length ? `<div class="list">${state.meds.map(m => `
          <div class="item" style="${m.active === false ? 'opacity:.55' : ''}">
            <div class="item-ic" style="background:var(--primary-soft);color:var(--primary)">${icon('pill')}</div>
            <div class="item-body"><div class="item-title">${esc(m.name)} ${doseLabel(m) ? `<span class="muted" style="font-weight:400">· ${esc(doseLabel(m))}</span>` : ''}</div>
              <div class="item-sub">${esc(schedLabel(m))}${m.end ? ' · hasta ' + fmtDate(m.end, { day: 'numeric', month: 'short' }) : ''}${m.active === false ? ' · Pausado' : ''}</div>
              ${m.active !== false && MS.isInterval(m) ? (() => { const n = MS.nextDoses(m, new Date(), 1)[0]; return n ? `<div class="item-sub" style="color:var(--primary)">Próxima toma: ${relDay(n.date)} ${n.time}</div>` : ''; })() : ''}
              ${m.notes ? `<div class="item-sub">${esc(m.notes)}</div>` : ''}</div>
            <div class="item-actions">
              <button class="icon-btn" data-act="edit-med" data-id="${m.id}" aria-label="Editar">${icon('edit')}</button>
              <button class="icon-btn danger" data-act="del-med" data-id="${m.id}" aria-label="Eliminar">${icon('trash')}</button></div>
          </div>`).join('')}</div>`
          : emptyState('pill', 'No has agregado medicamentos', `<button class="btn ghost small" style="margin-top:10px" data-act="new-med">${icon('plus')} Agregar medicamento</button>`)}
      </div>
    </div>`;
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
    m = m || { mode: 'interval', every: 8, firstTime: round5, qty: 1, form: 'tableta', unit: 'mg', times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], start: today(), active: true };
    const legacy = !m.form && !m.strength && !m.qty ? parseLegacyDose(m.dose) : {};
    const v = Object.assign({}, m, legacy);
    const mode = MS.isInterval(m) ? 'interval' : m.id ? 'times' : 'interval';
    const days = v.days && v.days.length ? v.days : [0, 1, 2, 3, 4, 5, 6];
    const order = [1, 2, 3, 4, 5, 6, 0];
    const durDays = v.start && v.end ? Math.round((at(v.end) - at(v.start)) / 86400000) + 1 : '';
    const everyOpts = EVERY_OPTS.some(([h]) => h === Number(v.every)) ? EVERY_OPTS : [...EVERY_OPTS, [Number(v.every), `Cada ${v.every} horas`]];
    modal({
      title: m.id ? 'Editar medicamento' : 'Nuevo medicamento',
      body: `
        <label class="field"><span>Nombre del medicamento</span><input name="name" required placeholder="Ej. Losartán, Paracetamol…" value="${esc(v.name)}"></label>
        <label class="field"><span>Presentación</span><select name="form"><option value="">Seleccionar…</option>
          ${Object.entries(PRESENTATIONS).map(([k, P]) => `<option value="${k}" ${v.form === k ? 'selected' : ''}>${P.label}</option>`).join('')}</select></label>
        <div class="fields">
          <div class="field"><span>Dosis / concentración</span><div class="combo">
            <input name="strength" type="number" inputmode="decimal" step="any" min="0" placeholder="50" value="${esc(v.strength)}">
            <select name="unit" aria-label="Unidad">${STRENGTH_UNITS.map(u => `<option ${v.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
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
        <div class="preview-box" id="medPreview"></div>
        <label class="field"><span>Indicaciones</span><textarea name="notes" placeholder="Ej. en ayunas, con alimentos…">${esc(v.notes)}</textarea></label>
        <label class="check"><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}> Activo (recibir recordatorios)</label>`,
      onOpen: f => {
        bindTimes(f);
        const draft = () => ({
          id: m.id || 'draft', mode: f.mode.value, every: +f.every.value, firstTime: f.firstTime.value || '08:00',
          times: readTimes(f, 'times'), days: $$('input[name="days"]:checked', f).map(i => +i.value),
          start: f.start.value || today(), end: f.end.value, active: true,
          form: f.form.value, qty: f.qty.value, strength: f.strength.value, unit: f.unit.value
        });
        const update = () => {
          const P = PRESENTATIONS[f.form.value];
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
          strength: f.strength.value ? +f.strength.value : null, unit: f.unit.value,
          qty: f.qty.value ? +f.qty.value : null, mode: modeV, every: +f.every.value, firstTime: f.firstTime.value,
          times: times.length ? times : (m.times || []), days: dsel.length ? dsel : (m.days || []),
          start: f.start.value, end: f.end.value, notes: f.notes.value.trim(), active: f.active.checked
        });
        med.dose = doseLabel(Object.assign({}, med, { dose: m.dose || '' }));
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
        ${a.notes ? `<div class="item-sub">${esc(a.notes)}</div>` : ''}</div>
      <div class="item-actions">
        ${!a.done ? `<button class="icon-btn" data-act="appt-done" data-id="${a.id}" title="Marcar como realizada" aria-label="Realizada">${icon('check')}</button>` : ''}
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
  const icsWrap = events => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedicSoft//ES', 'CALSCALE:GREGORIAN', ...events.flat(), 'END:VCALENDAR'].join('\r\n');

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
            <td class="small">${[v.temp && v.temp + '°C', v.spo2 && 'SpO₂ ' + v.spo2 + '%', v.glucose && v.glucose + ' mg/dL', v.weight && v.weight + ' kg', v.arm, v.position].filter(Boolean).join(' · ')}</td>
            <td class="wrap small">${esc(v.notes)}</td></tr>`; }).join('')}
          </tbody></table></div></div>
        <p class="small muted">Este reporte es informativo y no sustituye la valoración de un profesional de la salud.</p>`}
      </div>
    </div>`;
  }
  ROUTES[4].after = () => {
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
  };

  function ageFrom(birth) {
    if (!birth) return '';
    const b = at(birth), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a >= 0 && a < 130 ? `${a} años` : '';
  }

  function pdfData() {
    const r = state.report, s = state.settings;
    const { list, bp, pul, cats, periods } = reportData();
    const mm = (arr, k) => arr.length ? `${Math.min(...arr.map(v => v[k]))} - ${Math.max(...arr.map(v => v[k]))}` : '';
    const ad = r.meds && state.meds.length ? adherence(r.from, r.to) : null;
    const long = ds => fmtDate(ds, { day: 'numeric', month: 'long', year: 'numeric' });
    return {
      title: 'Reporte de presión arterial y frecuencia cardiaca',
      patient: s.name, doctor: s.doctor, age: ageFrom(s.birth),
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
      list: list.map(v => ({
        ts: +vitalTime(v), time: v.time, sys: v.sys, dia: v.dia, pulse: v.pulse, cat: bpCategory(v.sys, v.dia),
        dateLabel: cap(fmtDate(v.date, { weekday: 'short' })).replace('.', '') + ' ' + fmtDate(v.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
        other: [v.temp && v.temp + ' °C', v.spo2 && 'SpO2 ' + v.spo2 + '%', v.glucose && v.glucose + ' mg/dL', v.weight && v.weight + ' kg', v.arm, v.position].filter(Boolean).join(' · '),
        notes: v.notes || ''
      }))
    };
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
    const rows = [['Fecha', 'Hora', 'Sistólica', 'Diastólica', 'Pulso', 'Clasificación', 'Temperatura', 'SpO2', 'Glucosa', 'Peso', 'Brazo', 'Posición', 'Notas']];
    for (const v of list) {
      const c = bpCategory(v.sys, v.dia);
      rows.push([v.date, v.time, v.sys, v.dia, v.pulse, c ? c.label : '', v.temp, v.spo2, v.glucose, v.weight, v.arm, v.position, v.notes]);
    }
    return '\uFEFF' + rows.map(r => r.map(q).join(';')).join('\r\n');
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
          <div class="card-head"><h3>${icon('user')} Perfil</h3></div>
          <div class="stack-v" style="gap:12px">
            <label class="field"><span>Nombre (aparece en los reportes)</span><input data-set-text="name" value="${esc(s.name)}" placeholder="Tu nombre"></label>
            <label class="field"><span>Médico tratante</span><input data-set-text="doctor" value="${esc(s.doctor)}" placeholder="Opcional"></label>
            <label class="field"><span>Fecha de nacimiento (para mostrar la edad en el reporte)</span><input type="date" data-set-text="birth" value="${esc(s.birth)}" max="${today()}"></label>
          </div>
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
          <div class="field" style="padding:4px 0 12px"><span>Horarios para medir la presión</span><div id="bpTimes">${timesEditor(s.bpTimes || [], 'bpTimes')}</div></div>
          <button class="btn outline block" data-act="test-notif" ${ns.ok ? '' : 'disabled'}>${icon('bell')} Enviar notificación de prueba</button>
          <p class="small muted" style="margin-bottom:0">Los avisos se envían mientras la app esté abierta o minimizada. Para alarmas 100% garantizadas con la app cerrada, usa <b>Añadir a calendario</b> en Medicamentos y Agenda.</p>
        </div>
      </div>
      <div class="stack-v">
        <div class="card">
          <div class="card-head"><h3>${icon('install')} Instalación</h3><span class="chip" style="${isStandalone() ? 'color:var(--ok)' : ''}">${isStandalone() ? 'Instalada' : 'En navegador'}</span></div>
          ${state.installEvt ? `<button class="btn block" data-act="install">${icon('install')} Instalar MedicSoft</button>` :
            isStandalone() ? '<div class="muted small">Estás usando la app instalada. ✅</div>' :
            `<div class="small muted">${isIOS() ? 'Safari: <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>.' : 'Chrome/Edge: menú ⋮ → <b>Instalar aplicación</b> o el ícono de instalar en la barra de direcciones.'}</div>`}
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('sun')} Apariencia</h3></div>
          <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button data-act="theme" data-v="${v}" class="${theme === v ? 'active' : ''}">${l}</button>`).join('')}</div>
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
          <b style="color:var(--text)">MedicSoft</b> es una herramienta de registro personal y no es un dispositivo médico. Ante valores alarmantes o síntomas, consulta a tu médico o acude a urgencias.
        </div>
      </div>
    </div>`;
  }
  ROUTES[5].after = () => {
    $$('[data-set]').forEach(i => i.onchange = async () => { state.settings[i.dataset.set] = i.checked; await saveSettings(); toast('Guardado', 'check'); });
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
    fab: () => parseHash().route.fab(),
    'new-vital': () => vitalForm(),
    'edit-vital': el => vitalForm(state.vitals.find(v => v.id === el.dataset.id)),
    'del-vital': async el => {
      if (await confirmDlg('Eliminar registro', '¿Eliminar este registro de signos vitales?')) { await DB.del('vitals', el.dataset.id); await load(); render(); toast('Eliminado'); }
    },
    vrange: el => { state.vitalsRange = +el.dataset.v; render(); },

    'new-med': () => medForm(),
    'edit-med': el => medForm(state.meds.find(m => m.id === el.dataset.id)),
    'del-med': async el => {
      const m = state.meds.find(x => x.id === el.dataset.id);
      if (await confirmDlg('Eliminar medicamento', `¿Eliminar <b>${esc(m.name)}</b>? El historial de tomas se conserva.`)) { await DB.del('meds', m.id); await load(); render(); toast('Eliminado'); }
    },
    medday: el => { state.medDay = addDays(state.medDay, +el.dataset.v); render(); },
    dose: async el => {
      const key = el.dataset.key;
      const prev = state.intakes.find(i => i.id === key);
      if (prev) {
        const [medId, ds, t] = key.split('|');
        const med = state.meds.find(m => m.id === medId);
        const what = prev.status === 'taken' ? 'tomada' : 'omitida';
        const when = prev.at ? ` (registrada ${new Date(prev.at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })})` : '';
        if (!(await confirmDlg('Desmarcar toma',
          `¿Quitar la marca de <b>${what}</b> de ${esc(med ? med.name : 'este medicamento')} ${['Hoy', 'Ayer', 'Mañana'].includes(relDay(ds)) ? 'de ' + relDay(ds).toLowerCase() : 'del ' + relDay(ds)} a las ${t}${when}?`,
          'Sí, desmarcar'))) return;
        await DB.del('intakes', key);
        toast('Toma desmarcada');
      } else await MS.markTaken(key, 'taken');
      await load(); render();
    },
    'dose-skip': async el => { await MS.markTaken(el.dataset.key, 'skipped'); await load(); render(); },
    'meds-ics': () => {
      const active = state.meds.filter(m => m.active !== false);
      download('medicamentos-medicsoft.ics', icsWrap(active.flatMap(medEvents)), 'text/calendar');
      toast('Abre el archivo para añadir las alarmas a tu calendario');
    },

    'new-appt': el => apptForm(null, el.dataset.d || state.calSel),
    'edit-appt': el => apptForm(state.appts.find(a => a.id === el.dataset.id)),
    'del-appt': async el => {
      if (await confirmDlg('Eliminar evento', '¿Eliminar esta cita o examen?')) { await DB.del('appts', el.dataset.id); await load(); render(); toast('Eliminado'); }
    },
    'appt-done': async el => { const a = state.appts.find(x => x.id === el.dataset.id); a.done = true; await DB.put('appts', a); await load(); render(); toast('Marcada como realizada', 'check'); },
    'appt-ics': el => { const a = state.appts.find(x => x.id === el.dataset.id); download(`cita-${a.date}.ics`, icsWrap([apptEvent(a)]), 'text/calendar'); },
    'appts-ics': () => {
      const nowKey = today() + 'T' + timeKey(new Date());
      const list = state.appts.filter(a => !a.done && (a.date + 'T' + (a.time || '23:59')) >= nowKey);
      download('citas-medicsoft.ics', icsWrap(list.map(apptEvent)), 'text/calendar');
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
    'test-notif': async () => {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('🔔 Notificación de prueba', { body: '¡Las notificaciones de MedicSoft funcionan!', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'test' });
    },
    install: async () => {
      if (!state.installEvt) return;
      state.installEvt.prompt();
      await state.installEvt.userChoice;
      state.installEvt = null; render();
    },
    theme: el => setTheme(el.dataset.v),
    logout: async () => {
      if (!(await confirmDlg('Cerrar sesión', 'Tus datos seguirán guardados en tu cuenta. En este dispositivo se borrará la copia local y dejarás de recibir recordatorios hasta que vuelvas a iniciar sesión.', 'Cerrar sesión'))) return;
      await Cloud.signOut();
    },
    backup: async () => download(`respaldo-medicsoft-${today()}.json`, JSON.stringify(await DB.exportAll(), null, 1), 'application/json'),
    demo: async () => {
      if (!(await confirmDlg('Datos de ejemplo', 'Se agregarán 30 días de lecturas, 2 medicamentos y 2 citas de ejemplo a tus datos.', 'Agregar'))) return;
      await loadDemo(); await load(); render(); toast('Datos de ejemplo cargados', 'check');
    },
    wipe: async () => {
      if (!(await confirmDlg('Borrar todo', `Se eliminarán <b>todos</b> tus registros, medicamentos, citas y ajustes ${Cloud.user ? 'de tu cuenta y de <b>todos tus dispositivos</b>' : 'de este dispositivo'}. Esta acción no se puede deshacer.`, 'Borrar todo'))) return;
      for (const s of ['vitals', 'meds', 'intakes', 'appts', 'kv']) await DB.clear(s);
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
    render();
  }
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
    const logIc = { med: 'pill', bp: 'heart', appt: 'calendar' };
    return `
      ${perm !== 'granted' ? `<div class="banner ${perm === 'denied' ? 'warn' : ''}">${icon('bell')}<div class="item-body small">${
        perm === 'denied' ? 'Las notificaciones están bloqueadas. Habilítalas en la configuración del navegador o del iPhone (Ajustes → Notificaciones → MedicSoft).'
        : perm === 'unsupported' ? (isIOS() && !isStandalone() ? 'En iPhone instala primero la app en la pantalla de inicio para recibir notificaciones.' : 'Este navegador no admite notificaciones.')
        : 'Activa las notificaciones para recibir tus recordatorios.'}</div>
        ${perm === 'default' ? `<button type="button" class="btn small" data-act="enable-notif">Activar</button>` : ''}</div>` : ''}

      <div class="notif-section"><h3>${icon('alert')} Pendientes de hoy ${pend.length ? `<span class="chip" style="color:var(--warn)">${pend.length}</span>` : ''}</h3>
        ${pend.length ? `<div class="list">${pend.map(d => `<div class="item">
          <div class="item-ic" style="background:color-mix(in srgb, var(--warn) 15%, transparent);color:var(--warn)">${icon('pill')}</div>
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
        <div class="auth-brand"><span class="brand-logo">${LOGO}</span><h1>MedicSoft</h1>
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
      <div class="auth-brand"><span class="brand-logo">${LOGO}</span><h1>MedicSoft</h1></div>
      <p><b>No se pudo conectar</b></p>
      <p class="muted small">Necesitas conexión a internet la primera vez que abres la app para iniciar sesión.</p>
      <button class="btn block" onclick="location.reload()">Reintentar</button></div>`;
    showScreen('auth');
  }

  // ======================================================
  //  ARRANQUE
  // ======================================================
  let started = false, pendingRender = false;
  function refreshSoon() {
    if (!started) return;
    load().then(() => {
      if ($('#modal').open && $('#modalForm').dataset.panel !== 'notifs') pendingRender = true; else render();
    });
  }
  $('#modal').addEventListener('close', () => { if (pendingRender) { pendingRender = false; render(); } });

  async function startApp() {
    showScreen('app');
    await load();
    const nm = pendingName || (Cloud.user && Cloud.user.displayName);
    if (nm && !state.settings.name) { state.settings.name = nm; await saveSettings(); }
    pendingName = '';
    render();
    checkReminders();
    if (!started) {
      started = true;
      setInterval(checkReminders, 30000);
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
      }).catch(e => console.warn('SW no registrado', e));
    }
    await Cloud.ready;
    splash.remove();
    if (Cloud.configured && Cloud.failed) renderCloudError();
    else if (Cloud.configured && !Cloud.user) renderAuth('login');
    else await startApp();
  })();
})();
