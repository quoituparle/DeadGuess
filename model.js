/** Pure presentation helpers; no strategy or execution logic belongs here. */
export const isNumber = n => typeof n === 'number' && Number.isFinite(n);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = (n, digits = 2) => isNumber(n) ? new Intl.NumberFormat('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(n) : '—';
export const pct = n => isNumber(n) ? `${n > 0 ? '+' : ''}${fmt(n * 100)}%` : '—';
export const signed = n => isNumber(n) ? `${n > 0 ? '+' : ''}${fmt(n)}` : '—';
export const tone = n => !isNumber(n) || n === 0 ? '' : n > 0 ? 'positive' : 'negative';
export const date = t => t == null || Number.isNaN(new Date(t).valueOf()) ? '—' : new Date(t).toISOString().slice(0, 10);
export const dateTime = t => t == null || Number.isNaN(new Date(t).valueOf()) ? '—' : new Date(t).toISOString().slice(0, 16).replace('T', ' ');
export const stageName = id => ({development: 'Development', validation: 'Validation', confirmation: 'Confirmation'}[id] || id || 'No available stage');
const decisions = {
  evidence_against_economic_usefulness: ['Economic gate failed', 'negative'],
  evidence_against_endpoint: ['Economic gate failed', 'negative'],
  insufficient_evidence: ['Insufficient evidence', 'neutral'],
  execution_infeasible: ['Execution infeasible', 'warning'],
  data_acquisition_failure: ['Data gate failed', 'warning'],
  data_gate_failed: ['Data gate failed', 'warning'],
  descriptive_partial_audit_only: ['Partial audit only', 'warning'],
};
export const decision = id => decisions[id] || [id || 'Not evaluated', 'neutral'];
export function pickStage(experiment, id) {
  return experiment?.stages?.find(s => s.id === id) || experiment?.stages?.find(s => s.id === experiment.preferred_stage) || experiment?.stages?.at(-1) || null;
}
export function drawdowns(points, initial = 10000) {
  let peak = initial;
  return points.map(p => { peak = Math.max(peak, p.v); return {t: p.t, v: peak > 0 ? p.v / peak - 1 : null}; });
}
export function within(points, range) {
  return range ? points.filter(p => p.t >= range.start && p.t <= range.end) : points;
}
export function filterTrades(trades, range, query = '') {
  return trades.filter(t => String(t.symbol).toLowerCase().includes(query.toLowerCase()) && (!range || (isNumber(t.entry) && isNumber(t.exit) ? t.entry <= range.end && t.exit >= range.start : isNumber(t.entry) && (t.status === 'unresolved' ? t.entry <= range.end : t.entry >= range.start && t.entry <= range.end))));
}
export function monthlyReturns(points, initial = 10000) {
  const ends = new Map();
  for (const p of points) ends.set(date(p.t).slice(0, 7), p.v);
  let previous = initial, previousMonth = null;
  return [...ends].map(([month, value]) => {
    const [year, m] = month.split('-').map(Number), serial = year * 12 + m;
    const contiguous = previousMonth === null || serial === previousMonth + 1;
    const result = {month, value: contiguous && previous > 0 ? value / previous - 1 : null};
    previous = value; previousMonth = serial; return result;
  });
}
export function equityPath(points, x, y, maxGap = 1.5 * 86400000) {
  return points.map((p, i) => `${i === 0 || p.t - points[i - 1].t > maxGap ? 'M' : 'L'}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
}
export function csvCell(value) {
  const raw = String(value ?? '');
  // Export labels cannot become spreadsheet formulas.
  const safe = /^[=+@\-]/.test(raw) && !isNumber(value) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
