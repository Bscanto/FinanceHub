export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const monthOf = (date) => date.slice(0, 7);
export function addMonths(date, count, desiredDay) {
  const [y, m, d = 1] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + count, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(desiredDay ?? d, last));
  return first.toISOString().slice(0, 10);
}
export const dateLabel = (date) =>
  date
    ? new Date(date.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : '—';
export const monthLabel = (month) =>
  new Date(month.slice(0, 7) + '-01T12:00:00Z').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
export function invoiceDate(purchased, closingDay, dueDay, offset = 0) {
  const day = Number(purchased.slice(8, 10));
  const closing = addMonths(purchased.slice(0, 7) + '-01', 0, closingDay);
  const afterClose = day >= Number(closing.slice(8, 10));
  return addMonths(
    purchased.slice(0, 7) + '-01',
    (afterClose ? 1 : 0) + (dueDay <= closingDay ? 1 : 0) + offset,
    dueDay,
  );
}

export function addDays(date, days) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
