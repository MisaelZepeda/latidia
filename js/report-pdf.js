/* Latidia — reporte PDF profesional (tamaño carta) con jsPDF */
(function (g) {
  'use strict';
  const LIBS = [
    'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.8/dist/jspdf.plugin.autotable.min.js'
  ];
  let loading = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el generador de PDF. Revisa tu conexión.'));
      document.head.appendChild(s);
    });
  }
  const ready = () => !!(g.jspdf && g.jspdf.jsPDF && (g.jspdf_autotable || (g.jspdf.jsPDF.API && g.jspdf.jsPDF.API.autoTable)));
  function load() {
    if (ready()) return Promise.resolve();
    if (!loading) loading = LIBS.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve()).catch(e => { loading = null; throw e; });
    return loading;
  }

  // ---------- Estilo ----------
  const C = {
    primary: [29, 78, 216], primarySoft: [219, 234, 254], text: [15, 26, 43], muted: [90, 102, 120],
    line: [214, 221, 232], zebra: [245, 248, 252], box: [241, 245, 251],
    sys: [225, 29, 72], dia: [37, 99, 235], pulse: [147, 51, 234], band: [222, 244, 228]
  };
  const CAT_RGB = { normal: [22, 163, 74], elev: [202, 138, 4], h1: [234, 88, 12], h2: [220, 38, 38], crisis: [127, 29, 29], low: [2, 132, 199] };
  // Las fuentes estándar de PDF solo cubren Latin-1
  const L = s => String(s ?? '').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/₂/g, '2').replace(/[^\x00-\xFF]/g, '').trim();

  function build(R) {
    const { jsPDF } = g.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
    const autoTable = (opts) => {
      if (typeof doc.autoTable === 'function') doc.autoTable(opts);
      else (g.jspdf_autotable.autoTable || g.jspdf_autotable.default)(doc, opts);
      return doc.lastAutoTable.finalY;
    };
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 16, CW = W - 2 * M, BOTTOM = H - 18;
    doc.setProperties({ title: L(R.title), subject: 'Reporte de presión arterial', author: L(R.patient || 'Latidia'), creator: 'Latidia' });

    const color = (fn, c) => doc[fn](c[0], c[1], c[2]);
    const font = (size, style = 'normal', c = C.text) => { doc.setFont('helvetica', style); doc.setFontSize(size); color('setTextColor', c); };
    let y = 0;
    const ensure = need => { if (y + need > BOTTOM) { doc.addPage(); y = M + 4; } };
    const section = (title) => {
      ensure(14);
      font(11, 'bold', C.primary);
      doc.text(L(title), M, y);
      color('setDrawColor', C.primary); doc.setLineWidth(0.4);
      doc.line(M, y + 1.8, M + CW, y + 1.8);
      y += 7;
    };

    // ---------- Encabezado ----------
    color('setFillColor', C.primary); doc.rect(0, 0, W, 30, 'F');
    // logotipo: corazón con línea de pulso
    doc.setFillColor(255, 255, 255); doc.roundedRect(M, 7, 16, 16, 3.5, 3.5, 'F');
    color('setFillColor', C.primary);
    doc.circle(M + 5.6, 13.2, 2.9, 'F'); doc.circle(M + 10.4, 13.2, 2.9, 'F');
    doc.triangle(M + 2.85, 14.3, M + 13.15, 14.3, M + 8, 19.8, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.7);
    doc.lines([[2, 0], [0.9, -1.6], [1.5, 3.2], [0.9, -1.6], [2.4, 0]], M + 3.5, 14.2);
    font(17, 'bold', [255, 255, 255]); doc.text('Latidia', M + 20, 14.5);
    font(9.5, 'normal', [219, 234, 254]); doc.text(L(R.title), M + 20, 20.5);
    font(8, 'normal', [219, 234, 254]);
    doc.text(L('Generado: ' + R.generated), W - M, 14.5, { align: 'right' });
    doc.text(L('Periodo: ' + R.periodLabel), W - M, 20.5, { align: 'right' });
    y = 38;

    // ---------- Datos del paciente ----------
    const info = [
      ['Paciente', R.patient || 'No especificado'],
      ['Periodo', R.periodLabel],
      ['Médico tratante', R.doctor || 'No especificado'],
      ['Registros', `${R.total} tomas en ${R.days} días`]
    ];
    if (R.age) info.splice(1, 0, ['Edad', R.age]);
    if (R.blood) info.push(['Tipo de sangre', R.blood]);
    if (R.conditions) info.push(['Padecimientos', R.conditions]);
    if (R.allergies) info.push(['Alergias', R.allergies]);
    const rows = Math.ceil(info.length / 2), boxH = 6 + rows * 9;
    color('setFillColor', C.box); doc.roundedRect(M, y, CW, boxH, 2, 2, 'F');
    info.forEach(([k, v], i) => {
      const cx = M + 5 + (i % 2) * (CW / 2), cy = y + 7 + Math.floor(i / 2) * 9;
      font(7, 'normal', C.muted); doc.text(L(k.toUpperCase()), cx, cy);
      font(10, 'bold', k === 'Alergias' ? [185, 28, 28] : C.text);
      const lines = doc.splitTextToSize(L(v), CW / 2 - 8);
      doc.text(lines.length > 1 ? lines[0].replace(/\s*\S*$/, '') + '...' : lines[0], cx, cy + 4.3);
    });
    y += boxH + 8;

    // ---------- Resumen ----------
    section('Resumen del periodo');
    const cards = [
      { k: 'Promedio de presión', v: R.avgBP ? `${R.avgBP} mmHg` : '-', sub: R.avgCat ? R.avgCat.label : '', subColor: R.avgCat ? CAT_RGB[R.avgCat.id] : null },
      { k: 'Pulso promedio', v: R.avgPulse ? `${R.avgPulse} lpm` : '-', sub: R.pulseRange ? `Rango ${R.pulseRange}` : '' },
      { k: 'Total de tomas', v: String(R.total), sub: `${R.days} días con registro` },
      { k: 'Sistólica mín - máx', v: R.sysRange || '-', sub: 'mmHg' },
      { k: 'Diastólica mín - máx', v: R.diaRange || '-', sub: 'mmHg' },
      R.adherence ? { k: 'Adherencia a medicamentos', v: R.adherence.pct == null ? '-' : R.adherence.pct + '%', sub: `${R.adherence.taken} de ${R.adherence.scheduled} dosis` }
        : { k: 'Tomas en rango normal', v: R.bpCount ? Math.round((R.cats.normal || 0) * 100 / R.bpCount) + '%' : '-', sub: `${R.cats.normal || 0} de ${R.bpCount}` }
    ];
    const gap = 4, cw = (CW - 2 * gap) / 3, ch = 19;
    cards.forEach((c, i) => {
      const cx = M + (i % 3) * (cw + gap), cy = y + Math.floor(i / 3) * (ch + gap);
      color('setDrawColor', C.line); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, cy, cw, ch, 2, 2, 'FD');
      color('setFillColor', C.primary); doc.rect(cx, cy + 3, 0.9, ch - 6, 'F');
      font(7, 'normal', C.muted); doc.text(L(c.k.toUpperCase()), cx + 4, cy + 5.5);
      font(14, 'bold'); doc.text(L(c.v), cx + 4, cy + 12.2);
      if (c.sub) { font(7.5, c.subColor ? 'bold' : 'normal', c.subColor || C.muted); doc.text(L(c.sub), cx + 4, cy + 16.4); }
    });
    y += 2 * ch + gap + 8;

    // ---------- Gráfica ----------
    if (R.list.length) {
      section('Evolución de la presión arterial y el pulso');
      ensure(78);
      drawChart(doc, M, y, CW, 64, R.list, font, color);
      y += 72;
    }

    // ---------- Clasificación + horarios ----------
    if (R.bpCount) {
      ensure(52);
      const colW = (CW - 8) / 2, top = y;
      font(11, 'bold', C.primary); doc.text('Clasificación de las tomas', M, y);
      doc.text('Promedio por horario', M + colW + 8, y);
      color('setDrawColor', C.primary); doc.setLineWidth(0.4); doc.line(M, y + 1.8, M + CW, y + 1.8);
      y += 7;
      // barra apilada
      let bx = M;
      const catList = R.catDefs.filter(c => R.cats[c.id]);
      catList.forEach(c => {
        const w = colW * R.cats[c.id] / R.bpCount;
        color('setFillColor', CAT_RGB[c.id]); doc.rect(bx, y, w, 5, 'F'); bx += w;
      });
      let ly = y + 10;
      R.catDefs.forEach(c => {
        const n = R.cats[c.id] || 0;
        color('setFillColor', CAT_RGB[c.id]); doc.circle(M + 1.5, ly - 1.1, 1.3, 'F');
        font(8.5, n ? 'normal' : 'normal', n ? C.text : C.muted); doc.text(L(c.label), M + 5, ly);
        font(8.5, 'bold', n ? C.text : C.muted); doc.text(`${n}  (${Math.round(n * 100 / R.bpCount)}%)`, M + colW, ly, { align: 'right' });
        ly += 5;
      });
      font(7, 'normal', C.muted); doc.text('Según la guía AHA/ACC 2017 para adultos.', M, ly + 1);
      // tabla por horario
      autoTable({
        startY: y - 1, margin: { left: M + colW + 8, right: M }, tableWidth: colW,
        head: [['Horario', 'Tomas', 'Presión', 'Pulso']],
        body: R.periods.map(p => [L(p.label), p.n, p.n ? `${p.sys}/${p.dia}` : '-', p.pulse ?? '-']),
        theme: 'grid', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, lineColor: C.line, lineWidth: 0.2, textColor: C.text },
        headStyles: { fillColor: C.primary, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } }
      });
      y = Math.max(ly + 6, doc.lastAutoTable.finalY + 6);
      if (y < top) y = top + 50;
    }

    // ---------- Medicamentos ----------
    if (R.meds && R.meds.length) {
      section('Medicamentos en el periodo');
      y = autoTable({
        startY: y, margin: { left: M, right: M, bottom: 22 },
        head: [['Medicamento', 'Presentación / dosis', 'Esquema', 'Tomadas', 'Adherencia']],
        body: R.meds.map(m => [L(m.name), L(m.dose), L(m.schedule), `${m.taken}/${m.scheduled}`, `${m.pct}%`]),
        theme: 'striped', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: C.text },
        headStyles: { fillColor: C.primary, textColor: 255 }, alternateRowStyles: { fillColor: C.zebra },
        columnStyles: { 3: { halign: 'center', cellWidth: 18 }, 4: { halign: 'center', cellWidth: 20 } }
      }) + 8;
    }

    // ---------- Detalle ----------
    section('Detalle de tomas');
    autoTable({
      startY: y, margin: { left: M, right: M, top: M + 4, bottom: 22 },
      head: [['Fecha', 'Hora', 'Sist.', 'Diast.', 'Pulso', 'Clasificación', 'Otros', 'Notas']],
      body: R.list.map(v => [L(v.dateLabel), v.time, v.sys ?? '-', v.dia ?? '-', v.pulse ?? '-', L(v.cat ? v.cat.label : '-'), L(v.other), L(v.notes)]),
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.7, textColor: C.text, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: C.primary, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.zebra },
      columnStyles: {
        0: { cellWidth: 25 }, 1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: C.sys },
        3: { cellWidth: 13, halign: 'center', fontStyle: 'bold', textColor: C.dia },
        4: { cellWidth: 12, halign: 'center' }, 5: { cellWidth: 32 }, 6: { cellWidth: 30 }
      },
      didParseCell: d => {
        if (d.section === 'body' && d.column.index === 5) {
          const v = R.list[d.row.index];
          if (v.cat) { d.cell.styles.textColor = CAT_RGB[v.cat.id]; d.cell.styles.fontStyle = 'bold'; }
        }
      }
    });

    // ---------- Pie de página ----------
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      color('setDrawColor', C.line); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
      font(7, 'normal', C.muted);
      doc.text(L(`Latidia · ${R.patient || ''}${R.patient ? ' · ' : ''}${R.periodLabel}`), M, H - 10);
      doc.text('Documento informativo generado por el paciente; no sustituye la valoración de un profesional de la salud.', M, H - 6.5);
      font(8, 'bold', C.muted); doc.text(`Página ${i} de ${pages}`, W - M, H - 10, { align: 'right' });
    }
    return doc.output('blob');
  }

  function drawChart(doc, x, y, w, h, list, font, color) {
    const bp = list.filter(v => v.sys && v.dia), pul = list.filter(v => v.pulse);
    const all = [...bp.flatMap(v => [v.sys, v.dia]), ...pul.map(v => v.pulse)];
    const ts = list.map(v => v.ts);
    let x0 = Math.min(...ts), x1 = Math.max(...ts);
    if (x0 === x1) { x0 -= 43200000; x1 += 43200000; }
    let lo = Math.min(...all, bp.length ? 90 : Infinity), hi = Math.max(...all, bp.length ? 120 : -Infinity);
    const raw = (hi - lo || 10) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
    lo = Math.floor((lo - step / 2) / step) * step; hi = Math.ceil((hi + step / 2) / step) * step;
    const pl = x + 10, pr = x + w, pt = y, pb = y + h - 8;
    const X = t => pl + (t - x0) / (x1 - x0) * (pr - pl);
    const Y = v => pb - (v - lo) / (hi - lo) * (pb - pt);
    // franja normal (sistólica 90-120)
    if (bp.length) { color('setFillColor', C.band); doc.rect(pl, Y(120), pr - pl, Y(90) - Y(120), 'F'); }
    // cuadrícula
    doc.setLineWidth(0.15);
    for (let v = lo; v <= hi + 1e-9; v += step) {
      color('setDrawColor', C.line); doc.line(pl, Y(v), pr, Y(v));
      font(7, 'normal', C.muted); doc.text(String(Math.round(v)), pl - 2, Y(v) + 1, { align: 'right' });
    }
    const ticks = 6;
    for (let i = 0; i <= ticks; i++) {
      const t = x0 + (x1 - x0) * i / ticks;
      const lbl = new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
      font(7, 'normal', C.muted);
      doc.text(L(lbl), X(t), pb + 4.5, { align: i === 0 ? 'left' : i === ticks ? 'right' : 'center' });
    }
    const series = [
      { name: 'Sistólica', c: C.sys, pts: bp.map(v => [v.ts, v.sys]) },
      { name: 'Diastólica', c: C.dia, pts: bp.map(v => [v.ts, v.dia]) },
      { name: 'Pulso', c: C.pulse, pts: pul.map(v => [v.ts, v.pulse]), dash: true }
    ];
    for (const s of series) {
      if (!s.pts.length) continue;
      const pts = s.pts.slice().sort((a, b) => a[0] - b[0]);
      color('setDrawColor', s.c); doc.setLineWidth(0.5);
      if (s.dash) doc.setLineDashPattern([1.2, 0.9], 0);
      for (let i = 1; i < pts.length; i++) doc.line(X(pts[i - 1][0]), Y(pts[i - 1][1]), X(pts[i][0]), Y(pts[i][1]));
      doc.setLineDashPattern([], 0);
      if (pts.length <= 70) { color('setFillColor', s.c); pts.forEach(p => doc.circle(X(p[0]), Y(p[1]), 0.65, 'F')); }
    }
    // leyenda
    let lx = pl;
    const ly = y + h + 1;
    series.forEach(s => {
      color('setDrawColor', s.c); doc.setLineWidth(0.8);
      if (s.dash) doc.setLineDashPattern([1.2, 0.9], 0);
      doc.line(lx, ly - 1, lx + 6, ly - 1); doc.setLineDashPattern([], 0);
      font(8, 'normal'); doc.text(s.name, lx + 8, ly); lx += 30;
    });
    color('setFillColor', C.band); doc.rect(lx, ly - 2.6, 6, 3, 'F');
    font(8, 'normal'); doc.text('Sistólica normal (90-120)', lx + 8, ly);
  }

  // ---------- Ficha médica del paciente (una página, tamaño carta) ----------
  function buildCard(P) {
    const { jsPDF } = g.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
    const autoTable = (opts) => {
      if (typeof doc.autoTable === 'function') doc.autoTable(opts);
      else (g.jspdf_autotable.autoTable || g.jspdf_autotable.default)(doc, opts);
      return doc.lastAutoTable.finalY;
    };
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 16, CW = W - 2 * M;
    const RED = [185, 28, 28], RED_SOFT = [254, 236, 236];
    doc.setProperties({ title: 'Ficha médica', subject: 'Ficha médica del paciente', author: L(P.name || 'Latidia'), creator: 'Latidia' });
    const color = (fn, c) => doc[fn](c[0], c[1], c[2]);
    const font = (size, style = 'normal', c = C.text) => { doc.setFont('helvetica', style); doc.setFontSize(size); color('setTextColor', c); };
    const dash = v => (v == null || v === '' ? '-' : v);
    let y;
    const section = (title, x = M, w = CW) => {
      font(10.5, 'bold', C.primary); doc.text(L(title), x, y);
      color('setDrawColor', C.primary); doc.setLineWidth(0.35); doc.line(x, y + 1.6, x + w, y + 1.6);
      y += 6.5;
    };
    const kv = (label, value, x, w, opts = {}) => {
      font(7, 'normal', C.muted); doc.text(L(label.toUpperCase()), x, y);
      font(opts.size || 10.5, 'bold', opts.color || C.text);
      const lines = doc.splitTextToSize(L(dash(value)), w);
      doc.text(lines.slice(0, 2), x, y + 4.6);
      return 4.6 + lines.slice(0, 2).length * 4.6;
    };

    // Encabezado
    color('setFillColor', C.primary); doc.rect(0, 0, W, 26, 'F');
    doc.setFillColor(255, 255, 255); doc.roundedRect(M, 5.5, 15, 15, 3.5, 3.5, 'F');
    color('setFillColor', C.primary);
    doc.circle(M + 5.3, 11.5, 2.7, 'F'); doc.circle(M + 9.7, 11.5, 2.7, 'F');
    doc.triangle(M + 2.7, 12.5, M + 12.3, 12.5, M + 7.5, 17.6, 'F');
    font(16, 'bold', [255, 255, 255]); doc.text('Ficha médica', M + 19, 12.5);
    font(9, 'normal', [219, 234, 254]); doc.text('Latidia · información del paciente', M + 19, 18.3);
    font(8, 'normal', [219, 234, 254]); doc.text(L('Generada: ' + P.generated), W - M, 18.3, { align: 'right' });

    // Nombre + tipo de sangre
    y = 38;
    font(20, 'bold'); doc.text(L(P.name || 'Sin nombre'), M, y, { maxWidth: CW - 45 });
    font(10.5, 'normal', C.muted);
    doc.text(L([P.age, P.sex, P.birth && 'Nació el ' + P.birth].filter(Boolean).join('  ·  ')), M, y + 7);
    const bx = W - M - 36;
    color('setDrawColor', RED); doc.setLineWidth(0.8); color('setFillColor', RED_SOFT);
    doc.roundedRect(bx, 29, 36, 22, 3, 3, 'FD');
    font(20, 'bold', RED); doc.text(L(P.blood || '-'), bx + 18, 41.5, { align: 'center' });
    font(7, 'bold', RED); doc.text('TIPO DE SANGRE', bx + 18, 47.5, { align: 'center' });

    // Alergias (destacadas)
    y = 58;
    const allergyTxt = P.allergies && P.allergies.length ? P.allergies.join(', ') : 'Sin alergias conocidas';
    const aLines = doc.splitTextToSize(L(allergyTxt), CW - 36);
    const aH = 8 + aLines.length * 5;
    color('setFillColor', P.allergies && P.allergies.length ? RED_SOFT : C.box); doc.roundedRect(M, y, CW, aH, 2, 2, 'F');
    color('setFillColor', P.allergies && P.allergies.length ? RED : C.muted); doc.rect(M, y, 1.4, aH, 'F');
    font(8, 'bold', P.allergies && P.allergies.length ? RED : C.muted); doc.text('ALERGIAS', M + 5, y + 6.3);
    font(11, 'bold', P.allergies && P.allergies.length ? RED : C.text); doc.text(aLines, M + 30, y + 6.3);
    y += aH + 9;

    // Identificación y medidas (dos columnas)
    const colW = (CW - 10) / 2, x2 = M + colW + 10;
    const top = y;
    section('Identificación', M, colW);
    let yy = y;
    [['CURP', P.curp], ['Número de Seguridad Social', P.nss], ['Institución', P.institution], ['Clínica / UMF', P.clinic]].forEach(([k, v]) => {
      y = yy; yy += kv(k, v, M, colW) + 3;
    });
    const leftEnd = yy;
    y = top;
    section('Medidas y signos', x2, colW);
    yy = y;
    [['Estatura', P.height], ['Último peso', P.weight], ['Índice de masa corporal', P.bmi], ['Última presión', P.lastBP]].forEach(([k, v]) => {
      y = yy; yy += kv(k, v, x2, colW) + 3;
    });
    y = Math.max(leftEnd, yy) + 4;

    // Padecimientos y notas
    section('Padecimientos');
    font(10.5, 'normal');
    if (P.conditions && P.conditions.length) {
      P.conditions.forEach(c => {
        color('setFillColor', C.primary); doc.circle(M + 1.2, y - 1.2, 0.8, 'F');
        const cl = doc.splitTextToSize(L(c), CW - 6);
        doc.text(cl, M + 5, y); y += cl.length * 5;
      });
      y += 2;
    } else { doc.text('Sin padecimientos registrados', M, y); y += 7; }
    if (P.notes) {
      font(8, 'bold', C.muted); doc.text('NOTAS', M, y + 2);
      font(10, 'normal'); const n = doc.splitTextToSize(L(P.notes), CW - 16); doc.text(n, M + 16, y + 2); y += n.length * 5 + 2;
    }
    y += 5;

    // Medicamentos actuales
    section('Medicamentos actuales');
    if (P.meds.length) {
      y = autoTable({
        startY: y, margin: { left: M, right: M, bottom: 20 },
        head: [['Medicamento', 'Presentación / dosis', 'Esquema']],
        body: P.meds.map(m => [L(m.name), L(m.dose), L(m.schedule)]),
        theme: 'striped', styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, textColor: C.text },
        headStyles: { fillColor: C.primary, textColor: 255 }, alternateRowStyles: { fillColor: C.zebra }
      }) + 9;
    } else { font(10, 'normal', C.muted); doc.text('Sin medicamentos activos', M, y); y += 9; }

    // Contactos
    if (y > H - 50) { doc.addPage(); y = M + 6; }
    const ctop = y;
    section('Contacto de emergencia', M, colW);
    yy = y; y = yy; yy += kv('Nombre', P.emName, M, colW) + 3;
    y = yy; yy += kv('Parentesco', P.emRel, M, colW) + 3;
    y = yy; yy += kv('Teléfono', P.emPhone, M, colW, { size: 12, color: C.primary }) + 3;
    y = ctop;
    section('Médico tratante', x2, colW);
    yy = y; y = yy; yy += kv('Nombre', P.doctor, x2, colW) + 3;
    y = yy; yy += kv('Teléfono', P.doctorPhone, x2, colW, { size: 12, color: C.primary }) + 3;

    // Pie
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      color('setDrawColor', C.line); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
      font(7, 'normal', C.muted);
      doc.text('Información proporcionada por el paciente mediante Latidia. Contiene datos personales: compártela solo con personal de salud de confianza.', M, H - 9.5);
      if (pages > 1) { font(8, 'bold', C.muted); doc.text(`Página ${i} de ${pages}`, W - M, H - 5.5, { align: 'right' }); }
    }
    return doc.output('blob');
  }

  g.ReportPDF = { load, build, buildCard, ready };
})(window);
