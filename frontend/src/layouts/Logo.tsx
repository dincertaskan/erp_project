import { colors } from '@/theme';

interface LogoProps {
  /** Personel paneli "Akıllı Yönetim", mağaza "Akıllı Mağaza" yazar */
  variant?: 'staff' | 'shop';
  /** Dar alanlarda (ör. mobil üst çubuk) küçük boyut */
  compact?: boolean;
}

/** Yazı logosu: ince "ERP", dikey çizgi ve iki satırlık büyük harf alt yazı */
export function Logo({ variant = 'staff', compact = false }: LogoProps) {
  return (
    <span className={compact ? 'brand-wordmark brand-wordmark--compact' : 'brand-wordmark'}>
      <span className="brand-wordmark__name">ERP</span>
      <span className="brand-wordmark__divider" aria-hidden="true" />
      <span className="brand-wordmark__tagline">
        <span>Akıllı</span> <span>{variant === 'shop' ? 'Mağaza' : 'Yönetim'}</span>
      </span>
    </span>
  );
}

/** Kare logo: küçük alanlar için */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        background: colors.primary,
        color: '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.34),
        fontWeight: 600,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      ERP
    </span>
  );
}
