/* ============================================================
   Grafik SVG ringan (tanpa library eksternal)
   ============================================================ */
const Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Grafik garis: LineChart(container, labels[], series[{name,color,values[]}])
  function line(container, labels, series) {
    const W = 620, H = 230, PL = 34, PR = 10, PT = 14, PB = 28;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' });
    const maxV = Math.max(1, ...series.flatMap(s => s.values));
    const y = v => PT + (H - PT - PB) * (1 - v / maxV);
    const x = i => PL + (W - PL - PR) * (labels.length === 1 ? .5 : i / (labels.length - 1));

    for (let g = 0; g <= 4; g++) {
      const yy = PT + (H - PT - PB) * g / 4;
      svg.appendChild(el('line', { x1: PL, y1: yy, x2: W - PR, y2: yy, stroke: '#EEF2F7', 'stroke-width': 1 }));
      const t = el('text', { x: PL - 6, y: yy + 3, 'text-anchor': 'end', 'font-size': 9, fill: '#94A3B8' });
      t.textContent = Math.round(maxV * (1 - g / 4)); svg.appendChild(t);
    }
    labels.forEach((lb, i) => {
      const t = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 9, fill: '#94A3B8' });
      t.textContent = lb; svg.appendChild(t);
    });
    series.forEach(s => {
      const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      svg.appendChild(el('polyline', { points: pts, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      s.values.forEach((v, i) => svg.appendChild(el('circle', { cx: x(i), cy: y(v), r: 3, fill: s.color })));
    });
    container.innerHTML = ''; container.appendChild(svg);
  }

  // Donut: donut(container, segments[{label,value,color}], centerText)
  function donut(container, segments, centerText) {
    const size = 190, r = 62, c = 2 * Math.PI * r;
    const total = segments.reduce((n, s) => n + (Number(s.value) || 0), 0) || 1;
    const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: '100%', height: '100%' });
    let offset = 0;
    segments.forEach(s => {
      const frac = (Number(s.value) || 0) / total;
      const circle = el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: s.color, 'stroke-width': 20 });
      circle.setAttribute('stroke-dasharray', `${frac * c} ${c}`);
      circle.setAttribute('stroke-dashoffset', -offset * c);
      circle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
      svg.appendChild(circle);
      offset += frac;
    });
    const t1 = el('text', { x: size / 2, y: size / 2 - 4, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: '#0F172A' });
    t1.textContent = centerText || total;
    const t2 = el('text', { x: size / 2, y: size / 2 + 16, 'text-anchor': 'middle', 'font-size': 10, fill: '#64748B' });
    t2.textContent = 'TOTAL';
    svg.appendChild(t1); svg.appendChild(t2);
    container.innerHTML = ''; container.appendChild(svg);
  }

  // Batang vertikal berkelompok: bars(container, labels[], series[{name,color,values[]}])
  function bars(container, labels, series) {
    const W = 620, H = 220, PL = 30, PR = 8, PT = 12, PB = 26;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%' });
    const maxV = Math.max(1, ...series.flatMap(s => s.values));
    const groupW = (W - PL - PR) / labels.length;
    const barW = Math.max(8, groupW / (series.length + 1) * .7);
    labels.forEach((lb, i) => {
      const gx = PL + groupW * i + groupW / 2;
      series.forEach((s, j) => {
        const v = s.values[i] || 0;
        const bh = (H - PT - PB) * (v / maxV);
        const bx = gx - (series.length * barW + (series.length - 1) * 4) / 2 + j * (barW + 4);
        svg.appendChild(el('rect', { x: bx, y: PT + (H - PT - PB) - bh, width: barW, height: bh, rx: 3, fill: s.color }));
      });
      const t = el('text', { x: gx, y: H - 8, 'text-anchor': 'middle', 'font-size': 9, fill: '#94A3B8' });
      t.textContent = lb; svg.appendChild(t);
    });
    container.innerHTML = ''; container.appendChild(svg);
  }

  // Batang horizontal bertumpuk: hStack(container, rows[{label,a,b,labelA,labelB}])
  function hStack(container, rows) {
    let html = '<div style="display:flex;flex-direction:column;gap:.85rem">';
    rows.forEach(r => {
      const tot = Math.max(1, r.a + r.b);
      const pa = (r.a / tot * 100).toFixed(1);
      html += `<div>
        <div class="row spread small"><b>${esc(r.label)}</b><span class="muted">${r.a + r.b} Temuan</span></div>
        <div style="display:flex;height:12px;border-radius:9999px;overflow:hidden;margin-top:4px;background:#F1F5F9">
          <div style="width:${pa}%;background:#4F46E5"></div>
          <div style="width:${(100 - pa)}%;background:#F97316"></div>
        </div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  return { line, donut, bars, hStack };
})();
