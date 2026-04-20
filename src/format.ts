export function formatNumber(n: number, digits = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMoney(n: number): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatFeetInches(feet: number): string {
  if (!isFinite(feet)) return '—';
  const ft = Math.floor(feet);
  const inches = (feet - ft) * 12;
  return `${ft}' ${inches.toFixed(1)}"`;
}
