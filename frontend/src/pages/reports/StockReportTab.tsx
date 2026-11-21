import { DownloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Card, Col, DatePicker, Empty, Row, Select, Space, Statistic, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '@/api/catalog';
import { api, errorMessage } from '@/api/client';
import { StockStatusLabel } from '@/components/StatusTag';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { StockStatus } from '@/utils/labels';
import { downloadReport, rangeParams, rangePresets, type DateRange } from './reportShared';

interface StockRow {
  product_id: number;
  sku: string;
  name: string;
  category: string;
  opening_stock: number;
  stock_in: number;
  stock_out: number;
  closing_stock: number;
  stock_value: string;
  status: string;
}

interface StockReport {
  rows: StockRow[];
  totals: { stock_in: number; stock_out: number; stock_value: string };
}

interface Filters {
  range: DateRange;
  categoryId?: number;
}

// Sunucu durumu Excel'de de kullanılan Türkçe adıyla döndürür.
const statusByLabel: Record<string, StockStatus> = {
  Yeterli: 'sufficient',
  Kritik: 'critical',
  Tükendi: 'out_of_stock',
};

/** Stok Raporu: dönem başı/sonu stok ve dönem içi giriş-çıkışlar. */
export function StockReportTab() {
  const { message } = App.useApp();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState<Filters>({ range: rangePresets[0].value });
  const [applied, setApplied] = useState<Filters>(draft);
  const [downloading, setDownloading] = useState(false);
  const params = { ...rangeParams(applied.range), category_id: applied.categoryId };

  const report = useQuery({
    queryKey: ['reports', 'stock', params],
    queryFn: async () => (await api.get<StockReport>('/reports/stock', { params })).data,
  });
  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadReport('/reports/stock', params, 'stok-raporu.xlsx');
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space wrap size={12}>
          <DatePicker.RangePicker
            allowClear={false}
            value={draft.range}
            presets={rangePresets}
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
          <Button type="primary" onClick={() => setApplied(draft)}>
            Listele
          </Button>
          <Button icon={<DownloadOutlined />} loading={downloading} disabled={rows.length === 0} onClick={download}>
            Excel'e Aktar
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card loading={report.isPending}>
            <Statistic title="Dönem İçi Giriş" value={totals?.stock_in ?? '–'} groupSeparator="." />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={report.isPending}>
            <Statistic title="Dönem İçi Çıkış" value={totals?.stock_out ?? '–'} groupSeparator="." />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={report.isPending}>
            <Statistic title="Stok Değeri (dönem sonu)" value={totals ? formatCurrency(totals.stock_value) : '–'} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StockRow>
          rowKey="product_id"
          loading={report.isPending}
          dataSource={rows}
          pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="Seçilen aralıkta kayıt yok." /> }}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 110 },
            {
              title: 'Ürün',
              dataIndex: 'name',
              render: (_, row) => <Link to={`/products/${row.product_id}`}>{row.name}</Link>,
            },
            { title: 'Kategori', dataIndex: 'category', width: 150 },
            { title: 'Dönem Başı', dataIndex: 'opening_stock', align: 'right', render: formatNumber },
            { title: 'Giriş', dataIndex: 'stock_in', align: 'right', render: formatNumber },
            { title: 'Çıkış', dataIndex: 'stock_out', align: 'right', render: formatNumber },
            { title: 'Dönem Sonu', dataIndex: 'closing_stock', align: 'right', render: formatNumber },
            {
              title: 'Stok Değeri',
              dataIndex: 'stock_value',
              align: 'right',
              render: (value: string) => <span className="tabular-nums">{formatCurrency(value)}</span>,
            },
            {
              title: 'Durum',
              dataIndex: 'status',
              render: (value: string) => <StockStatusLabel status={statusByLabel[value]} />,
            },
          ]}
        />
      </Card>
    </Space>
  );
}
