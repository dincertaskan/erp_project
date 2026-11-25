import type { ReactNode } from 'react';

/** İstatistik kartının sağ üstündeki açık mavi daire içinde süs ikonu */
export function StatIcon({ children }: { children: ReactNode }) {
  return (
    <span className="stat-icon" aria-hidden="true">
      {children}
    </span>
  );
}
