import {esc, fmt, pct, date, equityPath, isNumber} from './model.js';

const W = 1000, H = 286, L = 8, R = 80, T = 18, B = 36;
export function lineChart(points, benchmark = [], options = {}) {
  if (points.length < 2) return '<div class="empty-chart">No continuous equity series available</div>';
  const percent = options.percent;
  const all = [...points, ...benchmark].filter(p => isNumber(p.v));
  let lo = Math.min(...all.map(p => p.v)), hi = Math.max(...all.map(p => p.v));
  const padding = (hi - lo) * .12 || (percent ? .01 : 100);
  lo -= padding; hi += padding;
  const t0 = points[0].t, t1 = points.at(-1).t;
  const x = t => L + (t - t0) / (t1 - t0 || 1) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const main = equityPath(points, x, y);
  const ref = equityPath(benchmark.filter(p => p.t >= t0 && p.t <= t1), x, y);
  const ticks = Array.from({length: 5}, (_, i) => {
    const v = hi - (hi - lo) * i / 4;
    return `<line class="chart-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-label" x="${W - R + 17}" y="${y(v) + 4}">${percent ? fmt(v * 100, 1) + '%' : fmt(v, 0)}</text>`;
  }).join('');
  const dates = Array.from({length: 5}, (_, i) => {
    const t = t0 + (t1 - t0) * i / 4;
    return `<text class="chart-label" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" x="${x(t)}" y="${H - 5}">${date(t).slice(0, 7).replace('-', '.')}</text>`;
  }).join('');
  const base = y(Math.max(lo, Math.min(hi, percent ? 0 : (options.initial || 10000))));
  const area = !main.includes(' M') ? `<path class="chart-area ${percent ? 'drawdown-area' : ''}" d="${main} L${x(points.at(-1).t)},${percent ? base : H-B} L${x(points[0].t)},${percent ? base : H-B} Z"/>` : '';
  return `<div class="chart-interaction ${percent ? 'drawdown-chart' : ''}" data-chart="${options.id || 'main'}" tabindex="0" role="img" aria-label="${percent ? 'Drawdown curve' : 'Account equity curve'}, ${esc(date(t0))} to ${esc(date(t1))}. Use arrow keys to inspect values${percent ? '' : ', drag to select a range'}.">
    <svg class="equity-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="fill-${options.id || 'main'}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="fill-stop" stop-opacity=".12"/><stop offset="100%" class="fill-stop" stop-opacity="0"/></linearGradient></defs>
    ${ticks}${dates}${area}${ref ? `<path class="benchmark-line" d="${ref}"/>` : ''}<path class="main-line ${percent ? 'drawdown-line' : ''}" d="${main}"/><circle class="last-point" cx="${x(points.at(-1).t)}" cy="${y(points.at(-1).v)}" r="3.5"/>
    <rect class="brush" x="0" y="${T}" width="0" height="${H - T - B}"/><line class="crosshair" x1="0" x2="0" y1="${T}" y2="${H - B}"/><circle class="hover-point" r="4"/></svg>
    <div class="chart-tooltip" hidden></div>
  </div>`;
}

export function bindChart(element, points, options = {}) {
  if (!element || points.length < 2) return;
  const tooltip = element.querySelector('.chart-tooltip'), line = element.querySelector('.crosshair');
  const circle = element.querySelector('.hover-point'), brush = element.querySelector('.brush');
  const svg = element.querySelector('svg');
  const all = [...points, ...(options.benchmark || [])];
  let lo = Math.min(...all.map(p => p.v)), hi = Math.max(...all.map(p => p.v));
  const padding = (hi - lo) * .12 || (options.percent ? .01 : 100); lo -= padding; hi += padding;
  const t0 = points[0].t, t1 = points.at(-1).t;
  const x = t => L + (t - t0) / (t1 - t0 || 1) * (W - L - R);
  const indexAt = clientX => {
    const rect = svg.getBoundingClientRect();
    const vx = Math.max(L, Math.min(W-R, (clientX-rect.left) / rect.width * W));
    const t = t0 + (vx-L) / (W-L-R) * (t1-t0);
    let best = 0;
    for (let i=1; i<points.length; i++) if (Math.abs(points[i].t-t) < Math.abs(points[best].t-t)) best=i;
    return best;
  };
  let current = points.length-1, start = null;
  const show = i => {
    current = i;
    const p = points[i], px = x(p.t), py = T + (hi-p.v)/(hi-lo)*(H-T-B);
    line.setAttribute('x1', px); line.setAttribute('x2', px); line.style.opacity='1';
    circle.setAttribute('cx', px); circle.setAttribute('cy', py); circle.style.opacity='1';
    tooltip.hidden=false;
    tooltip.innerHTML=`<span>${date(p.t)} · UTC</span><strong>${options.percent ? pct(p.v) : fmt(p.v) + ' ' + esc(options.currency || 'USDT')}</strong>`;
    tooltip.style.left=`${Math.max(0, Math.min(75, px/W*100))}%`;
  };
  element.addEventListener('pointermove', e => {
    const i=indexAt(e.clientX); show(i);
    if (start !== null) { const a=x(points[start].t), b=x(points[i].t); brush.setAttribute('x',Math.min(a,b)); brush.setAttribute('width',Math.abs(b-a)); }
  });
  element.addEventListener('pointerleave', () => { if(start===null) {tooltip.hidden=true;line.style.opacity='0';circle.style.opacity='0';} });
  if (!options.percent) {
    element.addEventListener('pointerdown', e => {if(e.button!==0)return;start=indexAt(e.clientX);element.setPointerCapture(e.pointerId);});
    element.addEventListener('pointerup', e => {
      if(start===null)return;
      const end=indexAt(e.clientX), first=start;start=null;brush.setAttribute('width','0');
      if(Math.abs(end-first)>2) element.dispatchEvent(new CustomEvent('chart-range',{bubbles:true,detail:{start:points[Math.min(first,end)].t,end:points[Math.max(first,end)].t}}));
    });
    element.addEventListener('pointercancel',()=>{start=null;brush.setAttribute('width','0');});
  }
  element.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(Math.max(0,Math.min(points.length-1,current+(e.key==='ArrowLeft'?-1:1))));}});
}

export function bars(rows, valueKey = 'pnl') {
  const max = Math.max(...rows.map(r=>Math.abs(r[valueKey] || 0)),1);
  return `<div class="bar-chart">${rows.map((r,i)=>`<div class="bar-row"><span>${esc(r.label?.split('_')[0] || r.symbol || `Event${i+1}`)}</span><div class="bar-track"><div class="bar ${r[valueKey]>=0?'up':'down'}" style="width:${Math.abs(r[valueKey])/max*100}%"></div></div><strong class="${r[valueKey]>=0?'positive':'negative'}">${fmt(r[valueKey])}</strong></div>`).join('')}</div>`;
}
