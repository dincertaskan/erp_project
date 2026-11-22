export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: '#4F46E5',
        color: '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      ERP
    </span>
  );
}
