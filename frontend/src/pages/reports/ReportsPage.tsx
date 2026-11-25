import { DownloadOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/plots';
import { PageContainer } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Card, Col, DatePicker, Empty, Row, Select, Space, Statistic, Table, Tabs, Tooltip } from 'antd';
import { useState } from 'react';
import { useCategories } from '@/api/catalog';
import { api, errorMessage } from '@/api/client';
import { colors } from '@/theme';
import { formatCurrency, formatNumber } from '@/utils/format';
import { OrderReportTab } from './OrderReportTab';
import { downloadReport, defaultRange, getRangePresets, rangeParams, type DateRange } from './reportShared';
import { StockReportTab } from './StockReportTab';

type GroupBy = 'day' | 'week' | 'month' | 'product' | 'category';

interface SalesRow {
  period: string | null;
  label: string;
  order_count: number;
  quantity: number;
  revenue: string;
  cost: string;
  gross_profit: string;
}

interface SalesReport {
  rows: SalesRow[];
  totals: Omit<SalesRow, 'period' | 'label'>;
}

interface ReportFilters {
  range: DateRange;
  groupBy: GroupBy;
  categoryId?: number;
}

const groupOptions: { value: GroupBy; label: string }[] = [
  { value: 'day', label: 'Gün' },
  { value: 'week', label: 'Hafta' },
  { value: 'month', label: 'Ay' },
  { value: 'product', label: 'Ürün' },
  { value: 'category', label: 'Kategori' },
];

const toParams = (filters: ReportFilters) => ({
  ...rangeParams(filters.range),
  group_by: filters.groupBy,
  category_id: filters.categoryId,
});

const money = (value: string) => <span className="tabular-nums">{formatCurrency(value)}</span>;

/** E-25 Raporlar: satış, stok ve sipariş raporları. Ciro onaylanmış ve iptal edilmemiş siparişlerden hesaplanır. */
export function ReportsPage() {
  const { message } = App.useApp();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState<ReportFilters>(() => ({ range: defaultRange(), groupBy: 'day' }));
  const [applied, setApplied] = useState<ReportFilters>(draft);
  const [downloading, setDownloading] = useState(false);

  const report = useQuery({
    queryKey: ['reports', 'sales', toParams(applied)],
    queryFn: async () => (await api.get<SalesReport>('/reports/sales', { params: toParams(applied) })).data,
  });

  const download = async () => {
    setDownloading(true);
    try {
      await downloadReport('/reports/sales', toParams(applied), 'satis-raporu.xlsx');
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const timeGrouped = ['day', 'week', 'month'].includes(applied.groupBy);
  const rows = report.data?.rows ?? [];
  const hasData = rows.some((row) => row.order_count > 0);
  const totals = report.data?.totals;

  const salesTab = (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space wrap size={12}>
          <DatePicker.RangePicker
            allowClear={false}
            value={draft.range}
            presets={getRangePresets()}
            format="DD.MM.YYYY"
            onChange={(value) => value && setDraft((d) => ({ ...d, range: value as DateRange }))}
          />
          <Select
            allowClear
            placeholder="Tüm kategoriler"
            style={{ width: 200 }}
            value={draft.categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(categoryId?: number) => setDraft((d) => ({ ...d, categoryId }))}
          />
          <Select
            style={{ width: 150 }}
            value={draft.groupBy}
            options={groupOptions.map((o) => ({ ...o, label: `Gruplama: ${o.label}` }))}
            onChange={(groupBy: GroupBy) => setDraft((d) => ({ ...d, groupBy }))}
          />
          <Button type="primary" onClick={() => setApplied(draft)}>
            Listele
          </Button>
          <Button icon={<DownloadOutlined />} loading={downloading} disabled={!hasData} onClick={download}>
            Excel'e Aktar
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Card loading={report.isPending}>
            <Statistic title="Ciro" value={totals ? formatCurrency(totals.revenue) : '–'} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card loading={report.isPending}>
            <Statistic title="Brüt Kâr" value={totals ? formatCurrency(totals.gross_profit) : '–'} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card loading={report.isPending}>
            <Statistic title="Sipariş" value={totals?.order_count ?? '–'} groupSeparator="." />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card loading={report.isPending}>
            <Statistic title="Satılan Adet" value={totals?.quantity ?? '–'} groupSeparator="." />
          </Card>
        </Col>
      </Row>

      {timeGrouped && hasData ? (
        <Card title="Ciro">
          <Column
            data={rows.map((row) => ({ label: row.label, revenue: Number(row.revenue) }))}
            xField="label"
            yField="revenue"
            height={220}
            autoFit
            style={{ fill: colors.primary, radiusTopLeft: 4, radiusTopRight: 4, maxWidth: 32 }}
            axis={{
              x: { labelAutoRotate: false, tickFilter: (_: unknown, i: number) => rows.length <= 12 || i % 5 === 0 },
              y: { labelFormatter: (v: number) => formatCurrency(v).replace(',00', ''), gridStrokeOpacity: 0.4 },
            }}
            tooltip={{ items: [{ channel: 'y', name: 'Ciro', valueFormatter: (v: number) => formatCurrency(v) }] }}
          />
        </Card>
      ) : null}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<SalesRow>
          rowKey={(row) => row.period ?? row.label}
          loading={report.isPending}
          dataSource={hasData ? rows : []}
          pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
          scroll={{ x: 820 }}
          locale={{ emptyText: <Empty description="Seçilen aralıkta kayıt yok." /> }}
          columns={[
            { title: groupOptions.find((o) => o.value === applied.groupBy)?.label, dataIndex: 'label' },
            { title: 'Sipariş Sayısı', dataIndex: 'order_count', align: 'right', render: formatNumber },
            { title: 'Satılan Adet', dataIndex: 'quantity', align: 'right', render: formatNumber },
            { title: 'Ciro', dataIndex: 'revenue', align: 'right', render: money },
            {
              title: (
                <Tooltip title="Ürünlerin güncel maliyetiyle hesaplanır">
                  <span>Maliyet</span>
                </Tooltip>
              ),
              dataIndex: 'cost',
              align: 'right',
              render: money,
            },
            { title: 'Brüt Kâr', dataIndex: 'gross_profit', align: 'right', render: money },
          ]}
          summary={() =>
            totals && hasData ? (
              <Table.Summary.Row style={{ fontWeight: 600 }}>
                <Table.Summary.Cell index={0}>Toplam</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  {formatNumber(totals.order_count)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  {formatNumber(totals.quantity)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  {money(totals.revenue)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  {money(totals.cost)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  {money(totals.gross_profit)}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>
    </Space>
  );

  return (
    <PageContainer title="Raporlar">
      <Tabs
        defaultActiveKey="sales"
        items={[
          { key: 'sales', label: 'Satış Raporu', children: salesTab },
          { key: 'stock', label: 'Stok Raporu', children: <StockReportTab /> },
          { key: 'orders', label: 'Sipariş Raporu', children: <OrderReportTab /> },
        ]}
      />
    </PageContainer>
  );
}
