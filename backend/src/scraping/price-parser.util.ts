export function parsePrice(text: string): number | null {
  if (!text || !text.trim()) return null;

  const trimmed = text.trim();

  // Check for negative sign before cleaning
  if (trimmed.includes('-')) return null;

  const cleaned = trimmed.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;

  if (lastComma > lastDot) {
    // European format: last separator is comma → decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // American format: last separator is dot → decimal
    normalized = cleaned.replace(/,/g, '');
  } else {
    // No separators
    normalized = cleaned;
  }

  const value = parseFloat(normalized);
  return isNaN(value) || value <= 0 ? null : value;
}
