/* Latidia — lectura de resultados de laboratorio desde PDF (en el dispositivo, con pdf.js) */
(function (g) {
  'use strict';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs';
  const WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs';
  let lib = null;

  async function load() {
    if (lib) return lib;
    try { lib = await import(PDFJS); }
    catch (e) { throw new Error('No se pudo cargar el lector de PDF. Revisa tu conexión.'); }
    // El worker debe ser del mismo origen: se crea desde un Blob; si falla, pdf.js usa el hilo principal
    try {
      const code = await (await fetch(WORKER)).text();
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      lib.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' });
    } catch (_) { lib.GlobalWorkerOptions.workerSrc = WORKER; }
    return lib;
  }

  // Texto del PDF agrupado en renglones (por posición vertical)
  async function extractLines(file) {
    const pdfjs = await load();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 8;
        let row = rows.find(r => Math.abs(r.y - y) < h * 0.45);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.items.sort((a, b) => a.x - b.x).map(i => i.s.trim()).join(' ').replace(/\s+/g, ' ').trim());
    }
    if (!lines.join('').trim()) throw new Error('El PDF no contiene texto (parece una imagen escaneada). Captura los valores manualmente.');
    return lines;
  }

  const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const pad = n => String(n).padStart(2, '0');
  const num = s => parseFloat(String(s).replace(',', '.'));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function findDate(text) {
    let m = text.match(/(\d{1,2})\s+(?:de\s+)?([A-Za-zÁÉÍÓÚáéíóú]+)[\s,]+(?:de\s+)?(\d{4})/);
    if (m && MONTHS[norm(m[2])]) return `${m[3]}-${pad(MONTHS[norm(m[2])])}-${pad(m[1])}`;
    m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    return '';
  }

  // Elige el rango de referencia adecuado cuando el laboratorio da varios (por edad, adultos, etc.)
  function pickRange(text, age) {
    const t = String(text || '');
    const labeled = [];
    const re = /([^:;]*?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/g;
    let m;
    while ((m = re.exec(t))) labeled.push({ label: m[1], low: num(m[2]), high: num(m[3]) });
    if (labeled.length) {
      const byAge = labeled.find(c => {
        const a = c.label.match(/(\d+)\s*[-–]\s*(\d+)\s*a[ñn]os/i);
        const gt = c.label.match(/>\s*(\d+)\s*a[ñn]os/i);
        if (age != null && a) return age >= +a[1] && age <= +a[2];
        if (age != null && gt) return age > +gt[1];
        return false;
      });
      const adult = labeled.find(c => /adult/i.test(c.label) && !/\d+\s*[-–]\s*\d+\s*a[ñn]os/i.test(c.label));
      const c = byAge || adult || labeled[0];
      return { low: c.low, high: c.high };
    }
    m = t.match(/(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/);
    if (m) return { low: num(m[1]), high: num(m[2]) };
    m = t.match(/(?:<|menor(?: a| de)?|hasta)\s*(\d+(?:[.,]\d+)?)/i);
    if (m) return { low: null, high: num(m[1]) };
    m = t.match(/(?:>|mayor(?: a| de)?)\s*(\d+(?:[.,]\d+)?)/i);
    if (m) return { low: num(m[1]), high: null };
    return { low: null, high: null };
  }

  const SKIP = /^(paciente|edad|sexo|m[eé]dico|folio|fec|fecha|hora|m[eé]todo|valid[oó]|responsable|p[aá]gina|en los estudios|medicamentos\.|estudio\s+resultados|ced\.)/i;
  const ITEM = /^(.+?)\s+([<>]?\s?-?\d+(?:[.,]\d+)?)\s+([%a-zA-Zµμ][^\s]*)\s*(.*)$/;

  function parse(lines, patientAge) {
    const text = lines.join('\n');
    const meta = { date: '', folio: '', doctor: '', lab: '', age: patientAge };
    let m;
    if ((m = text.match(/fec(?:ha)?\.?\s*(?:de\s*)?(?:toma|recep(?:ci[oó]n)?\.?|capt\.?)\s*:?\s*([^\n]+)/i))) meta.date = findDate(m[1]);
    if (!meta.date) meta.date = findDate(text);
    if ((m = text.match(/folio\s*:?\s*([A-Z0-9-]+)/i))) meta.folio = m[1];
    if ((m = text.match(/m[eé]dico\s*:\s*([^\n]+?)(?:\s+hora de toma.*)?$/im))) meta.doctor = m[1].replace(/\s+(hora|fec).*$/i, '').trim();
    if (meta.age == null && (m = text.match(/edad\s*:?\s*(\d+)\s*a[ñn]os/i))) meta.age = +m[1];

    const items = [];
    let group = '', cur = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/muestra primaria/i.test(line)) { group = line.split(/muestra primaria/i)[0].trim(); cur = null; continue; }
      if (SKIP.test(line)) { cur = null; continue; }
      const it = line.match(ITEM);
      // descarta renglones de rangos por edad ("1 A 23 MESES : …", "Adultos (60 - 90 años): …")
      const valueOk = it && !/^\d/.test(it[1].trim()) && !/^(a[ñn]os?|mes(es)?|d[ií]as?)\b/i.test(it[3]) && !/\(\s*[<>]?\s*\d+\s*$/.test(it[1]);
      if (valueOk) {
        cur = { name: it[1].replace(/\s*:$/, '').trim(), value: it[2].replace(/\s/g, ''), unit: it[3], refText: it[4] || '', group };
        items.push(cur);
      } else if (cur && line.length < 80 && (/\d/.test(line) || line.length <= 12)) {
        cur.refText += ' ' + line; // rango de referencia que continúa en el siguiente renglón
      } else if (!/\d/.test(line) && line.length < 90) {
        cur = null;
      }
    }
    for (const it of items) {
      const r = pickRange(it.refText, meta.age);
      it.low = r.low; it.high = r.high;
      it.refText = it.refText.replace(/\s+/g, ' ').trim();
    }
    return { meta, items };
  }

  g.LabImport = { load, extractLines, parse, pickRange };
})(window);
