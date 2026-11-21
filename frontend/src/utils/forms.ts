import type { FormInstance } from 'antd';
import { ApiError, errorMessage } from '@/api/client';

/**
 * Sunucudan gelen alan hatalarını form alanlarına yazar.
 * Forma ait olmayan hatalar için genel mesajı döndürür; hepsi alanlara yazıldıysa null döner.
 */
export function applyServerErrors(form: FormInstance, error: unknown): string | null {
  if (!(error instanceof ApiError)) return errorMessage(error);

  const known = new Set(Object.keys(form.getFieldsValue(true)));
  const fieldErrors = error.fieldErrors.filter((item) => known.has(item.field));
  if (fieldErrors.length === 0) return error.message;

  form.setFields(fieldErrors.map((item) => ({ name: item.field, errors: [item.message] })));
  return fieldErrors.length === error.fieldErrors.length ? null : error.message;
}
