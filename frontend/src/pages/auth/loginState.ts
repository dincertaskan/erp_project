/** Kayıt ekranından dönüldüğünde gelen bilgi */
export interface LoginLocationState {
  registeredEmail?: string;
}

/** Yönlendirme durumu dışarıdan gelebilir (geçmiş, elle değiştirilmiş state); yalnızca metin e-posta kabul edilir. */
export function registeredEmailFrom(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('registeredEmail' in state)) return undefined;
  const { registeredEmail } = state;
  return typeof registeredEmail === 'string' && registeredEmail ? registeredEmail : undefined;
}
