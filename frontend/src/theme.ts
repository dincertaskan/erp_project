import type { ThemeConfig } from 'antd';

export const colors = {
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryActive: '#1E40AF',
  primarySoft: '#EFF6FF',
  primarySoftBorder: '#BFDBFE',
  /** Logo yazısı gibi koyu lacivert vurgular */
  brand: '#1E3A8A',
  pageBg: '#F1F5F9',
  surface: '#FFFFFF',
  /** Menü ve tablo satırlarının üzerine gelindiğinde */
  surfaceHover: '#F8FAFC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  tableHeaderBg: '#F8FAFC',
  text: '#0F172A',
  /** Logo alt satırı gibi koyu ikincil metin */
  textStrong: '#334155',
  textSecondary: '#475569',
  // Yalnızca süsleyici ikonlar için; metinde AA kontrastı (4,5:1) sağlamaz.
  textMuted: '#94A3B8',
  // Soluk metinler (ör. pasif işlem): beyaz zeminde AA kontrastında (4,8:1); gri sayfa zemininde textSecondary kullanılır.
  textSubtle: '#64748B',
} as const;

export const fontFamily =
  "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorPrimaryHover: colors.primaryHover,
    colorPrimaryActive: colors.primaryActive,
    colorSuccess: '#059669',
    colorError: '#DC2626',
    colorWarning: '#D97706',
    colorInfo: colors.primary,
    colorLink: colors.primary,
    colorLinkHover: colors.primaryHover,
    colorLinkActive: colors.primaryActive,
    colorText: colors.text,
    colorTextSecondary: colors.textSecondary,
    colorTextDescription: colors.textSubtle,
    colorBorder: colors.borderStrong,
    colorBorderSecondary: colors.border,
    colorBgLayout: colors.pageBg,
    colorBgContainer: colors.surface,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    fontFamily,
    fontSize: 14,
    controlHeight: 36,
    boxShadowTertiary: 'none',
  },
  components: {
    // Typography type="success" / "warning" metin olarak kullanılır; etiket ve düğme renkleri değişmeden
    // yalnızca yazıda AA kontrastına (beyaz zeminde 4,5:1) uyan koyu tonlar.
    Typography: {
      colorSuccess: '#047857',
      colorWarning: '#B45309',
    },
    Table: {
      headerBg: colors.tableHeaderBg,
      headerColor: colors.textSubtle,
      rowHoverBg: colors.surfaceHover,
      rowSelectedBg: colors.primarySoft,
      borderColor: colors.border,
    },
    Layout: {
      headerBg: colors.surface,
      bodyBg: colors.pageBg,
      siderBg: colors.pageBg,
    },
    Card: {
      borderRadiusLG: 12,
      colorBorderSecondary: colors.border,
    },
    Button: {
      borderRadius: 8,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      fontWeight: 500,
    },
    Input: { borderRadius: 8 },
    Select: { borderRadius: 8 },
    Tag: { borderRadiusSM: 6 },
    Statistic: {
      titleFontSize: 14,
    },
    Menu: {
      itemSelectedBg: colors.primarySoft,
      itemSelectedColor: colors.primary,
    },
    Modal: { borderRadiusLG: 16 },
  },
};
