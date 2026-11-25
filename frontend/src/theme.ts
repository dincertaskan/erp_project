import type { ThemeConfig } from 'antd';

export const colors = {
  primary: '#4F46E5',
  primaryHover: '#4338CA',
  primarySoft: '#EEF2FF',
  sider: '#0F172A',
  siderHover: '#1E293B',
  siderText: '#CBD5E1',
  pageBg: '#F3F4F6',
  border: '#E5E7EB',
  tableHeaderBg: '#F9FAFB',
  text: '#111827',
  textSecondary: '#4B5563',
  // Yalnızca süsleyici ikonlar için; metinde AA kontrastı (4,5:1) sağlamaz.
  textMuted: '#9CA3AF',
  // Soluk metinler (alt bilgi, pasif işlem): beyaz ve açık gri zeminde AA kontrastında.
  textSubtle: '#6B7280',
} as const;

export const fontFamily =
  "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorSuccess: '#059669',
    colorError: '#DC2626',
    colorWarning: '#D97706',
    colorInfo: '#2563EB',
    colorText: colors.text,
    colorTextSecondary: colors.textSecondary,
    colorBorderSecondary: colors.border,
    colorBgLayout: colors.pageBg,
    borderRadius: 8,
    fontFamily,
    fontSize: 14,
    controlHeight: 36,
  },
  components: {
    Table: {
      headerBg: colors.tableHeaderBg,
      headerColor: '#6B7280',
      rowHoverBg: colors.tableHeaderBg,
      rowSelectedBg: colors.primarySoft,
    },
    Layout: {
      headerBg: '#FFFFFF',
      bodyBg: colors.pageBg,
    },
  },
};

/** ProLayout yan menü ve üst çubuk renkleri */
export const layoutToken = {
  bgLayout: colors.pageBg,
  header: {
    colorBgHeader: '#FFFFFF',
    heightLayoutHeader: 56,
  },
  sider: {
    colorMenuBackground: colors.sider,
    colorMenuItemDivider: '#334155',
    colorTextMenu: colors.siderText,
    colorTextMenuSecondary: colors.siderText,
    colorTextMenuSelected: '#FFFFFF',
    colorTextMenuActive: '#FFFFFF',
    colorTextMenuItemHover: '#FFFFFF',
    colorBgMenuItemHover: colors.siderHover,
    colorBgMenuItemSelected: colors.primary,
    colorBgMenuItemCollapsedElevated: colors.sider,
    colorTextCollapsedButton: colors.siderText,
    colorTextCollapsedButtonHover: '#FFFFFF',
    colorTextSubMenuSelected: '#FFFFFF',
  },
};
