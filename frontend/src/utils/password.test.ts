import { passwordProblem, passwordScore } from './password';

describe('password rules', () => {
  it('reports the first unmet rule in Turkish', () => {
    expect(passwordProblem('kisa')).toBe('Şifre en az 8 karakter olmalıdır.');
    expect(passwordProblem('kucukharf1')).toBe('Şifre en az bir büyük harf içermelidir.');
    expect(passwordProblem('BUYUKHARF1')).toBe('Şifre en az bir küçük harf içermelidir.');
    expect(passwordProblem('Rakamsizsifre')).toBe('Şifre en az bir rakam içermelidir.');
  });

  it('accepts Turkish letters like the server does', () => {
    expect(passwordProblem('Çiğdem2026')).toBeNull();
    expect(passwordProblem('ŞİFREçok1')).toBeNull();
  });

  it('counts met rules for the strength bar', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(2);
    expect(passwordScore('Demo1234')).toBe(4);
  });
});
