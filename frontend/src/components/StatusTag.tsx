import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import type { ReactNode } from 'react';
import {
  getStockStatus,
  movementTypeLabels,
  orderStatusLabels,
  roleLabels,
  stockStatusLabels,
  type OrderStatus,
  type StockMovementType,
  type StockStatus,
  type UserRole,
} from '@/utils/labels';

interface Tone {
  color: string;
  background: string;
  border: string;
}

// Yazı renkleri kendi zeminlerinde en az 4,5:1 kontrastta (WCAG AA).
const tones = {
  amber: { color: '#B45309', background: '#FEF3C7', border: '#FDE68A' },
  blue: { color: '#2563EB', background: '#EFF6FF', border: '#BFDBFE' },
  purple: { color: '#7C3AED', background: '#F5F3FF', border: '#DDD6FE' },
  green: { color: '#047857', background: '#ECFDF5', border: '#A7F3D0' },
  red: { color: '#B91C1C', background: '#FEF2F2', border: '#FECACA' },
  darkRed: { color: '#991B1B', background: '#FEE2E2', border: '#FCA5A5' },
  orange: { color: '#C2410C', background: '#FFF7ED', border: '#FED7AA' },
  gray: { color: '#475569', background: '#F1F5F9', border: '#E2E8F0' },
  navy: { color: '#1E40AF', background: '#DBEAFE', border: '#BFDBFE' },
  cyan: { color: '#0E7490', background: '#ECFEFF', border: '#A5F3FC' },
} satisfies Record<string, Tone>;

function ToneTag({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <Tag
      icon={icon}
      bordered
      style={{ color: tone.color, background: tone.background, borderColor: tone.border, marginInlineEnd: 0 }}
    >
      {children}
    </Tag>
  );
}

const orderStatusStyle: Record<OrderStatus, { tone: Tone; icon: ReactNode }> = {
  pending: { tone: tones.amber, icon: <ClockCircleOutlined /> },
  preparing: { tone: tones.blue, icon: <SyncOutlined /> },
  shipped: { tone: tones.purple, icon: <CarOutlined /> },
  completed: { tone: tones.green, icon: <CheckCircleOutlined /> },
  cancelled: { tone: tones.red, icon: <CloseCircleOutlined /> },
};

export function OrderStatusTag({ status }: { status: OrderStatus }) {
  const { tone, icon } = orderStatusStyle[status];
  return (
    <ToneTag tone={tone} icon={icon}>
      {orderStatusLabels[status]}
    </ToneTag>
  );
}

const stockStatusStyle: Record<StockStatus, { tone: Tone; icon?: ReactNode }> = {
  sufficient: { tone: tones.green },
  critical: { tone: tones.red, icon: <WarningOutlined /> },
  out_of_stock: { tone: tones.darkRed },
};

export function StockStatusTag({ stock, minStock }: { stock: number; minStock: number }) {
  return <StockStatusLabel status={getStockStatus(stock, minStock)} />;
}

export function StockStatusLabel({ status }: { status: StockStatus }) {
  const { tone, icon } = stockStatusStyle[status];
  return (
    <ToneTag tone={tone} icon={icon}>
      {stockStatusLabels[status]}
    </ToneTag>
  );
}

const movementTone: Record<StockMovementType, Tone> = {
  in: tones.green,
  out: tones.red,
  order_out: tones.orange,
  cancel_return: tones.blue,
};

export function MovementTypeTag({ type }: { type: StockMovementType }) {
  return <ToneTag tone={movementTone[type]}>{movementTypeLabels[type]}</ToneTag>;
}

/** Hareket miktarı: girişler "+50", çıkışlar "−3" */
export function MovementQuantity({ type, quantity }: { type: StockMovementType; quantity: number }) {
  const incoming = type === 'in' || type === 'cancel_return';
  return (
    <span style={{ color: movementTone[type].color, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
      {incoming ? '+' : '−'}
      {quantity}
    </span>
  );
}

export function ActiveTag({ active }: { active: boolean }) {
  return <ToneTag tone={active ? tones.green : tones.gray}>{active ? 'Aktif' : 'Pasif'}</ToneTag>;
}

const roleTone: Record<UserRole, Tone> = {
  admin: tones.navy,
  warehouse: tones.cyan,
  customer: tones.green,
};

export function RoleTag({ role }: { role: UserRole }) {
  return <ToneTag tone={roleTone[role]}>{roleLabels[role]}</ToneTag>;
}
