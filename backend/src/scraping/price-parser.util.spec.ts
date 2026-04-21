import { parsePrice } from './price-parser.util';

describe('parsePrice', () => {
  it.each<[string, number | null]>([
    ['$1.299,99', 1299.99], // EU: último separador es coma
    ['1,299.99', 1299.99], // US: último separador es punto
    ['1299,99', 1299.99], // solo coma → decimal
    ['1299.99', 1299.99], // solo punto → decimal
    ['  $ 850 ', 850], // trim + símbolo
    ['850', 850], // dígitos puros
  ])('parsea "%s" → %s', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each<[string]>([[''], ['   '], ['0'], ['-50'], ['sin precio'], ['abc']])(
    'retorna null para "%s"',
    (input) => {
      expect(parsePrice(input)).toBeNull();
    },
  );

  it('edge case: "1.299" sin coma se resuelve como decimal 1.299', () => {
    expect(parsePrice('1.299')).toBe(1.299);
  });
});

// Comprehensive edge cases for bug fix verification
it.each<[string, number | null]>([
  // US format (thousands separator: comma, decimal: dot)
  ['€1,299.99', 1299.99],
  ['$1,000.99', 1000.99],
  ['1,234,567.89', 1234567.89],
  // EU format (thousands separator: dot, decimal: comma)
  ['€1.299,99', 1299.99],
  ['$1.000,99', 1000.99],
  ['1.234.567,89', 1234567.89],
  // Edge: single digit decimal
  ['€1,2', 1.2],
  ['€1,0', 1.0],
  ['€1.2', 1.2],
  // Edge: very small price
  ['€0.01', 0.01],
  ['€0,01', 0.01],
])('should handle format detection: "%s" → %s', (input, expected) => {
  expect(parsePrice(input)).toBe(expected);
});
