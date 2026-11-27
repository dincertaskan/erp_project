import type { AuditEvent } from '@/utils/labels';

/** Denetim günlüğü kaydı (GET /audit-logs) */
export interface AuditLog {
  id: number;
  created_at: string;
  event_type: AuditEvent;
  /** Başarısız girişlerde boştur; denenen e-posta entity_label'dadır. */
  actor: { id: number; full_name: string; email: string } | null;
  entity_type: 'user' | 'customer' | 'product' | 'order';
  entity_id: number | null;
  /** Kaydın o anki okunur adı: e-posta, SKU ya da sipariş kodu */
  entity_label: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
}
