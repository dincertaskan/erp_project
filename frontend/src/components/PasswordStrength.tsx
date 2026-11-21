import { Progress, Typography } from 'antd';
import { PASSWORD_HINT, passwordScore } from '@/utils/password';

const levels = [
  { label: 'Zayıf', color: '#DC2626' },
  { label: 'Zayıf', color: '#DC2626' },
  { label: 'Zayıf', color: '#DC2626' },
  { label: 'Orta', color: '#D97706' },
  { label: 'Güçlü', color: '#059669' },
];

/** Şifre alanının altında kural karşılama durumunu gösterir */
export function PasswordStrength({ value }: { value?: string }) {
  const score = value ? passwordScore(value) : 0;
  const level = levels[score];
  return (
    <div style={{ marginTop: -16, marginBottom: 16 }}>
      {value ? (
        <Progress
          percent={score * 25}
          steps={4}
          size={[64, 4]}
          showInfo={false}
          strokeColor={level.color}
          aria-label={`Şifre gücü: ${level.label}`}
        />
      ) : null}
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
        {value ? `${level.label} · ` : ''}
        {PASSWORD_HINT}
      </Typography.Text>
    </div>
  );
}
