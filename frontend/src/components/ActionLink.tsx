import { Button, type ButtonProps } from 'antd';
import { forwardRef } from 'react';

/** Tablo işlem sütunundaki bağlantı görünümlü işlemler: gerçek düğme olduğu için klavyeyle odaklanır ve Enter/Boşluk ile çalışır. */
export const ActionLink = forwardRef<HTMLButtonElement, ButtonProps>(function ActionLink({ style, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="link"
      size="small"
      style={{ padding: 0, height: 'auto', fontWeight: 400, ...style }}
      {...props}
    />
  );
});
