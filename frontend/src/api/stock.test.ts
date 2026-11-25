import { availableFromDetails } from './stock';

describe('availableFromDetails', () => {
  it('reads the available stock from the first detail', () => {
    expect(availableFromDetails([{ product_id: 7, available: 2 }])).toBe(2);
    expect(availableFromDetails([{ available: 0 }])).toBe(0);
  });

  it.each([
    ['missing details', undefined],
    ['an object instead of a list', { available: 2 }],
    ['an empty list', []],
    ['a non-object item', ['2']],
    ['a null item', [null]],
    ['no available field', [{ requested: 3 }]],
    ['a string count', [{ available: '2' }]],
    ['a non-finite count', [{ available: Number.NaN }]],
  ])('ignores %s', (_, details) => {
    expect(availableFromDetails(details)).toBeUndefined();
  });
});
