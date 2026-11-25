import type { Rule } from 'antd/es/form';

/** Arka uçtaki şifre kuralıyla aynı: en az 8 karakter, büyük harf, küçük harf ve rakam */
const checks: { test: (value: string) => boolean; message: string }[] = [
  { test: (v) => v.length >= 8, message: 'Şifre en az 8 karakter olmalıdır.' },
  { test: (v) => /[A-ZÇĞİÖŞÜ]/.test(v), message: 'Şifre en az bir büyük harf içermelidir.' },
  { test: (v) => /[a-zçğıöşü]/.test(v), message: 'Şifre en az bir küçük harf içermelidir.' },
  { test: (v) => /\d/.test(v), message: 'Şifre en az bir rakam içermelidir.' },
];

/** Arka uçtaki üst sınır (bcrypt öncesi) */
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_HINT = 'En az 8 karakter; büyük harf, küçük harf ve rakam';

export function passwordProblem(value: string): string | null {
  return checks.find((check) => !check.test(value))?.message ?? null;
}

/** Karşılanan kural sayısı (0-4) */
export function passwordScore(value: string): number {
  return checks.filter((check) => check.test(value)).length;
}

export const passwordRules: Rule[] = [
  { required: true, message: 'Şifre zorunludur.' },
  { max: PASSWORD_MAX_LENGTH, message: `Şifre en fazla ${PASSWORD_MAX_LENGTH} karakter olabilir.` },
  {
    validator: (_, value: string | undefined) => {
      const problem = value ? passwordProblem(value) : null;
      return problem ? Promise.reject(new Error(problem)) : Promise.resolve();
    },
  },
];

/** Şifre tekrarı alanı için: verilen alandaki değerle aynı olmalı */
export function confirmRules(field: string): Rule[] {
  return [
    { required: true, message: 'Şifre tekrarı zorunludur.' },
    ({ getFieldValue }) => ({
      validator: (_, value: string | undefined) =>
        !value || getFieldValue(field) === value
          ? Promise.resolve()
          : Promise.reject(new Error('Şifreler eşleşmiyor.')),
    }),
  ];
}
