// The active app previously stored manual totals; it has no corner-weight
// calculator to reuse. Keep this one calculation shared by display and save.
export function calculatePavementWeights(state: Record<string, string>): Record<string, string> {
  const values = ['lf', 'rf', 'lr', 'rr'].map(corner => {
    const raw = (state[`${corner}_corner_weight`] ?? '').trim();
    return raw === '' ? NaN : Number(raw);
  });
  if (values.some(v => !Number.isFinite(v) || v < 0)) return {};
  const [lf, rf, lr, rr] = values;
  const total = lf + rf + lr + rr;
  if (!Number.isFinite(total)) return {};
  const format = (v: number) => String(Number(v.toFixed(2)));
  const result: Record<string, string> = {
    total_weight: format(total), cross_weight_lbs: format(rf + lr), rear_bite: format(lr - rr),
  };
  if (total > 0) Object.assign(result, {
    cross_weight: format(100 * (rf + lr) / total), left_side_pct: format(100 * (lf + lr) / total),
    rear_weight_pct: format(100 * (lr + rr) / total), front_weight_pct: format(100 * (lf + rf) / total),
  });
  return result;
}

// Earlier pavement snapshots recorded signed decimal front_toe (+ out / - in).
// Retain its key/value precision while presenting the established amount +
// In/Out control. No other class or saved snapshot is rewritten on read.
export function normalizePavementToe(state: Record<string, string>): Record<string, string> {
  const raw = state.front_toe ?? '';
  if (!raw.trim()) return {};
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return {};
  if (numeric >= 0 && state.front_toe_direction !== undefined) return {};
  return {
    front_toe: Number.isFinite(numeric) && numeric < 0 ? String(Math.abs(numeric)) : raw,
    front_toe_direction: state.front_toe_direction || (numeric < 0 ? 'in' : 'out'),
  };
}
