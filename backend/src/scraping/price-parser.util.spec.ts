import { parsePrice } from './price-parser.util';

describe('parsePrice', () => {
  it.each<[string, number | null]>([
    ['$1.299,99', 1299.99],   // EU: último separador es coma
    ['1,299.99', 1299.99],    // US: último separador es punto
    ['1299,99', 1299.99],     // solo coma → decimal
    ['1299.99', 1299.99],     // solo punto → decimal
    ['  $ 850 ', 850],        // trim + símbolo
    ['850', 850],             // dígitos puros
  ])('parsea "%s" → %s', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each<[string]>([
    [''],
    ['   '],
    ['0'],
    ['-50'],
    ['sin precio'],
    ['abc'],
  ])('retorna null para "%s"', (input) => {
    expect(parsePrice(input)).toBeNull();
  });

  it('edge case: "1.299" sin coma se resuelve como decimal 1.299', () => {
    expect(parsePrice('1.299')).toBe(1.299);
  });
});
