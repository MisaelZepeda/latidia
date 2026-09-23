/* Latidia — tarjeta médica tamaño credencial (CR80: 85.6 × 54 mm) con código QR */
(function (g) {
  'use strict';
  const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js';
  const BASE_W = 1024, BASE_H = 646;              // proporción CR80
  const CARD_MM = { w: 85.6, h: 54 };
  const BLUE = '#1d4ed8', SKY = '#38bdf8', INK = '#0f1a2b', MUTED = '#5a6678', RED = '#b91c1c';
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const HEART = new (g.Path2D || Object)('M19.5 12.6 12 20l-7.5-7.4A4.9 4.9 0 0 1 12 6.3a4.9 4.9 0 0 1 7.5 6.3Z');
  const PULSE = new (g.Path2D || Object)('M4 12h4l1.5-2.5 2.5 5 1.5-2.5H20');

  let loading = null;
  function load() {
    if (g.qrcode) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = QR_LIB; s.onload = resolve;
        s.onerror = () => { loading = null; reject(new Error('No se pudo cargar el generador de QR. Revisa tu conexión.')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // Texto legible por cualquier lector de QR (sin internet ni apps)
  function qrText(D) {
    const L = [];
    L.push('FICHA MEDICA - ' + (D.name || ''));
    if (D.birthShort || D.age) L.push('Nac.: ' + [D.birthShort, D.age && '(' + D.age + ')', D.sex].filter(Boolean).join(' '));
    if (D.blood) L.push('Sangre: ' + D.blood);
    L.push('ALERGIAS: ' + (D.allergies.length ? D.allergies.join(', ') : 'Ninguna conocida'));
    if (D.conditions.length) L.push('Padecimientos: ' + D.conditions.join(', '));
    if (D.meds.length) L.push('Medicamentos: ' + D.meds.map(m => m.name + (m.dose ? ' ' + m.dose : '')).join('; '));
    if (D.emName || D.emPhone) L.push('Emergencia: ' + [D.emName, D.emRel && '(' + D.emRel + ')', D.emPhone].filter(Boolean).join(' '));
    if (D.doctor || D.doctorPhone) L.push('Medico: ' + [D.doctor, D.doctorPhone].filter(Boolean).join(' '));
    if (D.includeIds) {
      if (D.curp) L.push('CURP: ' + D.curp);
      if (D.nss) L.push('NSS: ' + D.nss + (D.institution ? ' (' + D.institution + ')' : ''));
    } else if (D.institution && D.institution !== 'Ninguna') L.push('Institucion: ' + D.institution);
    if (D.notes) L.push('Notas: ' + D.notes);
    L.push('Actualizado: ' + D.updated);
    return L.join('\n');
  }

  function makeQR(text) {
    const qr = g.qrcode(0, 'L'); // nivel L: menos módulos, más fácil de leer impreso en tamaño credencial
    if (g.qrcode.stringToBytesFuncs && g.qrcode.stringToBytesFuncs['UTF-8']) g.qrcode.stringToBytes = g.qrcode.stringToBytesFuncs['UTF-8'];
    qr.addData(text, 'Byte');
    qr.make();
    return qr;
  }

  // ---------- utilidades de dibujo ----------
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  function fit(ctx, text, maxW) {
    text = String(text || '');
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text.trimEnd() + '…';
  }
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW) line = t;
      else { if (line) lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = fit(ctx, lines[maxLines - 1] + ' …', maxW); }
    return lines;
  }
  const font = (ctx, size, weight = 400) => { ctx.font = `${weight} ${size}px ${FONT}`; };
  function logo(ctx, x, y, size, bg, fg) {
    ctx.fillStyle = bg; rr(ctx, x, y, size, size, size * 0.24); ctx.fill();
    ctx.save(); ctx.translate(x + size * 0.1, y + size * 0.1); ctx.scale(size * 0.8 / 24, size * 0.8 / 24);
    ctx.fillStyle = fg; ctx.fill(HEART);
    ctx.strokeStyle = bg; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(PULSE);
    ctx.restore();
  }
  function newCanvas(scale) {
    const c = document.createElement('canvas');
    c.width = BASE_W * scale; c.height = BASE_H * scale;
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textBaseline = 'alphabetic';
    return [c, ctx];
  }

  // ---------- FRENTE ----------
  function front(D, scale = 1) {
    const [c, ctx] = newCanvas(scale);
    const W = BASE_W, H = BASE_H;
    rr(ctx, 0, 0, W, H, 40); ctx.save(); ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, BLUE); grad.addColorStop(1, SKY);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(W - 90, -40, 260, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(120, H + 90, 220, 0, Math.PI * 2); ctx.fill();

    // encabezado
    logo(ctx, 44, 40, 64, '#ffffff', BLUE);
    ctx.fillStyle = '#fff'; font(ctx, 34, 700); ctx.fillText('Latidia', 124, 76);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; font(ctx, 19, 600); ctx.fillText('TARJETA MÉDICA', 125, 102);

    // tipo de sangre
    ctx.fillStyle = '#fff'; rr(ctx, W - 176, 30, 132, 100, 20); ctx.fill();
    ctx.fillStyle = RED; ctx.textAlign = 'center';
    font(ctx, D.blood && D.blood.length > 2 ? 44 : 50, 800); ctx.fillText(D.blood || '—', W - 110, 94);
    font(ctx, 15, 700); ctx.fillText('SANGRE', W - 110, 118);
    ctx.textAlign = 'left';

    // nombre y datos
    const leftW = 530;
    ctx.fillStyle = '#fff'; font(ctx, 46, 700);
    const nameLines = wrap(ctx, D.name || 'Sin nombre', leftW, 2);
    let y = 196;
    nameLines.forEach(l => { ctx.fillText(l, 44, y); y += 52; });
    ctx.fillStyle = 'rgba(255,255,255,.9)'; font(ctx, 24, 500);
    ctx.fillText(fit(ctx, [D.age, D.sex, D.birthShort && 'Nac. ' + D.birthShort].filter(Boolean).join('  ·  '), leftW), 44, y - 8);
    y += 26;

    // alergias
    const hasAll = D.allergies.length > 0;
    font(ctx, 23, 700);
    const allTxt = hasAll ? D.allergies.join(', ') : 'Sin alergias conocidas';
    const allLines = wrap(ctx, allTxt, leftW - 36, 2);
    const boxH = 44 + allLines.length * 28;
    ctx.fillStyle = '#fff'; rr(ctx, 44, y, leftW, boxH, 16); ctx.fill();
    ctx.fillStyle = hasAll ? RED : MUTED; ctx.fillRect(44, y, 8, boxH);
    font(ctx, 15, 800); ctx.fillText('ALERGIAS', 68, y + 28);
    font(ctx, 23, 700); ctx.fillStyle = hasAll ? RED : INK;
    allLines.forEach((l, i) => ctx.fillText(l, 68, y + 58 + i * 28));
    y += boxH + 22;

    // contacto de emergencia
    if (y < H - 60 && (D.emName || D.emPhone)) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; font(ctx, 15, 800); ctx.fillText('EN CASO DE EMERGENCIA', 44, y + 4);
      ctx.fillStyle = '#fff'; font(ctx, 24, 700);
      ctx.fillText(fit(ctx, [D.emName, D.emRel && `(${D.emRel})`].filter(Boolean).join(' '), leftW), 44, y + 36);
      if (D.emPhone && y + 70 < H) { font(ctx, 28, 800); ctx.fillText(fit(ctx, D.emPhone, leftW), 44, y + 72); }
      y += 100;
    }

    // padecimientos (si queda espacio)
    if (D.conditions.length && y + 50 < H - 20) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; font(ctx, 15, 800); ctx.fillText('PADECIMIENTOS', 44, y + 4);
      ctx.fillStyle = '#fff'; font(ctx, 22, 600);
      wrap(ctx, D.conditions.join(', '), leftW, Math.max(1, Math.floor((H - 30 - y) / 28))).forEach((l, i) => ctx.fillText(l, 44, y + 34 + i * 28));
    }

    // QR
    const qs = 392, qx = W - 44 - qs, qy = 150;
    ctx.fillStyle = '#fff'; rr(ctx, qx, qy, qs, qs + 40, 22); ctx.fill();
    drawQR(ctx, D.qr, qx + 18, qy + 18, qs - 36);
    ctx.fillStyle = MUTED; font(ctx, 17, 600); ctx.textAlign = 'center';
    ctx.fillText('Escanea mi ficha médica', qx + qs / 2, qy + qs + 24);
    ctx.textAlign = 'left';
    ctx.restore();
    return c;
  }

  function drawQR(ctx, qr, x, y, size) {
    const n = qr.getModuleCount(), cell = size / n;
    ctx.fillStyle = INK;
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (qr.isDark(r, col)) ctx.fillRect(x + col * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }

  // ---------- REVERSO ----------
  function back(D, scale = 1) {
    const [c, ctx] = newCanvas(scale);
    const W = BASE_W, H = BASE_H;
    rr(ctx, 0, 0, W, H, 40); ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, BLUE); grad.addColorStop(1, SKY);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 78);
    logo(ctx, 36, 17, 44, '#ffffff', BLUE);
    ctx.fillStyle = '#fff'; font(ctx, 26, 700); ctx.fillText('Información médica', 96, 50);
    font(ctx, 17, 500); ctx.textAlign = 'right'; ctx.fillText(D.name ? fit(ctx, D.name, 360) : '', W - 36, 50); ctx.textAlign = 'left';

    const colL = 40, colR = 540, colW = 450;
    const label = (t, x, y) => { ctx.fillStyle = BLUE; font(ctx, 15, 800); ctx.fillText(t, x, y); };
    const text = (t, x, y, w, size = 21, weight = 500, color = INK) => { ctx.fillStyle = color; font(ctx, size, weight); ctx.fillText(fit(ctx, t, w), x, y); };

    // columna izquierda: padecimientos y medicamentos
    let y = 122;
    label('PADECIMIENTOS', colL, y); y += 32;
    if (D.conditions.length) D.conditions.slice(0, 4).forEach(cnd => { text('• ' + cnd, colL, y, colW); y += 30; });
    else { text('Ninguno registrado', colL, y, colW, 21, 400, MUTED); y += 30; }
    if (D.conditions.length > 4) { text(`+${D.conditions.length - 4} más (ver QR)`, colL, y, colW, 17, 500, MUTED); y += 26; }
    y += 14;
    label('MEDICAMENTOS', colL, y); y += 32;
    const maxMeds = Math.max(1, Math.floor((H - 70 - y) / 50));
    if (D.meds.length) {
      D.meds.slice(0, maxMeds).forEach(m => {
        text(m.name + (m.dose ? ' · ' + m.dose : ''), colL, y, colW, 21, 700);
        text(m.schedule || '', colL, y + 23, colW, 17, 400, MUTED); y += 50;
      });
      if (D.meds.length > maxMeds) text(`+${D.meds.length - maxMeds} más (ver QR)`, colL, y, colW, 17, 500, MUTED);
    } else text('Ninguno', colL, y, colW, 21, 400, MUTED);

    // columna derecha: médico, seguridad social, notas
    y = 122;
    label('MÉDICO TRATANTE', colR, y); y += 30;
    text(D.doctor || '—', colR, y, colW, 21, 700); y += 28;
    if (D.doctorPhone) { text(D.doctorPhone, colR, y, colW, 21, 600, BLUE); y += 28; }
    y += 16;
    label('SEGURIDAD SOCIAL', colR, y); y += 30;
    text([D.institution, D.clinic].filter(Boolean).join(' · ') || '—', colR, y, colW, 21, 700); y += 28;
    if (D.includeIds) {
      if (D.nss) { text('NSS ' + D.nss, colR, y, colW, 20, 600); y += 27; }
      if (D.curp) { text('CURP ' + D.curp, colR, y, colW, 20, 600); y += 27; }
    }
    if (D.notes) {
      y += 14; label('NOTAS', colR, y); y += 28;
      ctx.fillStyle = INK; font(ctx, 19, 500);
      wrap(ctx, D.notes, colW, Math.max(1, Math.floor((H - 70 - y) / 25) + 1)).forEach(l => { ctx.fillText(l, colR, y); y += 25; });
    }

    // pie
    ctx.fillStyle = '#eef2f8'; ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = MUTED; font(ctx, 15, 500);
    ctx.fillText(`Actualizada: ${D.updated}  ·  Información proporcionada por el paciente (Latidia)`, 40, H - 19);
    ctx.restore();
    return c;
  }

  function prepare(D) { return Object.assign({}, D, { qr: makeQR(qrText(D)) }); }

  // Imagen con frente y reverso para guardar en Fotos
  function image(D) {
    const P = prepare(D), s = 2, gap = 60;
    const f = front(P, s), b = back(P, s);
    const c = document.createElement('canvas');
    c.width = f.width + 2 * gap; c.height = f.height * 2 + 3 * gap;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f3f6fa'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(f, gap, gap); ctx.drawImage(b, gap, 2 * gap + f.height);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }

  // PDF tamaño carta: tarjeta doblable (frente | reverso) en tamaño real, 2 copias
  function pdf(D) {
    const P = prepare(D);
    const jpeg = cv => { // JPEG no tiene transparencia: se compone sobre blanco
      const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
      const x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(cv, 0, 0);
      return o.toDataURL('image/jpeg', 0.92);
    };
    const f = jpeg(front(P, 3)), b = jpeg(back(P, 3));
    const { jsPDF } = g.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
    const W = doc.internal.pageSize.getWidth();
    const cw = CARD_MM.w, ch = CARD_MM.h, x0 = (W - 2 * cw) / 2;
    doc.setProperties({ title: 'Tarjeta médica', creator: 'Latidia' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(29, 78, 216);
    doc.text('Tarjeta médica para imprimir', 18, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60, 70, 85);
    [
      '1. Imprime al 100 % (tamaño real). En el cuadro de impresión desactiva "Ajustar a la página".',
      '2. Recorta por la línea punteada exterior de una de las copias.',
      '3. Dobla por la línea central (frente por fuera) y pega las caras; si puedes, enmícala.',
      'Queda del tamaño de una credencial (85.6 × 54 mm) para llevarla en tu cartera.'
    ].forEach((t, i) => doc.text(t, 18, 29 + i * 5.2));
    [52, 142].forEach(top => {
      doc.addImage(f, 'JPEG', x0, top, cw, ch, undefined, 'FAST');
      doc.addImage(b, 'JPEG', x0 + cw, top, cw, ch, undefined, 'FAST');
      doc.setDrawColor(120, 130, 145); doc.setLineWidth(0.25); doc.setLineDashPattern([1.5, 1.2], 0);
      doc.rect(x0 - 1.5, top - 1.5, 2 * cw + 3, ch + 3);
      doc.setLineDashPattern([0.5, 1], 0); doc.line(x0 + cw, top - 5, x0 + cw, top + ch + 5);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7); doc.setTextColor(120, 130, 145);
      doc.text('recortar', x0 - 1.5, top - 3); doc.text('doblar', x0 + cw, top + ch + 8, { align: 'center' });
    });
    doc.setFontSize(7.5); doc.setTextColor(120, 130, 145);
    doc.text('Contiene datos personales y de salud. Guárdala en un lugar seguro.', 18, 262);
    return doc.output('blob');
  }

  // Vista previa para la app
  function preview(D, face) {
    const P = prepare(D);
    return (face === 'back' ? back(P, 1.5) : front(P, 1.5)).toDataURL('image/png');
  }

  g.MedCard = { load, preview, image, pdf, qrText };
})(window);
