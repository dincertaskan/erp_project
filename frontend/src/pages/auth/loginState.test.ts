import { registeredEmailFrom } from './loginState';

describe('registeredEmailFrom', () => {
  it('returns the e-mail passed from the register page', () => {
    expect(registeredEmailFrom({ registeredEmail: 'yeni@example.com' })).toBe('yeni@example.com');
  });

  it.each([
    ['no state', null],
    ['a string state', 'yeni@example.com'],
    ['an unrelated object', { from: '/shop' }],
    ['a non-string e-mail', { registeredEmail: 42 }],
    ['an empty e-mail', { registeredEmail: '' }],
  ])('ignores %s', (_, state) => {
    expect(registeredEmailFrom(state)).toBeUndefined();
  });
});
