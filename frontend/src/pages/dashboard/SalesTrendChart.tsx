import { Area } from '@ant-design/plots';
import type { Granularity, TrendPoint } from '@/api/dashboard';
import { colors } from '@/theme';
import { formatCurrency, formatWithMonthName } from '@/utils/format';

const compactCurrency = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });

/** Tek seri: lejant yok, başlık seriyi adlandırır. Çizgi 2px, dolgu düz ve hafif. */
export function SalesTrendChart({ data, granularity }: { data: TrendPoint[]; granularity: Granularity }) {
  const points = data.map((point) => ({
    label: formatWithMonthName(point.date, granularity === 'day' ? 'D MMM' : 'MMM YY'),
    amount: Number(point.amount),
    orders: point.order_count,
  }));

  return (
    <Area
      data={points}
      xField="label"
      yField="amount"
      height={280}
      autoFit
      style={{ fill: colors.primary, fillOpacity: 0.12 }}
      line={{ style: { stroke: colors.primary, lineWidth: 2 } }}
      axis={{
        x: {
          tick: false,
          line: false,
          labelAutoRotate: false,
          // Günlük görünümde her beşinci gün yazılır; aylıkta tüm aylar.
          tickFilter: (_: unknown, index: number) => granularity === 'month' || index % 5 === 0,
        },
        y: { labelFormatter: (value: number) => `${compactCurrency.format(value)} ₺`, gridStrokeOpacity: 0.4 },
      }}
      tooltip={{
        title: 'label',
        items: [
          { channel: 'y', name: 'Satış', valueFormatter: (value: number) => formatCurrency(value) },
          { field: 'orders', name: 'Sipariş', valueFormatter: (value: number) => `${value} adet` },
        ],
      }}
      interaction={{ tooltip: { crosshairs: true } }}
    />
  );
}
