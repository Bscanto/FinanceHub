export const MAX_CENTS = 100_000_000_000;
export function cents(input) {
  const value = String(input)
    .trim()
    .replace(/^R\$\s*/, '');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value))
    throw new Error('Use um valor brasileiro, como 1.234,56.');
  const [whole, fraction = ''] = value.replaceAll('.', '').replace('-', '').split(',');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > MAX_CENTS)
    throw new Error('Valor fora do limite permitido.');
  return value.startsWith('-') ? -result : result;
}
export const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
export const moneyInput = (value = 0) =>
  (value / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
export function splitCents(amount, count) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 360 ||
    amount < count
  )
    throw new Error('Parcelamento inválido.');
  const base = Math.floor(amount / count),
    remainder = amount % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
export function percentage(amount, basisPoints) {
  return Number((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n);
}
