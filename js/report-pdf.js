/* MedicSoft — reporte PDF profesional (tamaño carta) con jsPDF */
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
    primary: [15, 118, 110], primarySoft: [217, 243, 239], text: [17, 31, 35], muted: [95, 110, 115],
    line: [214, 222, 224], zebra: [246, 248, 249], box: [243, 247, 248],
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
    doc.setProperties({ title: L(R.title), subject: 'Reporte de presión arterial', author: L(R.patient || 'MedicSoft'), creator: 'MedicSoft' });

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
    font(17, 'bold', [255, 255, 255]); doc.text('MedicSoft', M + 20, 14.5);
    font(9.5, 'normal', [220, 245, 241]); doc.text(L(R.title), M + 20, 20.5);
    font(8, 'normal', [220, 245, 241]);
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
    const rows = Math.ceil(info.length / 2), boxH = 6 + rows * 9;
    color('setFillColor', C.box); doc.roundedRect(M, y, CW, boxH, 2, 2, 'F');
    info.forEach(([k, v], i) => {
      const cx = M + 5 + (i % 2) * (CW / 2), cy = y + 7 + Math.floor(i / 2) * 9;
      font(7, 'normal', C.muted); doc.text(L(k.toUpperCase()), cx, cy);
      font(10, 'bold'); doc.text(L(v), cx, cy + 4.3, { maxWidth: CW / 2 - 8 });
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
      doc.text(L(`MedicSoft · ${R.patient || ''}${R.patient ? ' · ' : ''}${R.periodLabel}`), M, H - 10);
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

  g.ReportPDF = { load, build, ready };
})(window);
