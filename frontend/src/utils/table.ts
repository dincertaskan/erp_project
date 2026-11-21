import type { TablePaginationConfig } from 'antd';

/** Sunucu taraflı sayfalanan tabloların ortak ayarı (20 / 50 / 100) */
export const tablePagination: TablePaginationConfig = {
  defaultPageSize: 20,
  pageSizeOptions: [20, 50, 100],
  showSizeChanger: true,
  // ProTable, antd'nin Türkçe sayfalama metnini kendi metniyle eziyor.
  locale: { items_per_page: '/ sayfa' },
};
