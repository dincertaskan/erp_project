import type { RuleObject } from 'antd/es/form';
import { PASSWORD_MAX_LENGTH, passwordRules } from './password';

describe('password length limit', () => {
  it('matches the API limit of 128 characters', () => {
    const maxRule = passwordRules.find((rule): rule is RuleObject => typeof rule === 'object' && 'max' in rule);

    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(maxRule?.max).toBe(128);
    expect(maxRule?.message).toBe('Şifre en fazla 128 karakter olabilir.');
  });
});
