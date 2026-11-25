import { DownloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Card, DatePicker, Empty, Select, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import { OrderStatusTag } from '@/components/StatusTag';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { orderStatusLabels, type OrderStatus } from '@/utils/labels';
import { downloadReport, defaultRange, getRangePresets, rangeParams, type DateRange } from './reportShared';

interface OrderRow {
  id: number;
  order_code: string;
  created_at: string;
  customer: string;
  item_count: number;
  total_amount: string;
  status: OrderStatus;
  approved_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
}

interface OrderReport {
  rows: OrderRow[];
  total: number;
  total_amount: string;
}

interface Filters {
  range: DateRange;
  statuses: OrderStatus[];
}

const PAGE_SIZE = 50;

/** Sipariş Raporu: aralıktaki siparişler ve durum tarihleri. */
export function OrderReportTab() {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<Filters>(() => ({ range: defaultRange(), statuses: [] }));
  const [applied, setApplied] = useState<Filters>(draft);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const params = { ...rangeParams(applied.range), status: applied.statuses.length ? applied.statuses : undefined };

  const report = useQuery({
    queryKey: ['reports', 'orders', params, page],
    queryFn: async () =>
      (
        await api.get<OrderReport>('/reports/orders', {
          params: { ...params, page, page_size: PAGE_SIZE },
          paramsSerializer: { indexes: null },
        })
      ).data,
    placeholderData: (previous) => previous,
  });

  const download = async () => {
    setDownloading(true);
    try {
      await downloadReport('/reports/orders', params, 'siparis-raporu.xlsx');
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const total = report.data?.total ?? 0;

  return (
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
            mode="multiple"
            allowClear
            placeholder="Tüm durumlar"
            style={{ minWidth: 220 }}
            maxTagCount="responsive"
            value={draft.statuses}
            options={Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label }))}
            onChange={(statuses: OrderStatus[]) => setDraft((d) => ({ ...d, statuses }))}
          />
          <Button
            type="primary"
            onClick={() => {
              setApplied(draft);
              setPage(1);
            }}
          >
            Listele
          </Button>
          <Button icon={<DownloadOutlined />} loading={downloading} disabled={total === 0} onClick={download}>
            Excel'e Aktar
          </Button>
          {report.data ? (
            <Typography.Text type="secondary">
              {total} sipariş · {formatCurrency(report.data.total_amount)}
            </Typography.Text>
          ) : null}
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<OrderRow>
          rowKey="id"
          loading={report.isPending}
          dataSource={report.data?.rows ?? []}
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="Seçilen aralıkta kayıt yok." /> }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: setPage,
          }}
          columns={[
            {
              title: 'Sipariş Kodu',
              dataIndex: 'order_code',
              render: (_, row) => <Link to={`/orders/${row.id}`}>{row.order_code}</Link>,
            },
            { title: 'Tarih', dataIndex: 'created_at', render: formatDateTime },
            { title: 'Müşteri', dataIndex: 'customer' },
            { title: 'Kalem', dataIndex: 'item_count', align: 'right' },
            {
              title: 'Tutar',
              dataIndex: 'total_amount',
              align: 'right',
              render: (value: string) => <span className="tabular-nums">{formatCurrency(value)}</span>,
            },
            { title: 'Durum', dataIndex: 'status', render: (value: OrderStatus) => <OrderStatusTag status={value} /> },
            { title: 'Onay', dataIndex: 'approved_at', render: formatDateTime },
            { title: 'Kargo', dataIndex: 'shipped_at', render: formatDateTime },
            { title: 'Teslim', dataIndex: 'completed_at', render: formatDateTime },
          ]}
        />
      </Card>
    </Space>
  );
}
