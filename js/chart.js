/* Gráfico de líneas SVG ligero, sin dependencias */
(function (g) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function niceStep(range, ticks) {
    const raw = range / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  const fmtDay = d => d.toLocaleDateString('es', { day: 'numeric', month: 'short' });

  /**
   * opts: { width, height, series:[{name,color,points:[{x:Date,y:Number}], dashed}], bands:[{from,to,color,label}] }
   */
  function lineChart(opts) {
    const W = Math.max(280, opts.width || 600), H = opts.height || 240;
    const m = { t: 12, r: 12, b: 28, l: 36 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = opts.series.flatMap(s => s.points);
    if (!all.length) return `<div class="chart-empty">Sin datos para graficar</div>`;

    let xMin = Math.min(...all.map(p => +p.x)), xMax = Math.max(...all.map(p => +p.x));
    if (xMin === xMax) { xMin -= 43200000; xMax += 43200000; }
    let yMin = Math.min(...all.map(p => p.y)), yMax = Math.max(...all.map(p => p.y));
    for (const b of opts.bands || []) { yMin = Math.min(yMin, b.from); yMax = Math.max(yMax, b.to); }
    const step = niceStep(yMax - yMin || 10, 5);
    yMin = Math.floor((yMin - step / 2) / step) * step;
    yMax = Math.ceil((yMax + step / 2) / step) * step;

    const X = x => m.l + ((+x - xMin) / (xMax - xMin)) * iw;
    const Y = y => m.t + ih - ((y - yMin) / (yMax - yMin)) * ih;
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(opts.label || 'Gráfico')}">`;

    for (const b of opts.bands || []) {
      svg += `<rect x="${m.l}" y="${Y(b.to)}" width="${iw}" height="${Y(b.from) - Y(b.to)}" fill="${b.color}" opacity=".12"/>`;
    }
    for (let v = yMin; v <= yMax + 1e-9; v += step) {
      svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
      svg += `<text class="axis" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
    }
    const xt = Math.min(6, Math.max(2, Math.floor(iw / 90)));
    for (let i = 0; i <= xt; i++) {
      const t = xMin + ((xMax - xMin) * i) / xt;
      svg += `<text class="axis" x="${X(t)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === xt ? 'end' : 'middle'}">${fmtDay(new Date(t))}</text>`;
    }
    for (const s of opts.series) {
      const pts = s.points.slice().sort((a, b) => a.x - b.x);
      if (!pts.length) continue;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="5 4"' : ''}/>`;
      const r = pts.length > 60 ? 2 : 3.5;
      for (const p of pts) {
        svg += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${r}" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"><title>${esc(s.name)}: ${p.y} · ${new Date(p.x).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</title></circle>`;
      }
    }
    svg += '</svg>';
    const legend = opts.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    return svg + `<div class="legend">${legend}</div>`;
  }

  // Barras horizontales apiladas (distribución de categorías)
  function stackBar(parts) {
    const total = parts.reduce((a, p) => a + p.value, 0);
    if (!total) return '';
    return `<div class="stack">${parts.filter(p => p.value).map(p =>
      `<div style="flex:${p.value};background:${p.color}" title="${esc(p.label)}: ${p.value}"></div>`).join('')}</div>
      <div class="legend">${parts.filter(p => p.value).map(p =>
      `<span><i style="background:${p.color}"></i>${esc(p.label)} · ${p.value} (${Math.round(p.value * 100 / total)}%)</span>`).join('')}</div>`;
  }

  g.Charts = { lineChart, stackBar };
})(window);
